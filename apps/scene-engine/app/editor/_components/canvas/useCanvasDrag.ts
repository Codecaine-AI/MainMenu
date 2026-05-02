import { useCallback, useEffect, useRef } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { pickScenePathAt } from '@/lib/hit-test'
import { resolveDragTarget } from '@/lib/drag-target'
import { applyDragDelta } from '@/lib/transform-units'
import type { TransformExplicit } from '@/types/scene'

interface DragState {
  targetPath: string
  startTransform: TransformExplicit
  startClientX: number
  startClientY: number
  rectWidth: number
  rectHeight: number
  moved: boolean
  onMove: (ev: MouseEvent) => void
  onUp: () => void
}

const MOVE_THRESHOLD = 3

export default function useCanvasDrag({
  stageRef,
}: {
  stageRef: React.RefObject<HTMLDivElement | null>
}): {
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void
  suppressNextClickRef: React.MutableRefObject<boolean>
} {
  const scene = useEditorStore((s) => s.scene)
  const mutateObjectAt = useEditorStore((s) => s.mutateObjectAt)

  const dragStateRef = useRef<DragState | null>(null)
  const suppressNextClickRef = useRef(false)

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      if (!scene || !stageRef.current) return

      const cmd = e.metaKey || e.ctrlKey
      const hitPath = pickScenePathAt(e, { cmd, stageEl: stageRef.current })
      if (!hitPath) return

      const target = resolveDragTarget(scene, hitPath)
      if (!target) return

      const rect = stageRef.current.getBoundingClientRect()

      const onMove = (ev: MouseEvent) => {
        const st = dragStateRef.current
        if (!st) return
        const dx = ev.clientX - st.startClientX
        const dy = ev.clientY - st.startClientY
        if (!st.moved && Math.hypot(dx, dy) < MOVE_THRESHOLD) return
        st.moved = true
        const next = applyDragDelta(st.startTransform, dx, dy, st.rectWidth, st.rectHeight)
        mutateObjectAt(st.targetPath, { transform: { x: next.x, y: next.y } })
      }

      const onUp = () => {
        const st = dragStateRef.current
        window.removeEventListener('mousemove', onMove)
        if (st?.moved) suppressNextClickRef.current = true
        dragStateRef.current = null
      }

      dragStateRef.current = {
        targetPath: target.path,
        startTransform: target.object.transform as TransformExplicit,
        startClientX: e.clientX,
        startClientY: e.clientY,
        rectWidth: rect.width,
        rectHeight: rect.height,
        moved: false,
        onMove,
        onUp,
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp, { once: true })
    },
    [scene, mutateObjectAt, stageRef],
  )

  useEffect(
    () => () => {
      const st = dragStateRef.current
      if (st) {
        window.removeEventListener('mousemove', st.onMove)
        window.removeEventListener('mouseup', st.onUp)
        dragStateRef.current = null
      }
    },
    [],
  )

  return { onMouseDown, suppressNextClickRef }
}
