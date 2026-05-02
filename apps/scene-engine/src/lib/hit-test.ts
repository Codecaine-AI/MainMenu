import { isBackgroundLikeEl } from './background-detect'

/**
 * Resolve a pointer event to a `data-scene-path` string.
 *
 * Returns the DEEPEST tagged path under the cursor (matches the
 * editor-store path format used by `parsePath` / `resolveObject`,
 * e.g. `"0"` or `"0.children.1.children.2"`).
 *
 * Filters run in this order against the deepest tagged ancestor chain:
 *   1. `isPathLocked` — runs unconditionally (cmd-click also skips
 *      locked layers). Walks past locked tagged ancestors until an
 *      unlocked one is found, or returns null if none.
 *   2. Background filter (gated by `!cmd`) — when `stageEl` is provided,
 *      fullscreen background-like ancestors are skipped so plain clicks
 *      fall through to foreground layers. `cmd: true` bypasses this.
 *
 * Hidden layers (`visible:false`) aren't in the DOM (top-level) or
 * have `display:none` (glyph-group sub-layers), so `elementFromPoint`
 * skips them without needing an explicit filter here.
 */

export type PickOptions = {
  cmd?: boolean
  stageEl?: HTMLElement
  isPathLocked?: (path: string) => boolean
}

export function pickScenePathAt(
  event: { clientX: number; clientY: number },
  options?: PickOptions,
): string | null {
  if (typeof document === 'undefined') return null
  const initial = document.elementFromPoint(event.clientX, event.clientY)
  let el: HTMLElement | null = (initial as Element | null)?.closest<HTMLElement>('[data-scene-path]') ?? null
  if (!el) return null

  if (options?.isPathLocked) {
    while (el && options.isPathLocked(el.dataset.scenePath ?? '')) {
      el = el.parentElement?.closest<HTMLElement>('[data-scene-path]') ?? null
    }
    if (!el) return null
  }

  if (options?.stageEl && !options.cmd) {
    while (el && isBackgroundLikeEl(el, options.stageEl)) {
      el = el.parentElement?.closest<HTMLElement>('[data-scene-path]') ?? null
    }
  }

  if (!el) return null
  const path = el.dataset.scenePath
  if (path == null || path === '') return null
  return path
}
