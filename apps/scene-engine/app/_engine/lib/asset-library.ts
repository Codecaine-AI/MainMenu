import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { defaultProjectId, discoverProjects, loadProject } from '@/lib/scenes'
import { resolveProjectPaths, type ProjectPaths } from '@/lib/project-paths'
import type {
  AssetContainer,
  AssetLibraryRecord,
  AssetType,
  AssetUsageLocation,
  SceneJson,
  SceneObject,
} from '@/types/scene'

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function selectedProjectId(projectId?: string | null) {
  return projectId ?? defaultProjectId()
}

export function assetRegistryPath(projectId?: string | null) {
  const paths = resolveProjectPaths(selectedProjectId(projectId))
  return paths?.assetRegistryFile ?? path.join(process.cwd(), 'public', 'assets', 'registry.json')
}

export function readAssetRegistry(projectId?: string | null): Record<string, AssetContainer> {
  const file = assetRegistryPath(projectId)
  if (!existsSync(file)) return {}
  return JSON.parse(readFileSync(file, 'utf-8')) as Record<string, AssetContainer>
}

export function writeAssetRegistry(
  registry: Record<string, AssetContainer>,
  projectId?: string | null,
) {
  writeFileSync(assetRegistryPath(projectId), JSON.stringify(registry, null, 2) + '\n', 'utf-8')
}

export function assetLabel(id: string, entry: AssetContainer): string {
  if (entry.label?.trim()) return entry.label.trim()
  const fileBase = entry.file
    ? path.basename(entry.file).replace(/\.[^.]+$/, '')
    : id
  return fileBase
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function assetAvailableForProject(
  entry: AssetContainer,
  projectId?: string | null,
): boolean {
  if (!projectId) return true
  if (entry.scope !== 'project') return true
  return Array.isArray(entry.projectIds) && entry.projectIds.includes(projectId)
}

function readScene(projectPaths: ProjectPaths, sceneId: string): SceneJson | null {
  const file = projectPaths.sceneFile(sceneId)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as SceneJson
  } catch {
    return null
  }
}

function pushUsage(
  usage: Map<string, AssetUsageLocation[]>,
  assetId: string | undefined,
  registry: Record<string, AssetContainer>,
  location: AssetUsageLocation,
) {
  if (!assetId || !registry[assetId]) return
  const list = usage.get(assetId) ?? []
  list.push(location)
  usage.set(assetId, list)
}

function collectPropertyUsage(
  value: unknown,
  usage: Map<string, AssetUsageLocation[]>,
  registry: Record<string, AssetContainer>,
  location: AssetUsageLocation,
) {
  if (typeof value === 'string') {
    pushUsage(usage, value, registry, location)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectPropertyUsage(item, usage, registry, {
        ...location,
        property: location.property ? `${location.property}.${index}` : String(index),
      }),
    )
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      collectPropertyUsage(child, usage, registry, {
        ...location,
        property: location.property ? `${location.property}.${key}` : key,
      })
    }
  }
}

function collectObjectUsage(
  object: SceneObject,
  usage: Map<string, AssetUsageLocation[]>,
  registry: Record<string, AssetContainer>,
  base: Omit<AssetUsageLocation, 'objectId'>,
) {
  const objectId = object.id
  pushUsage(usage, object.asset, registry, { ...base, objectId })

  for (const slot of object.slots ?? []) {
    pushUsage(usage, slot.asset, registry, {
      ...base,
      objectId,
      slotId: slot.id,
    })
  }

  for (const event of object.events ?? []) {
    if (event.action === 'play-audio') {
      pushUsage(usage, event.target, registry, {
        ...base,
        objectId,
        property: 'event.target',
      })
    }
  }

  if (object.properties) {
    collectPropertyUsage(object.properties, usage, registry, {
      ...base,
      objectId,
      property: 'properties',
    })
  }

  for (const child of object.children ?? []) {
    collectObjectUsage(child, usage, registry, base)
  }
}

export function collectAssetUsage(
  registry = readAssetRegistry(),
  projectId?: string | null,
): Map<string, AssetUsageLocation[]> {
  const usage = new Map<string, AssetUsageLocation[]>()
  for (const descriptor of discoverProjects()) {
    if (projectId && descriptor.id !== projectId) continue
    const project = loadProject(descriptor.id)
    const paths = resolveProjectPaths(descriptor.id)
    if (!project || !paths) continue
    for (const sceneRef of project.scenes ?? []) {
      const scene = readScene(paths, sceneRef.id)
      if (!scene) continue
      for (const object of scene.objects ?? []) {
        collectObjectUsage(object, usage, registry, {
          projectId: descriptor.id,
          sceneId: sceneRef.id,
        })
      }
    }
  }
  return usage
}

export function listAssetLibrary(options: {
  type?: AssetType | null
  projectId?: string | null
  includeUsage?: boolean
} = {}): AssetLibraryRecord[] {
  const projectId = selectedProjectId(options.projectId)
  const registry = readAssetRegistry(projectId)
  const usage = options.includeUsage ? collectAssetUsage(registry, projectId) : new Map<string, AssetUsageLocation[]>()

  return Object.entries(registry)
    .filter(([id, entry]) => ID_RE.test(id) && (!options.type || entry.type === options.type))
    .filter(([, entry]) => assetAvailableForProject(entry, projectId))
    .map(([id, entry]) => {
      const locations = usage.get(id) ?? []
      return {
        ...entry,
        id,
        label: assetLabel(id, entry),
        scope: entry.scope ?? 'global',
        usageCount: locations.length,
        usage: options.includeUsage ? locations : undefined,
      }
    })
    .sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
}

export function projectAssetUsage(projectId: string): AssetLibraryRecord[] {
  return listAssetLibrary({ projectId, includeUsage: true })
    .map((asset) => ({
      ...asset,
      usage: asset.usage?.filter((location) => location.projectId === projectId),
      usageCount: asset.usage?.filter((location) => location.projectId === projectId).length ?? 0,
    }))
    .filter((asset) => (asset.usageCount ?? 0) > 0)
}
