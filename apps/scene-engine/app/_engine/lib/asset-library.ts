import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { discoverProjects, loadProject, projectRoot } from '@/lib/scenes'
import type {
  AssetContainer,
  AssetLibraryRecord,
  AssetType,
  AssetUsageLocation,
  SceneJson,
  SceneObject,
} from '@/types/scene'

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function assetRegistryPath(root = process.cwd()) {
  return path.join(root, 'public', 'assets', 'registry.json')
}

export function readAssetRegistry(root = process.cwd()): Record<string, AssetContainer> {
  const file = assetRegistryPath(root)
  if (!existsSync(file)) return {}
  return JSON.parse(readFileSync(file, 'utf-8')) as Record<string, AssetContainer>
}

export function writeAssetRegistry(
  registry: Record<string, AssetContainer>,
  root = process.cwd(),
) {
  writeFileSync(assetRegistryPath(root), JSON.stringify(registry, null, 2) + '\n', 'utf-8')
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

function readScene(projectDir: string, sceneId: string): SceneJson | null {
  const file = path.join(projectDir, 'scenes', sceneId, 'scene.json')
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
): Map<string, AssetUsageLocation[]> {
  const usage = new Map<string, AssetUsageLocation[]>()
  for (const descriptor of discoverProjects()) {
    const project = loadProject(descriptor.id)
    const root = projectRoot(descriptor.id)
    if (!project || !root) continue
    for (const sceneRef of project.scenes ?? []) {
      const scene = readScene(root, sceneRef.id)
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
  const registry = readAssetRegistry()
  const usage = options.includeUsage ? collectAssetUsage(registry) : new Map<string, AssetUsageLocation[]>()

  return Object.entries(registry)
    .filter(([id, entry]) => ID_RE.test(id) && (!options.type || entry.type === options.type))
    .filter(([, entry]) => assetAvailableForProject(entry, options.projectId))
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
