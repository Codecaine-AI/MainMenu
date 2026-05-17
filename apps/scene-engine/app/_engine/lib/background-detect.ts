/**
 * True when `el` covers ≥ `threshold` of the stage area in screen space.
 *
 * Both rects come from `getBoundingClientRect()`, so the editor's CSS scale
 * on the stage cancels out — the comparison is independent of zoom level.
 * Default threshold of 0.95 matches the spec's "fullscreen background"
 * heuristic: a layer that fills (almost) the entire stage is treated as
 * background and skipped by plain canvas clicks (cmd-click overrides).
 */
export function isBackgroundLikeEl(
  el: Element,
  stageEl: HTMLElement,
  threshold?: number,
): boolean {
  const elRect = el.getBoundingClientRect()
  const stageRect = stageEl.getBoundingClientRect()
  const stageArea = Math.max(stageRect.width * stageRect.height, 1)
  const coverage = (elRect.width * elRect.height) / stageArea
  return coverage >= (threshold ?? 0.95)
}
