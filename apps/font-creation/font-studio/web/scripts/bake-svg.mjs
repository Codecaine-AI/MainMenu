#!/usr/bin/env node

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, "..");
const studioRoot = path.resolve(appDir, "..");
const projectRoot = path.resolve(studioRoot, "projects/melee");

const BAKE_GROUPS = [
  {
    name: "bottom",
    layers: [
      "chrome-extrusion-shadow-layer",
      "chrome-extrusion-stack-layer",
    ],
  },
  {
    name: "chrome-surface",
    layers: [
      "edge-shadow-layer",
      "red-lip-boundary-layer",
      "inner-silver-down-ramp-layer",
      "inner-ramp-red-contact-blackline-layer",
      "inner-ramp-mid-hotline-layer",
      "inner-ramp-top-hotline-layer",
      "inner-highlight-layer",
      "silver-rim-layer",
      "chrome-top-edge-hotline-layer",
      "chrome-top-edge-shadowline-layer",
      "chrome-dark-reflection-layer",
      "chrome-hot-reflection-layer",
      "inner-ramp-top-face-blend-layer",
      "outer-ramp-top-face-blend-layer",
      "chrome-stack-soft-dark-reflection-layer",
      "chrome-stack-soft-hot-reflection-layer",
      "chrome-top-cast-shadow-on-lower-bevel-layer",
      "chrome-stack-edge-hotline-layer",
      "chrome-stack-edge-shadowline-layer",
      "inner-ramp-hot-reflection-layer",
      "inner-ramp-dark-reflection-layer",
      "outer-ramp-hot-reflection-layer",
      "outer-ramp-dark-reflection-layer",
      "chrome-environment-reflection-layer",
      "chrome-normal-shadow-layer",
      "chrome-normal-highlight-layer",
      "ambient-occlusion-layer",
      "inner-shadow-layer",
      "outer-silver-down-ramp-layer",
      "outer-ramp-top-hotline-layer",
      "outer-ramp-falloff-shadow-layer",
      "inner-ramp-low-contact-layer",
      "outer-ramp-low-contact-layer",
      "chrome-top-inner-lift-shadow-layer",
      "chrome-top-outer-lift-shadow-layer",
      "final-red-chrome-cut-layer",
      "final-inner-chrome-hotline-layer",
      "final-outer-chrome-hotline-layer",
      "final-outer-silhouette-cut-layer",
      "final-outer-silhouette-hotline-layer",
    ],
  },
];

const LIVE_INTERIOR_LAYERS = [
  "outer-chrome-cast-shadow-on-background-layer",
  "fill-layer",
  "red-enamel-basin-shadow-layer",
  "red-enamel-gloss-layer",
  "red-contact-shadow-layer",
  "red-contact-core-shadow-layer",
  "inner-chrome-cast-shadow-on-red-layer",
  "chrome-top-cast-shadow-on-red-layer",
];

async function bake(svgPath, { port = 4177, scale = 2 } = {}) {
  const svgRelative = path.relative(projectRoot, svgPath);
  if (svgRelative.startsWith("..") || path.isAbsolute(svgRelative)) {
    throw new Error(`SVG path is outside project workspace: ${svgPath}`);
  }
  const svgUrl = `http://127.0.0.1:${port}/generation/${svgRelative}`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    const svgText = await (await fetch(svgUrl)).text();

    const wrapperHtml = `<!DOCTYPE html>
<html><head><style>
  html, body { margin: 0; padding: 0; background: transparent !important; overflow: hidden; }
  svg { display: block; width: 100vw; height: 100vh; }
</style></head><body>${svgText}</body></html>`;

    const viewBoxMatch = svgText.match(/viewBox="([^"]+)"/);
    if (!viewBoxMatch) throw new Error("No viewBox found in SVG");
    const [, , vbW, vbH] = viewBoxMatch[1].split(/\s+/).map(Number);

    await page.setViewport({
      width: Math.ceil(vbW * scale),
      height: Math.ceil(vbH * scale),
      deviceScaleFactor: 1,
    });

    await page.setContent(wrapperHtml, { waitUntil: "networkidle0", timeout: 30000 });

    const allLayerIds = await page.evaluate(() =>
      Array.from(document.querySelectorAll("svg > g[id]")).map((g) => g.id),
    );

    const extractedDefs = await page.evaluate(() => {
      const svg = document.querySelector("svg");
      if (!svg) return {};

      const glyphPaths = Array.from(svg.querySelectorAll("defs path[id^='glyph_']"))
        .map((p) => p.outerHTML)
        .join("\n    ");

      const fillClip = svg.querySelector("#fill-clip")?.outerHTML ?? "";
      const chromeStackMask = svg.querySelector("#chrome-stack-mask")?.outerHTML ?? "";
      const fillGradient = svg.querySelector("#red-fill-gradient")?.outerHTML ?? "";
      const label = svg.getAttribute("aria-label") ?? "";

      return { glyphPaths, fillClip, chromeStackMask, fillGradient, label };
    });

    const liveLayerMarkup = await page.evaluate((liveIds) => {
      const parts = [];
      for (const id of liveIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        parts.push(el.outerHTML);
      }

      const defs = [];
      for (const id of liveIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        const filterRef = el.getAttribute("filter")?.match(/url\(#([^)]+)\)/)?.[1];
        if (filterRef) {
          const filterEl = document.getElementById(filterRef);
          if (filterEl) defs.push(filterEl.outerHTML);
        }
        const maskRef = el.getAttribute("mask")?.match(/url\(#([^)]+)\)/)?.[1];
        if (maskRef) {
          const maskEl = document.getElementById(maskRef);
          if (maskEl) defs.push(maskEl.outerHTML);
        }
        el.querySelectorAll("[mask]").forEach((child) => {
          const ref = child.getAttribute("mask")?.match(/url\(#([^)]+)\)/)?.[1];
          if (ref) {
            const refEl = document.getElementById(ref);
            if (refEl) defs.push(refEl.outerHTML);
          }
        });
      }
      return { layers: parts, defs };
    }, LIVE_INTERIOR_LAYERS);

    const pngs = {};

    for (const group of BAKE_GROUPS) {
      await page.evaluate(
        (ids, groupIds) => {
          for (const id of ids) {
            const el = document.getElementById(id);
            if (!el) continue;
            el.style.display = groupIds.includes(id) ? "" : "none";
          }
          const bg = document.getElementById("background");
          if (bg) bg.style.display = "none";
        },
        allLayerIds,
        group.layers,
      );

      const png = await page.screenshot({
        type: "png",
        omitBackground: true,
        fullPage: false,
      });
      pngs[group.name] = png;

      await page.evaluate((ids) => {
        for (const id of ids) {
          const el = document.getElementById(id);
          if (el) el.style.display = "";
        }
        const bg = document.getElementById("background");
        if (bg) bg.style.display = "";
      }, allLayerIds);
    }

    await browser.close();

    const outDir = path.join(path.dirname(svgPath), "baked");
    await mkdir(outDir, { recursive: true });

    const imageRefs = [];
    for (const [name, png] of Object.entries(pngs)) {
      const filename = `${path.basename(svgPath, ".css-layers.svg")}.${name}.png`;
      await writeFile(path.join(outDir, filename), png);
      imageRefs.push({ name, filename });
    }

    const bakedDirRelative = path.relative(projectRoot, outDir);
    const servingPrefix = `/generation/${bakedDirRelative}`;

    const bakedSvg = assembleBakedSvg({
      viewBox: `0 0 ${vbW} ${vbH}`,
      width: vbW,
      height: vbH,
      ...extractedDefs,
      liveLayerMarkup,
      imageRefs,
      servingPrefix,
    });

    const bakedSvgPath = path.join(
      outDir,
      `${path.basename(svgPath, ".css-layers.svg")}.baked.svg`,
    );
    await writeFile(bakedSvgPath, bakedSvg, "utf8");

    return {
      svgPath: bakedSvgPath,
      pngs: imageRefs.map((r) => path.join(outDir, r.filename)),
      outDir,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

function assembleBakedSvg({
  viewBox,
  width,
  height,
  label,
  glyphPaths,
  fillClip,
  chromeStackMask,
  fillGradient,
  liveLayerMarkup,
  imageRefs,
  servingPrefix,
}) {
  const bottom = imageRefs.find((r) => r.name === "bottom");
  const chromeSurface = imageRefs.find((r) => r.name === "chrome-surface");
  const href = (ref) => `${servingPrefix}/${ref.filename}`;

  const liveDefs = liveLayerMarkup.defs.length
    ? `\n    ${liveLayerMarkup.defs.join("\n    ")}`
    : "";

  const fillLayer = liveLayerMarkup.layers.find((s) => s.includes('id="fill-layer"')) ?? "";

  const interiorLayers = liveLayerMarkup.layers
    .filter((s) => !s.includes('id="fill-layer"'))
    .join("\n\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${viewBox}" role="img" aria-label="${label}" data-baked="true">
  <defs>
    ${glyphPaths}
    ${fillClip}
    ${chromeStackMask}
    ${fillGradient}${liveDefs}
  </defs>

  <!-- Baked: extrusion depth + cast shadow (was 38 masked steps) -->
  <image href="${href(bottom)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>

  <!-- Live: fill + video (clipped to glyph outlines) -->
  ${fillLayer}

  <!-- Live: interior effects (blend modes need the fill beneath) -->
  ${interiorLayers}

  <!-- Baked: chrome surface (was 35 layers with masks, filters, blend modes) -->
  <image href="${href(chromeSurface)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>

  <!-- Slot: dynamic scene reflections, clipped to chrome-stack-mask -->
  <!--
  <g id="scene-reflection-slot" mask="url(#chrome-stack-mask)" style="mix-blend-mode:screen">
  </g>
  -->
</svg>
`;
}

const svgArg = process.argv[2];
const portArg = process.argv[3] ? Number(process.argv[3]) : 4177;
const scaleArg = process.argv[4] ? Number(process.argv[4]) : 2;

if (!svgArg) {
  console.error("Usage: node bake-svg.mjs <path-to-svg> [port] [scale]");
  console.error("  port   - dev server port (default: 4177)");
  console.error("  scale  - render scale factor (default: 2 = 2x resolution)");
  console.error("");
  console.error("Example:");
  console.error(
    "  node scripts/bake-svg.mjs ../projects/melee/outputs/generated/layer-recipe/word/CODECAINE.css-layers.svg",
  );
  process.exit(1);
}

const resolvedSvg = path.resolve(svgArg);
console.log(`Baking ${resolvedSvg} at ${scaleArg}x via 127.0.0.1:${portArg}...`);

bake(resolvedSvg, { port: portArg, scale: scaleArg })
  .then((result) => {
    console.log(`Done! Output:`);
    console.log(`  SVG:  ${result.svgPath}`);
    result.pngs.forEach((p) => console.log(`  PNG:  ${p}`));
  })
  .catch((err) => {
    console.error("Bake failed:", err);
    process.exit(1);
  });

export { bake, BAKE_GROUPS, LIVE_INTERIOR_LAYERS };
