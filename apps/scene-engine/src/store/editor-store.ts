import { create } from 'zustand'
import type { SceneJson, Registry } from '@/types/scene'

export interface EditorStore {
  scene: SceneJson | null
  registry: Registry | null
  selectedPath: string | null
  dirty: boolean

  setScene: (scene: SceneJson) => void
  setRegistry: (registry: Registry) => void
  setSelectedPath: (path: string | null) => void
  markDirty: () => void
  markClean: () => void
  mutateLayerAt: (path: string, patch: Record<string, unknown>) => void
  addLayerAt: (parentPath: string, index: number, layer: Record<string, unknown>) => void
  removeLayerAt: (path: string) => Record<string, unknown> | null
  moveLayer: (fromPath: string, toPath: string) => void
  updateContainerFile: (id: string, file: string) => Promise<void>
}

function parsePath(path: string): number[] {
  return path.split('.children.').map(Number)
}

function navigateToParentContainer(
  scene: SceneJson,
  path: string,
  opts: { create?: boolean } = {},
): { container: unknown[] | null; index: number } {
  const parts = parsePath(path)
  if (parts.length === 1) {
    return { container: scene.objects, index: parts[0] }
  }
  let layer: Record<string, unknown> = scene.objects[parts[0]] as unknown as Record<string, unknown>
  if (!layer) return { container: null, index: -1 }
  for (let i = 1; i < parts.length - 1; i++) {
    if (!layer.children) {
      if (!opts.create) return { container: null, index: -1 }
      layer.children = []
    }
    layer = (layer.children as Record<string, unknown>[])[parts[i]]
    if (!layer) return { container: null, index: -1 }
  }
  if (!layer.children) {
    if (!opts.create) return { container: null, index: -1 }
    layer.children = []
  }
  return { container: layer.children as unknown[], index: parts[parts.length - 1] }
}

function navigateToContainer(
  scene: SceneJson,
  parentPath: string,
  opts: { create?: boolean } = {},
): unknown[] | null {
  if (parentPath === '' || parentPath == null) return scene.objects
  const parts = parsePath(parentPath)
  let layer: Record<string, unknown> = scene.objects[parts[0]] as unknown as Record<string, unknown>
  if (!layer) return null
  for (let i = 1; i < parts.length; i++) {
    if (!layer.children) {
      if (!opts.create) return null
      layer.children = []
    }
    layer = (layer.children as Record<string, unknown>[])[parts[i]]
    if (!layer) return null
  }
  if (!layer.children) {
    if (!opts.create) return null
    layer.children = []
  }
  return layer.children as unknown[]
}

function deepMerge(target: unknown, patch: unknown): unknown {
  if (target == null || typeof target !== 'object' || Array.isArray(target)) return patch
  const out: Record<string, unknown> = { ...(target as Record<string, unknown>) }
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (
      v && typeof v === 'object' && !Array.isArray(v) &&
      out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])
    ) {
      out[k] = deepMerge(out[k], v)
    } else {
      out[k] = v
    }
  }
  return out
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  scene: null,
  registry: null,
  selectedPath: null,
  dirty: false,

  setScene: (scene) => set({ scene }),
  setRegistry: (registry) => set({ registry }),
  setSelectedPath: (path) => set({ selectedPath: path }),
  markDirty: () => set({ dirty: true }),
  markClean: () => set({ dirty: false }),

  mutateLayerAt: (path, patch) => {
    const { scene } = get()
    if (!scene) return
    const next = structuredClone(scene)
    const { container, index } = navigateToParentContainer(next, path)
    if (!container || (container as unknown[])[index] == null) return
    ;(container as unknown[])[index] = deepMerge((container as unknown[])[index], patch)
    set({ scene: next, dirty: true })
  },

  addLayerAt: (parentPath, index, layer) => {
    const { scene } = get()
    if (!scene) return
    const next = structuredClone(scene)
    const container = navigateToContainer(next, parentPath, { create: true })
    if (!container) return
    const insertAt = Math.max(0, Math.min(index, container.length))
    container.splice(insertAt, 0, layer)
    set({ scene: next, dirty: true })
  },

  removeLayerAt: (path) => {
    const { scene } = get()
    if (!scene) return null
    const next = structuredClone(scene)
    const { container, index } = navigateToParentContainer(next, path)
    if (!container || (container as unknown[])[index] == null) return null
    const [removed] = container.splice(index, 1)
    set({ scene: next, dirty: true })
    return removed as Record<string, unknown>
  },

  moveLayer: (fromPath, toPath) => {
    const { scene } = get()
    if (!scene || !fromPath || !toPath) return
    if (fromPath === toPath) return
    if (toPath.startsWith(fromPath + '.children.')) return
    const next = structuredClone(scene)
    const fromInfo = navigateToParentContainer(next, fromPath)
    if (!fromInfo.container || (fromInfo.container as unknown[])[fromInfo.index] == null) return
    const toInfo = navigateToParentContainer(next, toPath, { create: true })
    if (!toInfo.container) return
    const [layer] = fromInfo.container.splice(fromInfo.index, 1)
    let toIndex = toInfo.index
    if (fromInfo.container === toInfo.container && fromInfo.index < toInfo.index) {
      toIndex -= 1
    }
    toIndex = Math.max(0, Math.min(toIndex, toInfo.container.length))
    toInfo.container.splice(toIndex, 0, layer)
    set({ scene: next, dirty: true })
  },

  updateContainerFile: async (id, file) => {
    const { registry } = get()
    if (!registry || !registry[id]) return
    const { updateEntry } = await import('@/renderer/asset-registry')
    updateEntry(id, { file })
    set({ registry: { ...registry, [id]: { ...registry[id], file } } as Registry })
  },
}))
