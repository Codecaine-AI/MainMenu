export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export interface ResizeStart {
  x: number
  y: number
  width: number
  height: number
  anchorOffsetX: number
  anchorOffsetY: number
}

export interface ResizeResult {
  x: number
  y: number
  width: number
  height: number
}

const MIN_SIZE = 1

/**
 * Compute a new x/y/width/height (all stage-percent, 2 decimals) for an
 * axis-aligned resize. The opposite edge of the dragged handle stays fixed in
 * stage coordinates. `anchorOffsetX`/`anchorOffsetY` are 0/0.5/1 mapping to
 * left/center/right (or top/center/bottom) — the start origin sits at
 * `(left + width * anchorOffsetX, top + height * anchorOffsetY)`. Edge
 * handles do single-axis resize; corners free-aspect by default and aspect-
 * locked when `options.aspectLock` is true. Min size clamped to 1% per axis.
 * v1 ignores rotation/scale.
 */
export function applyResizeDelta(
  start: ResizeStart,
  handle: HandleId,
  delta: { dxPct: number; dyPct: number },
  options?: { aspectLock?: boolean },
): ResizeResult {
  let left = start.x - start.width * start.anchorOffsetX
  let top = start.y - start.height * start.anchorOffsetY
  let right = left + start.width
  let bottom = top + start.height

  const movesWest = handle === 'nw' || handle === 'sw' || handle === 'w'
  const movesEast = handle === 'ne' || handle === 'se' || handle === 'e'
  const movesNorth = handle === 'nw' || handle === 'ne' || handle === 'n'
  const movesSouth = handle === 'sw' || handle === 'se' || handle === 's'

  if (movesWest) left += delta.dxPct
  if (movesEast) right += delta.dxPct
  if (movesNorth) top += delta.dyPct
  if (movesSouth) bottom += delta.dyPct

  if (options?.aspectLock && (movesWest || movesEast) && (movesNorth || movesSouth)) {
    const aspect = start.width / Math.max(start.height, MIN_SIZE)
    const w = right - left
    const h = bottom - top
    if (Math.abs(w - start.width) >= Math.abs((h - start.height) * aspect)) {
      const newH = w / aspect
      if (movesNorth) top = bottom - newH
      else bottom = top + newH
    } else {
      const newW = h * aspect
      if (movesWest) left = right - newW
      else right = left + newW
    }
  }

  if (right - left < MIN_SIZE) {
    if (movesWest) left = right - MIN_SIZE
    else right = left + MIN_SIZE
  }
  if (bottom - top < MIN_SIZE) {
    if (movesNorth) top = bottom - MIN_SIZE
    else bottom = top + MIN_SIZE
  }

  const newWidth = right - left
  const newHeight = bottom - top
  const newX = left + newWidth * start.anchorOffsetX
  const newY = top + newHeight * start.anchorOffsetY

  return {
    x: Number(newX.toFixed(2)),
    y: Number(newY.toFixed(2)),
    width: Number(newWidth.toFixed(2)),
    height: Number(newHeight.toFixed(2)),
  }
}
