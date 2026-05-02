import type { TransformExplicit, TransformX, TransformY } from '@/types/scene'

const NAMED_X: Record<string, number> = { left: 0, center: 50, right: 100 }
const NAMED_Y: Record<string, number> = { top: 0, center: 50, middle: 50, bottom: 100 }
const MOVED_THRESHOLD = 0.01

function resolveAxis(value: number | string, named: Record<string, number>): number {
  if (typeof value === 'number') return value
  return named[value] ?? 0
}

/**
 * Apply a screen-pixel pointer delta to a transform's x/y, returning new
 * stage-relative percent values. Named-anchor strings (`'center'`, etc.) persist
 * on any axis whose absolute delta is below `MOVED_THRESHOLD` (0.01%) so a purely
 * vertical drag preserves an `x: 'center'` authoring intent. Numeric output is
 * rounded to 2 decimals to match `defaultPosition` in `create-scene-object.ts`.
 */
export function applyDragDelta(
  transform: TransformExplicit,
  deltaPxX: number,
  deltaPxY: number,
  stageRectWidth: number,
  stageRectHeight: number,
): { x: TransformX; y: TransformY } {
  const deltaPctX = (deltaPxX / Math.max(stageRectWidth, 1)) * 100
  const deltaPctY = (deltaPxY / Math.max(stageRectHeight, 1)) * 100

  const x: TransformX =
    typeof transform.x === 'string' && Math.abs(deltaPctX) < MOVED_THRESHOLD
      ? transform.x
      : Number((resolveAxis(transform.x, NAMED_X) + deltaPctX).toFixed(2))

  const y: TransformY =
    typeof transform.y === 'string' && Math.abs(deltaPctY) < MOVED_THRESHOLD
      ? transform.y
      : Number((resolveAxis(transform.y, NAMED_Y) + deltaPctY).toFixed(2))

  return { x, y }
}
