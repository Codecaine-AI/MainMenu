#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);

function usage() {
  console.error([
    'Usage:',
    '  node .claude/skills/asset-recreation/scripts/render-svg.mjs input.svg output.png [--width N] [--height N] [--crop x,y,w,h]',
    '',
    'Renderer order: resvg, rsvg-convert, inkscape, project-local sharp.',
  ].join('\n'));
}

function parseArgs(argv) {
  const args = [...argv];
  const input = args.shift();
  const output = args.shift();
  const options = { width: undefined, height: undefined, crop: undefined };

  while (args.length > 0) {
    const arg = args.shift();
    const next = () => {
      if (args.length === 0) throw new Error(`Missing value for ${arg}`);
      return args.shift();
    };

    if (arg === '--width') options.width = Number(next());
    else if (arg.startsWith('--width=')) options.width = Number(arg.slice('--width='.length));
    else if (arg === '--height') options.height = Number(next());
    else if (arg.startsWith('--height=')) options.height = Number(arg.slice('--height='.length));
    else if (arg === '--crop') options.crop = parseCrop(next());
    else if (arg.startsWith('--crop=')) options.crop = parseCrop(arg.slice('--crop='.length));
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!input || !output) throw new Error('Missing input or output path');
  if (options.width !== undefined && (!Number.isFinite(options.width) || options.width <= 0)) {
    throw new Error('--width must be a positive number');
  }
  if (options.height !== undefined && (!Number.isFinite(options.height) || options.height <= 0)) {
    throw new Error('--height must be a positive number');
  }

  return {
    input: path.resolve(input),
    output: path.resolve(output),
    options,
  };
}

function parseCrop(value) {
  const parts = value.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part) || part < 0)) {
    throw new Error('--crop must be x,y,w,h with non-negative numbers');
  }

  const [left, top, width, height] = parts;
  if (width <= 0 || height <= 0) throw new Error('--crop width and height must be positive');
  return { left, top, width, height };
}

function hasCommand(command) {
  const result = spawnSync('sh', ['-lc', `command -v ${command}`], { encoding: 'utf8' });
  return result.status === 0;
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  return result.status === 0;
}

function renderWithCli(input, output, options) {
  if (hasCommand('resvg')) {
    const args = [];
    if (options.width) args.push('--width', String(options.width));
    if (options.height) args.push('--height', String(options.height));
    args.push(input, output);
    if (run('resvg', args)) return 'resvg';
  }

  if (hasCommand('rsvg-convert')) {
    const args = [input, '-o', output];
    if (options.width) args.push('-w', String(options.width));
    if (options.height) args.push('-h', String(options.height));
    if (run('rsvg-convert', args)) return 'rsvg-convert';
  }

  if (hasCommand('inkscape')) {
    const args = [input, '--export-type=png', `--export-filename=${output}`];
    if (options.width) args.push(`--export-width=${options.width}`);
    if (options.height) args.push(`--export-height=${options.height}`);
    if (run('inkscape', args)) return 'inkscape';
  }

  return undefined;
}

function prepareSvgForCli(input) {
  const source = fs.readFileSync(input, 'utf8');
  const variables = new Map();

  for (const match of source.matchAll(/--([a-zA-Z0-9_-]+)\s*:\s*([^;{}]+);/g)) {
    variables.set(match[1], match[2].trim());
  }

  let prepared = source.replace(
    /var\(\s*--([a-zA-Z0-9_-]+)\s*(?:,\s*([^)]+))?\)/g,
    (match, name, fallback) => variables.get(name) ?? fallback?.trim() ?? match,
  );
  prepared = prepared.replace(/:root\s*\{[^}]*\}/g, '');

  if (prepared === source) {
    return { input, cleanup: () => {} };
  }

  const temp = path.join(os.tmpdir(), `asset-recreation-svg-${process.pid}-${Date.now()}.svg`);
  fs.writeFileSync(temp, prepared);
  return {
    input: temp,
    cleanup: () => {
      try {
        fs.unlinkSync(temp);
      } catch {
        // Best-effort cleanup only.
      }
    },
  };
}

function candidateRequirePaths(input) {
  const paths = new Set([process.cwd(), path.dirname(input)]);
  let dir = process.cwd();

  while (true) {
    paths.add(dir);
    paths.add(path.join(dir, 'apps/scene-engine'));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return [...paths];
}

function loadSharp(input) {
  for (const base of candidateRequirePaths(input)) {
    try {
      return require(require.resolve('sharp', { paths: [base] }));
    } catch {
      // Try the next workspace path.
    }
  }

  return undefined;
}

async function renderWithSharp(input, output, options) {
  const sharp = loadSharp(input);
  if (!sharp) return undefined;

  const resize = {};
  if (options.width) resize.width = Math.round(options.width);
  if (options.height) resize.height = Math.round(options.height);
  if (resize.width || resize.height) {
    resize.fit = 'contain';
    resize.background = { r: 0, g: 0, b: 0, alpha: 0 };
  }

  let pipeline = sharp(input, { limitInputPixels: false });
  if (resize.width || resize.height) pipeline = pipeline.resize(resize);
  await pipeline.png().toFile(output);
  return 'sharp';
}

async function cropWithSharp(output, crop) {
  const sharp = loadSharp(output);
  if (!sharp) throw new Error('Cropping requires sharp to be available');

  const temp = `${output}.crop-${process.pid}.png`;
  await sharp(output)
    .extract({
      left: Math.round(crop.left),
      top: Math.round(crop.top),
      width: Math.round(crop.width),
      height: Math.round(crop.height),
    })
    .png()
    .toFile(temp);

  const move = spawnSync('mv', [temp, output], { stdio: 'inherit' });
  if (move.status !== 0) throw new Error(`Failed to replace output with cropped image: ${output}`);
}

async function main() {
  const { input, output, options } = parseArgs(process.argv.slice(2));
  const prepared = prepareSvgForCli(input);

  try {
    const renderer = renderWithCli(prepared.input, output, options)
      ?? await renderWithSharp(prepared.input, output, options);

    if (!renderer) {
      throw new Error('No SVG renderer found. Install resvg, rsvg-convert, inkscape, or a workspace-local sharp dependency.');
    }

    if (options.crop) await cropWithSharp(output, options.crop);
    console.error(`Rendered ${output} with ${renderer}${options.crop ? ' and cropped output' : ''}.`);
  } finally {
    prepared.cleanup();
  }
}

main().catch((error) => {
  usage();
  console.error(`\nError: ${error.message}`);
  process.exit(1);
});
