import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readAssetRegistry, writeAssetRegistry } from '@/lib/asset-library'
import { discoverProjectFontAssets } from '@/lib/font-discovery'
import { resolveProjectPaths, type ProjectPaths } from '@/lib/project-paths'

const DEFAULT_TEXT = 'CODECAINE'
const DEFAULT_TRACKING = 4
const BAKE_VERSION = 2
const PROCESS_TIMEOUT_MS = 120_000
const PROCESS_MAX_BUFFER = 16 * 1024 * 1024
const STDERR_TAIL_LENGTH = 4_000

export interface GlyphBakeInput {
  projectId: string
  fontAssetId: string
  text?: string
  tracking?: number
  gapAdjustments?: number[]
}

export interface GlyphAssetEntry {
  type: 'glyph'
  file: string
}

export interface GlyphBakeResult {
  assetId: string
  entry: GlyphAssetEntry
  cached: boolean
}

export type GlyphBakeAllInput = Omit<GlyphBakeInput, 'fontAssetId'>

export interface GlyphBakeAllResult {
  results: Array<{
    fontAssetId: string
    assetId?: string
    cached?: boolean
    error?: string
  }>
}

interface FontPipePaths {
  root: string
  renderer: string
  recipe: string
  meleeGlyphs: string
}

interface FontSource {
  fontPath?: string
  glyphsPath: string
  hashBytes: Buffer
}

interface RenderInput {
  fontPipe: FontPipePaths
  fontSource: FontSource
  recipeBytes: Buffer
  text: string
  tracking: number
  gapAdjustments?: number[]
}

const inFlight = new Map<string, Map<string, Promise<GlyphBakeResult>>>()

export class GlyphBakeInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GlyphBakeInputError'
  }
}

function resolveFontPipePaths(): FontPipePaths {
  const root = process.env.FONT_PIPE_ROOT
    ? path.resolve(process.env.FONT_PIPE_ROOT)
    : path.resolve(process.cwd(), '../../../font-pipe/apps/font-creation/font-effects')

  return {
    root,
    renderer: path.join(root, 'renderer'),
    recipe: path.join(root, 'library', 'recipes', 'rounded-chrome-recipe.json'),
    meleeGlyphs: path.join(root, 'library', 'glyph-sets', 'melee-3', 'glyphs.json'),
  }
}

async function requireDirectory(absPath: string, label: string): Promise<void> {
  try {
    if ((await stat(absPath)).isDirectory()) return
  } catch {
    // Fall through to the clear configuration error below.
  }
  throw new Error(`${label} does not exist or is not a directory: ${absPath}`)
}

async function requireFile(absPath: string, label: string): Promise<void> {
  try {
    if ((await stat(absPath)).isFile()) return
  } catch {
    // Fall through to the clear configuration error below.
  }
  throw new Error(`${label} does not exist or is not a file: ${absPath}`)
}

async function validateFontPipe(fontPipe: FontPipePaths): Promise<void> {
  await requireDirectory(fontPipe.root, 'font-pipe root')
  await requireDirectory(fontPipe.renderer, 'font-pipe renderer directory')
  await requireFile(fontPipe.recipe, 'font-pipe rounded chrome recipe')
}

function resolveWithin(root: string, relativePath: string): string | null {
  const resolved = path.resolve(root, relativePath)
  const relative = path.relative(root, resolved)
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return resolved
  }
  return null
}

async function resolveFontSource(
  projectId: string,
  fontAssetId: string,
  projectPaths: ProjectPaths,
  fontPipe: FontPipePaths,
): Promise<FontSource> {
  if (fontAssetId === 'melee-3') {
    await requireFile(fontPipe.meleeGlyphs, 'font-pipe melee-3 glyph set')
    return {
      glyphsPath: fontPipe.meleeGlyphs,
      hashBytes: Buffer.from('melee-3', 'utf8'),
    }
  }

  const fonts = await discoverProjectFontAssets(projectId)
  const font = fonts[fontAssetId]
  if (!font || font.type !== 'font') {
    throw new GlyphBakeInputError(`Unknown font asset: ${fontAssetId}`)
  }

  let root: string
  let encodedRelativePath: string
  if (font.file.startsWith('/fonts/')) {
    root = projectPaths.fontsRoot
    encodedRelativePath = font.file.slice('/fonts/'.length)
  } else if (font.file.startsWith('/assets/font/')) {
    root = path.join(projectPaths.mediaRoot, 'font')
    encodedRelativePath = font.file.slice('/assets/font/'.length)
  } else {
    throw new GlyphBakeInputError(`Font asset has an unsupported file path: ${fontAssetId}`)
  }

  let relativePath: string
  try {
    relativePath = decodeURIComponent(encodedRelativePath)
  } catch {
    throw new GlyphBakeInputError(`Font asset has an invalid file path: ${fontAssetId}`)
  }

  const fontPath = resolveWithin(root, relativePath)
  if (!fontPath) {
    throw new GlyphBakeInputError(`Font asset resolves outside the project fonts directory: ${fontAssetId}`)
  }

  let hashBytes: Buffer
  try {
    hashBytes = await readFile(fontPath)
  } catch {
    throw new GlyphBakeInputError(`Font asset file could not be read: ${fontAssetId}`)
  }

  return {
    fontPath,
    glyphsPath: '',
    hashBytes,
  }
}

function updateHashPart(hash: ReturnType<typeof createHash>, label: string, value: Buffer | string) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8')
  hash.update(`${label}:${bytes.byteLength}:`, 'utf8')
  hash.update(bytes)
}

function computeBakeHash(input: {
  fontBytes: Buffer
  recipeBytes: Buffer
  text: string
  tracking: number
  gapAdjustments?: number[]
}): string {
  const hash = createHash('sha1')
  updateHashPart(hash, 'bakeVersion', JSON.stringify(BAKE_VERSION))
  updateHashPart(hash, 'font', input.fontBytes)
  updateHashPart(hash, 'text', input.text)
  updateHashPart(hash, 'tracking', JSON.stringify(input.tracking))
  updateHashPart(
    hash,
    'gapAdjustments',
    input.gapAdjustments === undefined ? 'omitted' : JSON.stringify(input.gapAdjustments),
  )
  updateHashPart(hash, 'recipe', input.recipeBytes)
  return hash.digest('hex').slice(0, 10)
}

function slugifyText(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'logo'
}

function stderrTail(stderr: string | Buffer): string {
  const value = Buffer.isBuffer(stderr) ? stderr.toString('utf8') : stderr
  return value.trim().slice(-STDERR_TAIL_LENGTH)
}

function runFontPipe(rendererDir: string, label: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      'python3',
      args,
      {
        cwd: rendererDir,
        timeout: PROCESS_TIMEOUT_MS,
        maxBuffer: PROCESS_MAX_BUFFER,
        encoding: 'utf8',
      },
      (error, _stdout, stderr) => {
        if (!error) {
          resolve()
          return
        }
        const tail = stderrTail(stderr)
        reject(new Error(
          `font-pipe ${label} failed: ${error.message}\nPython stderr tail:\n${tail || '[no stderr]'}`,
        ))
      },
    )
  })
}

function parseBaseRecipe(recipeBytes: Buffer): Record<string, unknown> {
  let value: unknown
  try {
    value = JSON.parse(recipeBytes.toString('utf8'))
  } catch {
    throw new Error('font-pipe rounded chrome recipe is not valid JSON')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('font-pipe rounded chrome recipe must contain a JSON object')
  }
  return value as Record<string, unknown>
}

async function renderSvg(input: RenderInput): Promise<Buffer> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'scene-engine-glyph-bake-'))
  const recipePath = path.join(tempDir, 'rounded-chrome-recipe.json')
  const outputDir = path.join(tempDir, 'rendered')
  const recipe: Record<string, unknown> = {
    ...parseBaseRecipe(input.recipeBytes),
    text: input.text,
    tracking: input.tracking,
  }
  if (input.gapAdjustments === undefined) {
    delete recipe.gap_adjustments
  } else {
    recipe.gap_adjustments = input.gapAdjustments
  }
  await writeFile(recipePath, JSON.stringify(recipe, null, 2) + '\n', 'utf8')

  let glyphsPath = input.fontSource.glyphsPath
  if (input.fontSource.fontPath) {
    glyphsPath = path.join(tempDir, 'glyphs.json')
    await runFontPipe(input.fontPipe.renderer, 'font extraction', [
      '-m',
      'scripts.extract_font_glyphs',
      '--font',
      input.fontSource.fontPath,
      '--chars',
      input.text,
      '--out',
      glyphsPath,
    ])
  }

  await runFontPipe(input.fontPipe.renderer, 'word render', [
    '-m',
    'scripts.render_recipe',
    '--paths',
    glyphsPath,
    '--recipe',
    recipePath,
    '--word-only',
    '--out-dir',
    outputDir,
  ])

  const wordDir = path.join(outputDir, 'word')
  const renderedFiles = (await readdir(wordDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.css-layers.svg'))
  if (renderedFiles.length !== 1) {
    throw new Error(
      `font-pipe word render produced ${renderedFiles.length} SVG files in ${wordDir}; expected exactly one`,
    )
  }

  const svg = (await readFile(path.join(wordDir, renderedFiles[0].name), 'utf8')).replace(
    /<g\b[^>]*\bdata-layer=(["'])fill-layer\1[^>]*>/g,
    (tag) => {
      if (/\bdata-slot\s*=/.test(tag)) return tag
      return tag.replace(/>$/, ' data-slot="base-layer" data-slot-type="video-fill">')
    },
  )
  await rm(tempDir, { recursive: true, force: true })
  return Buffer.from(svg, 'utf8')
}

function sharedBake(
  hash: string,
  projectId: string,
  bake: () => Promise<GlyphBakeResult>,
): Promise<GlyphBakeResult> {
  let projects = inFlight.get(hash)
  if (!projects) {
    projects = new Map()
    inFlight.set(hash, projects)
  }
  const existing = projects.get(projectId)
  if (existing) return existing

  const result = bake()
  projects.set(projectId, result)
  const clear = () => {
    const currentProjects = inFlight.get(hash)
    if (currentProjects?.get(projectId) !== result) return
    currentProjects.delete(projectId)
    if (currentProjects.size === 0) inFlight.delete(hash)
  }
  result.then(clear, clear)
  return result
}

export async function bakeCodecaineGlyph(input: GlyphBakeInput): Promise<GlyphBakeResult> {
  const text = input.text ?? DEFAULT_TEXT
  const tracking = input.tracking ?? DEFAULT_TRACKING
  const projectPaths = resolveProjectPaths(input.projectId)
  if (!projectPaths) {
    throw new GlyphBakeInputError(`Unknown project: ${input.projectId}`)
  }

  const fontPipe = resolveFontPipePaths()
  await validateFontPipe(fontPipe)
  const fontSource = await resolveFontSource(
    input.projectId,
    input.fontAssetId,
    projectPaths,
    fontPipe,
  )
  const recipeBytes = await readFile(fontPipe.recipe)
  const hash = computeBakeHash({
    fontBytes: fontSource.hashBytes,
    recipeBytes,
    text,
    tracking,
    gapAdjustments: input.gapAdjustments,
  })
  const assetId = `codecaine-logo-baked-${hash}`
  const filename = `${slugifyText(text)}-${hash}.svg`
  const outputPath = path.join(projectPaths.mediaRoot, 'glyph', 'generated', filename)
  const entry: GlyphAssetEntry = {
    type: 'glyph',
    file: `/assets/glyph/generated/${filename}`,
  }

  const existingEntry = readAssetRegistry(input.projectId)[assetId]
  if (existingEntry && existsSync(outputPath)) {
    return { assetId, entry, cached: true }
  }

  return sharedBake(hash, input.projectId, async () => {
    const svg = await renderSvg({
      fontPipe,
      fontSource,
      recipeBytes,
      text,
      tracking,
      gapAdjustments: input.gapAdjustments,
    })
    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(outputPath, svg)

    const registry = readAssetRegistry(input.projectId)
    registry[assetId] = entry
    writeAssetRegistry(registry, input.projectId)

    return { assetId, entry, cached: false }
  })
}

export async function bakeAllCodecaineGlyphs(
  input: GlyphBakeAllInput,
): Promise<GlyphBakeAllResult> {
  if (!resolveProjectPaths(input.projectId)) {
    throw new GlyphBakeInputError(`Unknown project: ${input.projectId}`)
  }

  const discoveredFonts = await discoverProjectFontAssets(input.projectId)
  const fontAssetIds = [...new Set(['melee-3', ...Object.keys(discoveredFonts)])]
  const results: GlyphBakeAllResult['results'] = []

  for (const fontAssetId of fontAssetIds) {
    try {
      const { assetId, cached } = await bakeCodecaineGlyph({
        ...input,
        fontAssetId,
      })
      results.push({ fontAssetId, assetId, cached })
    } catch (error) {
      results.push({
        fontAssetId,
        error: error instanceof Error ? error.message : 'Glyph bake failed',
      })
    }
  }

  return { results }
}
