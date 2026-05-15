import { useCallback, useEffect, useRef } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { resolveObject, resolveObjectEl } from '@/lib/path'
import { applyResizeDelta, type HandleId, type ResizeStart } from '@/lib/resize-math'
import { NAMED_X, NAMED_Y } from '@/lib/transform-units'
import type { SceneObject, TransformExplicit } from '@/types/scene'

const MOVE_THRESHOLD = 3

interface ResizeDragState {
  path: string
  handle: HandleId
  start: ResizeStart
  startClientX: number
  startClientY: number
  rectWidth: number
  rectHeight: number
  moved: boolean
  onMove: (ev: MouseEvent) => void
  onUp: () => void
}

function effAnchorOffsetX(transform: TransformExplicit): number {
  if (typeof transform.x === 'string' && transform.x in NAMED_X) {
    return NAMED_X[transform.x] / 100
  }
  const anchor = transform.anchor ?? 'top-left'
  if (anchor.includes('left')) return 0
  if (anchor.includes('right')) return 1
  return 0.5
}

function effAnchorOffsetY(transform: TransformExplicit): number {
  if (typeof transform.y === 'string' && transform.y in NAMED_Y) {
    return NAMED_Y[transform.y] / 100
  }
  const anchor = transform.anchor ?? 'top-left'
  if (anchor.includes('top')) return 0
  if (anchor.includes('bottom')) return 1
  return 0.5
}

export default function useCanvasResize({
  stageRef,
}: {
  stageRef: React.RefObject<HTMLDivElement | null>
}): {
  onHandleMouseDown: (handle: HandleId, e: React.MouseEvent<HTMLDivElement>) => void
  suppressNextClickRef: React.MutableRefObject<boolean>
} {
  const scene = useEditorStore((s) => s.scene)
  const selectedPath = useEditorStore((s) => s.selectedPath)
  const mutateObjectAt = useEditorStore((s) => s.mutateObjectAt)

  const dragStateRef = useRef<ResizeDragState | null>(null)
  const suppressNextClickRef = useRef(false)

  const onHandleMouseDown = useCallback(
    (handle: HandleId, e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation()
      if (e.button !== 0 || !scene || !selectedPath || !stageRef.current) return

      const el = resolveObjectEl(scene, selectedPath, stageRef.current)
      if (!el) return
      const target = resolveObject(scene, selectedPath) as SceneObject | null
      if (!target) return
      const transform = target.transform
      if ((transform as { mode?: string }).mode === 'fill') return
      const t = transform as TransformExplicit

      const rect = stageRef.current.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      const startX = typeof t.x === 'number' ? t.x : (NAMED_X[t.x] ?? 0)
      const startY = typeof t.y === 'number' ? t.y : (NAMED_Y[t.y] ?? 0)
      const startWidth =
        typeof t.width === 'number' ? t.width : (elRect.width / Math.max(rect.width, 1)) * 100
      const startHeight =
        typeof t.height === 'number' ? t.height : (elRect.height / Math.max(rect.height, 1)) * 100
      const anchorOffsetX = effAnchorOffsetX(t)
      const anchorOffsetY = effAnchorOffsetY(t)

      const onMove = (ev: MouseEvent) => {
        const st = dragStateRef.current
        if (!st) return
        const dx = ev.clientX - st.startClientX
        const dy = ev.clientY - st.startClientY
        if (!st.moved && Math.hypot(dx, dy) < MOVE_THRESHOLD) return
        st.moved = true
        const dxPct = (dx / Math.max(st.rectWidth, 1)) * 100
        const dyPct = (dy / Math.max(st.rectHeight, 1)) * 100
        const next = applyResizeDelta(st.start, st.handle, { dxPct, dyPct }, { aspectLock: ev.shiftKey })
        mutateObjectAt(st.path, {
          transform: { x: next.x, y: next.y, width: next.width, height: next.height },
        })
      }

      const onUp = () => {
        const st = dragStateRef.current
        window.removeEventListener('mousemove', onMove)
        if (st?.moved) suppressNextClickRef.current = true
        dragStateRef.current = null
      }

      dragStateRef.current = {
        path: selectedPath,
        handle,
        start: {
          x: startX,
          y: startY,
          width: startWidth,
          height: startHeight,
          anchorOffsetX,
          anchorOffsetY,
        },
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
    [scene, selectedPath, mutateObjectAt, stageRef],
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

  return { onHandleMouseDown, suppressNextClickRef }
}
