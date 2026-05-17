import { resolveObject } from './path'
import type { SceneJson, SceneObject } from '@/types/scene'

export interface DragTarget {
  path: string
  object: SceneObject
}

/**
 * Resolve which scene object should actually move when a drag begins on `hitPath`.
 *
 * Two-tier rule: walk ancestors from deepest to shallowest; the first `glyph-group`
 * wins (children are not independently positionable). If no glyph-group ancestor
 * exists, the hit itself is the target. Returns null if the hit is unresolvable
 * or if the resolved target's transform is `mode: 'fill'` (fill-mode is undraggable).
 */
export function resolveDragTarget(scene: SceneJson, hitPath: string): DragTarget | null {
  const parts = hitPath.split('.children.').map(Number)
  if (parts.some((n) => Number.isNaN(n))) return null

  let resolved: DragTarget | null = null
  for (let n = parts.length; n >= 1; n--) {
    const prefixPath = parts.slice(0, n).join('.children.')
    const obj = resolveObject(scene, prefixPath) as unknown as SceneObject | null
    if (!obj) continue
    if (obj.type === 'glyph-group') {
      resolved = { path: prefixPath, object: obj }
      break
    }
  }

  if (!resolved) {
    const hit = resolveObject(scene, hitPath) as unknown as SceneObject | null
    if (!hit) return null
    resolved = { path: hitPath, object: hit }
  }

  if (resolved.object.transform && (resolved.object.transform as { mode?: string }).mode === 'fill') {
    return null
  }

  return resolved
}
