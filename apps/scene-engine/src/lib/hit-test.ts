/**
 * Resolve a pointer event to a `data-scene-path` string.
 *
 * The returned string matches the editor-store path format used by
 * `parsePath` / `resolveObject`, e.g. `"0"` (top-level layer 0) or
 * `"0.children.1.children.2"` (nested child).
 *
 * `topLevelOnly` defaults to true: the path is sliced to its first
 * segment so callers in CP1 always select the top-level layer. CP2
 * passes `false` to enable drill-in.
 */

export type PickOptions = { topLevelOnly?: boolean }

export function pickScenePathAt(
  event: { clientX: number; clientY: number },
  options?: PickOptions,
): string | null {
  if (typeof document === 'undefined') return null
  const el = document.elementFromPoint(event.clientX, event.clientY)
  if (!el) return null
  const tagged = (el as Element).closest<HTMLElement>('[data-scene-path]')
  if (!tagged) return null
  const path = tagged.dataset.scenePath
  if (path == null || path === '') return null
  if (options?.topLevelOnly === false) return path
  return path.split('.children.')[0]
}
