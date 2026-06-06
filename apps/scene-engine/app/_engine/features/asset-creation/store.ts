import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { readAssetRegistry, writeAssetRegistry } from '@/lib/asset-library'
import { resolveProjectPaths } from '@/lib/project-paths'
import type { AssetContainer } from '@/types/scene'
import type { AssetCreationRecord, AssetCreationSummary } from './types'

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export interface UploadedAssetFile {
  name: string
  type: string
  arrayBuffer: () => Promise<ArrayBuffer>
}

function nowIso() {
  return new Date().toISOString()
}

function slugify(input: string) {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'asset'
}

function assertSafeId(id: string, label = 'id') {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`Invalid ${label}: ${id}`)
  }
  return id
}

function uniqueId(base: string, exists: (id: string) => boolean) {
  const root = slugify(base)
  if (!exists(root)) return root

  let index = 2
  while (exists(`${root}-${index}`)) index += 1
  return `${root}-${index}`
}

function helperRoot(projectId: string) {
  const safeProjectId = assertSafeId(projectId, 'project id')
  const projectPaths = resolveProjectPaths(safeProjectId)
  if (!projectPaths) throw new Error(`Project not found: ${safeProjectId}`)

  return path.join(projectPaths.root, 'ProjectSettings', 'helpers', 'asset-creation')
}

function assetsRoot(projectId: string) {
  return path.join(helperRoot(projectId), 'assets')
}

function assetDir(projectId: string, assetId: string) {
  return path.join(assetsRoot(projectId), assertSafeId(assetId, 'asset id'))
}

function recordPath(projectId: string, assetId: string) {
  return path.join(assetDir(projectId, assetId), 'asset-creation.json')
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function imageExtension(file: UploadedAssetFile) {
  const byMime = IMAGE_EXTENSIONS[file.type]
  if (byMime) return byMime

  const ext = path.extname(file.name).replace('.', '').toLowerCase()
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext
  throw new Error('Source image must be PNG, JPEG, or WebP.')
}

function contentTypeForPath(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.svg') return 'image/svg+xml'
  return 'image/png'
}

function summarize(record: AssetCreationRecord): AssetCreationSummary {
  return {
    id: record.id,
    name: record.name,
    sourceImage: record.sourceImage,
    renderImage: record.renderImage,
    promotedAssetId: record.promotedAssetId,
    updatedAt: record.updatedAt,
  }
}

export async function listAssetCreations(projectId: string): Promise<AssetCreationSummary[]> {
  const root = assetsRoot(projectId)
  if (!existsSync(root)) return []

  const entries = await readdir(root, { withFileTypes: true })
  const records = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name))
      .map(async (entry) => {
        const file = recordPath(projectId, entry.name)
        if (!existsSync(file)) return null
        return readJson<AssetCreationRecord>(file).catch(() => null)
      }),
  )

  return records
    .filter((record): record is AssetCreationRecord => Boolean(record))
    .map(summarize)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function loadAssetCreation(
  projectId: string,
  assetId: string,
): Promise<AssetCreationRecord | null> {
  const file = recordPath(projectId, assetId)
  if (!existsSync(file)) return null
  return readJson<AssetCreationRecord>(file)
}

export async function createAssetCreation(input: {
  projectId: string
  name: string
  file: UploadedAssetFile
}): Promise<AssetCreationRecord> {
  const cleanedName = input.name.trim() || input.file.name.replace(/\.[^.]+$/, '')
  await mkdir(assetsRoot(input.projectId), { recursive: true })
  const existing = new Set((await readdir(assetsRoot(input.projectId)).catch(() => [])).filter(Boolean))
  const assetId = uniqueId(cleanedName, (candidate) => existing.has(candidate))
  const dir = assetDir(input.projectId, assetId)
  await mkdir(dir, { recursive: true })

  const ext = imageExtension(input.file)
  const sourceImage = `source.${ext}`
  await writeFile(path.join(dir, sourceImage), Buffer.from(await input.file.arrayBuffer()))

  const timestamp = nowIso()
  const record: AssetCreationRecord = {
    id: assetId,
    projectId: input.projectId,
    name: cleanedName,
    sourceImage,
    componentHtml: `<div class="asset-root">\n  <img class="asset-source" src="__SOURCE_IMAGE__" alt="" />\n</div>`,
    componentCss: [
      '.asset-root {',
      '  display: inline-grid;',
      '  place-items: center;',
      '  background: transparent;',
      '}',
      '',
      '.asset-source {',
      '  display: block;',
      '  max-width: 100%;',
      '  height: auto;',
      '}',
    ].join('\n'),
    renderImage: existsSync(path.join(dir, 'render.png')) ? 'render.png' : null,
    promotedAssetId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await writeJson(recordPath(input.projectId, assetId), record)
  await writeFile(path.join(dir, 'component.html'), record.componentHtml, 'utf8')
  await writeFile(path.join(dir, 'component.css'), record.componentCss, 'utf8')
  return record
}

export async function updateAssetCreation(input: {
  projectId: string
  assetId: string
  componentHtml: string
  componentCss: string
}): Promise<AssetCreationRecord> {
  const record = await loadAssetCreation(input.projectId, input.assetId)
  if (!record) throw new Error(`Asset creation not found: ${input.assetId}`)
  const updated: AssetCreationRecord = {
    ...record,
    componentHtml: input.componentHtml,
    componentCss: input.componentCss,
    renderImage: existsSync(path.join(assetDir(input.projectId, input.assetId), 'render.png')) ? 'render.png' : null,
    updatedAt: nowIso(),
  }
  const dir = assetDir(input.projectId, input.assetId)
  await writeFile(path.join(dir, 'component.html'), updated.componentHtml, 'utf8')
  await writeFile(path.join(dir, 'component.css'), updated.componentCss, 'utf8')
  await writeJson(recordPath(input.projectId, input.assetId), updated)
  return updated
}

export async function resolveAssetCreationFile(
  projectId: string,
  assetId: string,
  kind: 'source' | 'render',
): Promise<{ filePath: string; contentType: string } | null> {
  const record = await loadAssetCreation(projectId, assetId)
  if (!record) return null
  const filename = kind === 'source' ? record.sourceImage : record.renderImage
  if (!filename) return null
  const filePath = path.join(assetDir(projectId, assetId), filename)
  if (!existsSync(filePath)) return null
  return { filePath, contentType: contentTypeForPath(filePath) }
}

export async function promoteAssetCreation(projectId: string, assetId: string) {
  const record = await loadAssetCreation(projectId, assetId)
  if (!record) throw new Error(`Asset creation not found: ${assetId}`)
  const projectPaths = resolveProjectPaths(projectId)
  if (!projectPaths) throw new Error(`Project not found: ${projectId}`)

  const source = record.renderImage ?? record.sourceImage
  const sourcePath = path.join(assetDir(projectId, assetId), source)
  if (!existsSync(sourcePath)) throw new Error('No source or render image is available to promote.')

  const ext = path.extname(source).replace('.', '') || 'png'
  const registry = readAssetRegistry(projectId)
  const id = uniqueId(record.id, (candidate) => Boolean(registry[candidate]))
  const filename = `${id}.${ext}`
  const targetDir = projectPaths.mediaDir('image')
  await mkdir(targetDir, { recursive: true })
  await copyFile(sourcePath, path.join(targetDir, filename))

  const timestamp = nowIso()
  const entry: AssetContainer = {
    type: 'image',
    file: `/assets/image/${filename}`,
    label: record.name,
    scope: 'project',
    projectIds: [projectId],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  registry[id] = entry
  writeAssetRegistry(registry, projectId)

  const updated: AssetCreationRecord = {
    ...record,
    promotedAssetId: id,
    updatedAt: timestamp,
  }
  await writeJson(recordPath(projectId, assetId), updated)
  return { id, asset: entry, record: updated }
}
