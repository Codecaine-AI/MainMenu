import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { ProjectPaths } from '@/lib/project-paths'
import type {
  AssetContainer,
  AssetType,
  ExportGraphSummary,
  Manifest,
  ModuleEntry,
  ProjectManifest,
  ProjectSceneRef,
  SceneJson,
  SceneObject,
} from '@/types/scene'

const PUBLIC_FILE_REFERENCE_RE = /\/(?:assets|modules|fonts)\/[^"'()\s<>]+/g

export interface ExportSceneFile {
  id: string
  name?: string
  absPath: string
  raw: string
  scene: SceneJson | null
}

export interface ExportGraph extends ExportGraphSummary {
  scenes: ExportSceneFile[]
  assetsRegistry: Record<string, AssetContainer>
  modulesRegistry: Record<string, ModuleEntry>
  fontsRegistry: Record<string, AssetContainer>
  excludedAssetIds: string[]
  excludedModuleIds: string[]
  excludedFontIds: string[]
}

function toPosixPath(value: string) {
  return value.split(path.sep).join('/')
}

function deriveManifestPath(projectPaths: ProjectPaths, entryPath: string): string | null {
  if (!entryPath.startsWith('/')) return null
  const logicalManifest = entryPath.replace(/\/[^/]+$/, '/manifest.json')
  return projectPaths.resolveLogicalFile(logicalManifest)
}

function collectPublicReferences(value: unknown, refs: Set<string>) {
  if (typeof value === 'string') {
    PUBLIC_FILE_REFERENCE_RE.lastIndex = 0
    for (const match of value.matchAll(PUBLIC_FILE_REFERENCE_RE)) refs.add(match[0])
    PUBLIC_FILE_REFERENCE_RE.lastIndex = 0
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectPublicReferences(item, refs))
    return
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectPublicReferences(item, refs))
  }
}

function collectTextFontFamilies(value: unknown, families: Set<string>) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const record = value as Record<string, unknown>
  if (record.type === 'text' && record.properties && typeof record.properties === 'object') {
    const fontFamily = (record.properties as Record<string, unknown>).fontFamily
    if (typeof fontFamily === 'string' && fontFamily.trim()) families.add(fontFamily.trim())
  }
  if (Array.isArray(record.children)) {
    record.children.forEach((child) => collectTextFontFamilies(child, families))
  }
}

async function readModuleManifest(
  entry: ModuleEntry,
  projectPaths: ProjectPaths,
): Promise<Manifest | null> {
  if (entry.manifest) return entry.manifest
  if (!entry.path) return null
  const manifestPath = deriveManifestPath(projectPaths, entry.path)
  if (!manifestPath) return null
  try {
    return JSON.parse(await readFile(manifestPath, 'utf-8')) as Manifest
  } catch {
    return null
  }
}

function addAssetRef(input: {
  id: string | undefined
  assetsRegistry: Record<string, AssetContainer>
  assetIds: Set<string>
  warnings: string[]
  source: string
}) {
  if (!input.id) return
  if (input.assetsRegistry[input.id]) {
    input.assetIds.add(input.id)
    return
  }
  input.warnings.push(`Unresolved asset '${input.id}' from ${input.source}`)
}

function collectSceneObjectRefs(input: {
  object: SceneObject
  source: string
  assetsRegistry: Record<string, AssetContainer>
  modulesRegistry: Record<string, ModuleEntry>
  assetIds: Set<string>
  moduleIds: Set<string>
  publicFiles: Set<string>
  warnings: string[]
}) {
  const {
    object,
    source,
    assetsRegistry,
    modulesRegistry,
    assetIds,
    moduleIds,
    publicFiles,
    warnings,
  } = input

  if (object.asset) {
    if (modulesRegistry[object.asset] || object.type === 'component' || object.type === 'effect') {
      if (modulesRegistry[object.asset]) moduleIds.add(object.asset)
      else warnings.push(`Unresolved module '${object.asset}' from ${source}`)
    } else {
      addAssetRef({ id: object.asset, assetsRegistry, assetIds, warnings, source })
    }
  }

  for (const slot of object.slots ?? []) {
    addAssetRef({ id: slot.asset, assetsRegistry, assetIds, warnings, source: `${source}.slot:${slot.id}` })
    collectPublicReferences(slot, publicFiles)
  }

  for (const event of object.events ?? []) {
    if (event.action === 'play-audio') {
      addAssetRef({ id: event.target, assetsRegistry, assetIds, warnings, source: `${source}.event` })
    }
  }

  collectPublicReferences(object.properties, publicFiles)
  for (const child of object.children ?? []) {
    collectSceneObjectRefs({
      ...input,
      object: child,
      source: `${source}.children.${child.id}`,
    })
  }
}

function activeSceneRefs(project: ProjectManifest): ProjectSceneRef[] {
  return (project.scenes ?? []).filter((scene) => scene.active !== false && scene.export !== false)
}

function flattenObjects(objects: SceneObject[] | undefined): SceneObject[] {
  const out: SceneObject[] = []
  for (const object of objects ?? []) {
    out.push(object)
    out.push(...flattenObjects(object.children))
  }
  return out
}

export async function collectExportGraph(input: {
  projectPaths: ProjectPaths
  project: ProjectManifest
  assetsRegistry: Record<string, AssetContainer>
  modulesRegistry: Record<string, ModuleEntry>
  fontsRegistry: Record<string, AssetContainer>
}): Promise<ExportGraph> {
  const assetIds = new Set<string>()
  const moduleIds = new Set<string>()
  const publicFiles = new Set<string>()
  const requiredFontFamilies = new Set<string>(['FolkPro'])
  const requiredFontIds = new Set<string>()
  const warnings: string[] = []
  const scenes: ExportSceneFile[] = []
  const refs = activeSceneRefs(input.project)
  collectPublicReferences(input.project.web, publicFiles)

  for (const ref of refs) {
    const absPath = input.projectPaths.sceneFile(ref.id)
    const raw = await readFile(absPath, 'utf-8')
    let scene: SceneJson | null = null
    try {
      scene = JSON.parse(raw) as SceneJson
      collectPublicReferences(scene, publicFiles)
      for (const object of scene.objects ?? []) {
        collectTextFontFamilies(object, requiredFontFamilies)
        collectSceneObjectRefs({
          object,
          source: `${ref.id}.${object.id}`,
          assetsRegistry: input.assetsRegistry,
          modulesRegistry: input.modulesRegistry,
          assetIds,
          moduleIds,
          publicFiles,
          warnings,
        })
      }
    } catch {
      warnings.push(`Scene '${ref.id}' could not be parsed; falling back to literal public path collection only`)
      collectPublicReferences(raw, publicFiles)
    }
    scenes.push({ id: ref.id, name: ref.name ?? scene?.name, absPath, raw, scene })
  }

  const processedModules = new Set<string>()
  while (processedModules.size < moduleIds.size) {
    const nextId = Array.from(moduleIds).find((id) => !processedModules.has(id))
    if (!nextId) break
    processedModules.add(nextId)
    const entry = input.modulesRegistry[nextId]
    if (!entry) continue
    collectPublicReferences(entry, publicFiles)
    const manifest = await readModuleManifest(entry, input.projectPaths)
    if (!manifest) {
      warnings.push(`Module '${nextId}' has no readable manifest`)
      continue
    }
    collectPublicReferences(manifest, publicFiles)
    for (const moduleId of manifest.dependencies?.modules ?? []) {
      if (input.modulesRegistry[moduleId]) moduleIds.add(moduleId)
      else warnings.push(`Module '${nextId}' declares unknown module dependency '${moduleId}'`)
    }
    for (const assetId of manifest.dependencies?.assets ?? []) {
      addAssetRef({ id: assetId, assetsRegistry: input.assetsRegistry, assetIds, warnings, source: `${nextId}.manifest` })
    }
    for (const file of manifest.dependencies?.publicFiles ?? []) publicFiles.add(file)
    for (const font of manifest.dependencies?.fonts ?? []) {
      requiredFontIds.add(font)
      requiredFontFamilies.add(font)
    }
    for (const [property, schema] of Object.entries(manifest.properties ?? {})) {
      if (schema.type === 'string' && schema.assetType && typeof schema.default === 'string') {
        addAssetRef({
          id: schema.default,
          assetsRegistry: input.assetsRegistry,
          assetIds,
          warnings,
          source: `${nextId}.manifest.${property}`,
        })
      }
    }
  }

  for (const scene of scenes) {
    for (const object of flattenObjects(scene.scene?.objects)) {
      if (object.type !== 'component' && object.type !== 'effect') continue
      if (!object.asset) continue
      const moduleEntry = input.modulesRegistry[object.asset]
      if (!moduleEntry) continue
      const manifest = await readModuleManifest(moduleEntry, input.projectPaths)
      if (!manifest) continue
      for (const [property, schema] of Object.entries(manifest.properties ?? {})) {
        if (schema.type !== 'string' || !schema.assetType) continue
        const value = object.properties?.[property] ?? schema.default
        if (typeof value === 'string') {
          addAssetRef({
            id: value,
            assetsRegistry: input.assetsRegistry,
            assetIds,
            warnings,
            source: `${scene.id}.${object.id}.properties.${property}`,
          })
        }
      }
    }
  }

  const assetsRegistry = Object.fromEntries(
    Array.from(assetIds)
      .sort()
      .map((id) => [id, input.assetsRegistry[id]])
      .filter(([, entry]) => Boolean(entry)),
  ) as Record<string, AssetContainer>

  const modulesRegistry = Object.fromEntries(
    Array.from(moduleIds)
      .sort()
      .map((id) => [id, input.modulesRegistry[id]])
      .filter(([, entry]) => Boolean(entry)),
  ) as Record<string, ModuleEntry>

  const fontsRegistry = Object.fromEntries(
    Object.entries(input.fontsRegistry)
      .filter(([id, entry]) =>
        requiredFontIds.has(id) ||
        (entry.family ? requiredFontFamilies.has(entry.family) : false),
      )
      .sort(([a], [b]) => a.localeCompare(b)),
  )

  const fontIds = Object.keys(fontsRegistry)
  const publicFileList = Array.from(publicFiles)
    .filter((file) => file.startsWith('/assets/') || file.startsWith('/modules/') || file.startsWith('/fonts/'))
    .sort()

  return {
    projectId: input.project.id,
    activeSceneIds: scenes.map((scene) => scene.id),
    assetIds: Object.keys(assetsRegistry),
    moduleIds: Object.keys(modulesRegistry),
    fontIds,
    publicFiles: publicFileList,
    warnings: Array.from(new Set(warnings)).sort(),
    scenes,
    assetsRegistry,
    modulesRegistry,
    fontsRegistry,
    excludedAssetIds: Object.keys(input.assetsRegistry).filter((id) => !assetIds.has(id)).sort(),
    excludedModuleIds: Object.keys(input.modulesRegistry).filter((id) => !moduleIds.has(id)).sort(),
    excludedFontIds: Object.keys(input.fontsRegistry).filter((id) => !fontIds.includes(id)).sort(),
  }
}

export function moduleDirectoryForEntry(entry: ModuleEntry): string | null {
  if (!entry.path?.startsWith('/')) return null
  return toPosixPath(path.posix.dirname(entry.path.replace(/^\//, '')))
}
