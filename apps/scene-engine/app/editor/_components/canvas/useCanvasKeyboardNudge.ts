import { useEffect } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { resolveObject } from '@/lib/path'
import { NAMED_X, NAMED_Y } from '@/lib/transform-units'
import type { SceneObject, TransformExplicit } from '@/types/scene'

const STEP = 1
const SHIFT_STEP = 5

function isEditableTarget(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLElement &&
    (t.tagName === 'INPUT' ||
      t.tagName === 'TEXTAREA' ||
      t.tagName === 'SELECT' ||
      t.isContentEditable)
  )
}

export default function useCanvasKeyboardNudge(): void {
  const scene = useEditorStore((s) => s.scene)
  const selectedPath = useEditorStore((s) => s.selectedPath)
  const mutateObjectAt = useEditorStore((s) => s.mutateObjectAt)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!scene || !selectedPath) return
      if (isEditableTarget(e.target)) return

      let dx = 0
      let dy = 0
      switch (e.key) {
        case 'ArrowLeft':
          dx = -1
          break
        case 'ArrowRight':
          dx = 1
          break
        case 'ArrowUp':
          dy = -1
          break
        case 'ArrowDown':
          dy = 1
          break
        default:
          return
      }

      const target = resolveObject(scene, selectedPath) as SceneObject | null
      if (!target) return
      const transform = target.transform
      if ((transform as { mode?: string }).mode === 'fill') return
      const t = transform as TransformExplicit

      e.preventDefault()
      const step = e.shiftKey ? SHIFT_STEP : STEP
      const curX = typeof t.x === 'number' ? t.x : NAMED_X[t.x] ?? 0
      const curY = typeof t.y === 'number' ? t.y : NAMED_Y[t.y] ?? 0
      const patch: { x?: number; y?: number } = {}
      if (dx !== 0) patch.x = Number((curX + dx * step).toFixed(2))
      if (dy !== 0) patch.y = Number((curY + dy * step).toFixed(2))
      mutateObjectAt(selectedPath, { transform: patch })
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scene, selectedPath, mutateObjectAt])
}
