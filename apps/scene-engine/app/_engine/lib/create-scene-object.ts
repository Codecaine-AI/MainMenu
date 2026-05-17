import type { AssetContainer, ModuleEntry, Registry, SceneJson, SceneObjectType } from '@/types/scene'

export type AddableObjectType = 'group' | 'text' | 'video' | 'image' | 'glyph' | 'effect' | 'component' | 'audio'

const DEFAULT_STAGE_W = 1440
const DEFAULT_STAGE_H = 1080

export const ADDABLE_OBJECT_TYPES: Array<{ type: AddableObjectType; label: string; requiresAsset: boolean }> = [
  { type: 'group', label: 'Group', requiresAsset: false },
  { type: 'text', label: 'Text', requiresAsset: false },
  { type: 'video', label: 'Video', requiresAsset: true },
  { type: 'image', label: 'Image', requiresAsset: true },
  { type: 'glyph', label: 'Glyph Group', requiresAsset: true },
  { type: 'effect', label: 'Effect', requiresAsset: true },
  { type: 'component', label: 'Component', requiresAsset: true },
  { type: 'audio', label: 'Audio', requiresAsset: true },
]

function collectIds(scene: SceneJson): Set<string> {
  const set = new Set<string>()
  const walk = (objects: Record<string, unknown>[]) => {
    for (const object of objects) {
      if (object.id) set.add(object.id as string)
      if (Array.isArray(object.children)) walk(object.children as Record<string, unknown>[])
    }
  }
  walk(scene.objects as unknown as Record<string, unknown>[])
  return set
}

function uniqueId(base: string, scene: SceneJson): string {
  const used = collectIds(scene)
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

function normalizeAssetType(entry: AssetContainer | ModuleEntry): AddableObjectType | null {
  const type = entry.type as string
  if (type === 'glyph-group') return 'glyph'
  if (type === 'media') return 'video'
  if (
    type === 'video' ||
    type === 'image' ||
    type === 'audio' ||
    type === 'glyph' ||
    type === 'effect' ||
    type === 'component'
  ) {
    return type
  }
  return null
}

function sceneObjectTypeForAsset(entry: AssetContainer | ModuleEntry): SceneObjectType {
  const type = normalizeAssetType(entry)
  if (type === 'glyph') return 'glyph-group'
  if (type === 'video' || type === 'image' || type === 'audio' || type === 'effect' || type === 'component') {
    return type
  }
  return 'video'
}

function defaultPosition(scene: SceneJson, dropPos?: { x: number; y: number }): { x: number; y: number } {
  const stageW = scene.stage?.width || DEFAULT_STAGE_W
  const stageH = scene.stage?.height || DEFAULT_STAGE_H
  const px = dropPos?.x ?? stageW / 2
  const py = dropPos?.y ?? stageH / 2
  return {
    x: Number(((px / stageW) * 100).toFixed(2)),
    y: Number(((py / stageH) * 100).toFixed(2)),
  }
}

export function assetMatchesAddableType(entry: AssetContainer | ModuleEntry, type: AddableObjectType): boolean {
  return normalizeAssetType(entry) === type
}

export function getAssetsForAddableType(registry: Registry, type: AddableObjectType): Array<{
  id: string
  entry: AssetContainer | ModuleEntry
  path: string
}> {
  return Object.entries(registry)
    .filter(([, entry]) => assetMatchesAddableType(entry, type))
    .map(([id, entry]) => ({
      id,
      entry,
      path: 'file' in entry ? entry.file : entry.path,
    }))
}

export function createGroupObject(scene: SceneJson): Record<string, unknown> {
  return {
    id: uniqueId('group', scene),
    name: 'Group',
    type: 'group',
    transform: { mode: 'fill' },
    children: [],
  }
}

export function createTextObject(scene: SceneJson): Record<string, unknown> {
  const { x, y } = defaultPosition(scene)
  return {
    id: uniqueId('text', scene),
    name: 'Text',
    type: 'text',
    transform: { x, y, width: 'auto', height: 'auto', anchor: 'center' },
    appearance: { opacity: 1, blend: 'normal' },
    properties: {
      text: 'New Text',
      fontFamily: 'FolkPro',
      fontSize: 72,
      fontWeight: 700,
      color: '#ffffff',
      lineHeight: 1,
      letterSpacing: 0,
      textAlign: 'left',
      customCss: '',
    },
  }
}

export function createObjectFromAsset(
  assetId: string,
  entry: AssetContainer | ModuleEntry,
  scene: SceneJson,
  dropPos?: { x: number; y: number },
): Record<string, unknown> {
  const id = uniqueId(assetId, scene)
  const type = sceneObjectTypeForAsset(entry)
  const { x, y } = defaultPosition(scene, dropPos)

  switch (type) {
    case 'video':
    case 'image':
      return {
        id,
        type,
        asset: assetId,
        transform: { mode: 'fill' },
        appearance: { fit: 'cover', blend: 'normal', opacity: 1.0 },
      }
    case 'glyph-group':
      return {
        id,
        type,
        asset: assetId,
        transform: { x, y, width: 'auto', height: 'auto', anchor: dropPos ? 'top-left' : 'center' },
        properties: { scale: 0.18 },
      }
    case 'audio':
      return {
        id,
        type,
        asset: assetId,
        transform: { mode: 'fill' },
        properties: { volume: 1.0, loop: true, autoplay: true },
      }
    case 'effect':
      return { id, type, asset: assetId, transform: { mode: 'fill' }, appearance: { opacity: 1.0 } }
    case 'component':
      return {
        id,
        type,
        asset: assetId,
        transform: { x, y, width: 'auto', height: 'auto', anchor: dropPos ? 'top-left' : 'center' },
        properties: {},
      }
    default:
      return createGroupObject(scene)
  }
}
