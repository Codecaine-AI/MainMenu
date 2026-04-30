import type { SceneJson } from '@/types/scene'

export function resolveLayer(
  scene: SceneJson,
  path: string,
): Record<string, unknown> | null {
  const parts = path.split('.children.').map(Number)
  let current: Record<string, unknown> = scene.objects[parts[0]] as unknown as Record<string, unknown>
  if (!current) return null
  for (let i = 1; i < parts.length; i++) {
    const children = current.children as Record<string, unknown>[] | undefined
    if (!children) return null
    current = children[parts[i]]
    if (!current) return null
  }
  return current
}

export function resolveLayerEl(
  scene: SceneJson,
  path: string,
  stage: HTMLElement,
): HTMLElement | null {
  const parts = path.split('.children.').map(Number)
  const topLayerEls = stage.querySelectorAll<HTMLElement>(':scope > [data-layer-id]')
  const topEl = topLayerEls[parts[0]]
  if (!topEl || parts.length === 1) return topEl ?? null

  let currentLayer: Record<string, unknown> = scene.objects[parts[0]] as unknown as Record<string, unknown>
  let currentEl: Element = topEl

  for (let depth = 1; depth < parts.length; depth++) {
    const childIndex = parts[depth]
    const children = (currentLayer.children ?? []) as Record<string, unknown>[]
    const child = children[childIndex]
    if (!child) return null

    if (child.layer) {
      const svg = currentEl.querySelector('svg')
      if (!svg) return null
      const match = svg.querySelector(`[data-layer="${child.layer}"]`)
      if (match) {
        currentEl = match
        currentLayer = child
        continue
      }
    }

    if (child.type) {
      let foreignIndex = 0
      for (let i = 0; i < childIndex; i++) {
        if (children[i] && children[i].type) foreignIndex++
      }
      const foreignObjects = currentEl.querySelectorAll(':scope > svg > foreignObject')
        ?? currentEl.querySelectorAll('svg > foreignObject')
      const fo = foreignObjects[foreignIndex]
      if (fo) {
        currentEl = fo as Element
        currentLayer = child
        continue
      }
    }

    return null
  }

  return currentEl as HTMLElement
}
