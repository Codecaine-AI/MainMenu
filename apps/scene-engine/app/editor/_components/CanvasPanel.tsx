'use client'

import { useEffect, useRef, useCallback, useState, type CSSProperties } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { pickScenePathAt } from '@/lib/hit-test'
import { isPathLocked } from '@/lib/path'
import useCanvasDrag from './canvas/useCanvasDrag'
import useCanvasResize from './canvas/useCanvasResize'
import useSelectionBox from './canvas/useSelectionBox'
import useCanvasKeyboardNudge from './canvas/useCanvasKeyboardNudge'
import SelectionOverlay from './canvas/SelectionOverlay'
import type { SceneJson } from '@/types/scene'

const STAGE_W = 1440
const STAGE_H = 1080

interface FrameMetrics {
  width: number
  height: number
}

function buildHitStack(path: string): string[] {
  const parts = path.split('.children.')
  const stack: string[] = []
  let acc = ''
  for (let i = 0; i < parts.length; i++) {
    acc = i === 0 ? parts[0] : `${acc}.children.${parts[i]}`
    stack.push(acc)
  }
  return stack
}

export function CanvasPanel() {
  const scene = useEditorStore((s) => s.scene)
  const selectedPath = useEditorStore((s) => s.selectedPath)
  const registry = useEditorStore((s) => s.registry)
  const setSelectedPath = useEditorStore((s) => s.setSelectedPath)
  const drillCursor = useEditorStore((s) => s.drillCursor)
  const setDrillCursor = useEditorStore((s) => s.setDrillCursor)
  const stageRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState<FrameMetrics | null>(null)
  const { onMouseDown: handleStageMouseDown, suppressNextClickRef } = useCanvasDrag({ stageRef })
  const { onHandleMouseDown, suppressNextClickRef: resizeSuppressRef } = useCanvasResize({ stageRef })
  const selectionBox = useSelectionBox({ stageRef, frameRef, scene: scene as SceneJson | null, selectedPath })
  useCanvasKeyboardNudge()

  useEffect(() => {
    if (!scene || !stageRef.current) return
    let cancelled = false
    import('@/renderer/scene-renderer').then(({ renderScene }) => {
      if (!cancelled && stageRef.current) {
        renderScene(scene, stageRef.current, { events: false })
      }
    })
    return () => { cancelled = true }
  }, [scene, registry])

  const fitStage = useCallback(() => {
    if (!panelRef.current || !stageRef.current) return

    const panel = panelRef.current
    const scale = Math.min(panel.clientWidth / STAGE_W, panel.clientHeight / STAGE_H)
    const width = STAGE_W * scale
    const height = STAGE_H * scale

    stageRef.current.style.transform = `scale(${scale})`
    setFrame({
      width,
      height,
    })
  }, [])

  useEffect(() => {
    if (!panelRef.current) return
    const obs = new ResizeObserver(fitStage)
    obs.observe(panelRef.current)
    window.addEventListener('resize', fitStage)
    fitStage()
    return () => {
      obs.disconnect()
      window.removeEventListener('resize', fitStage)
    }
  }, [fitStage])

  const handleStageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (suppressNextClickRef.current || resizeSuppressRef.current) {
        suppressNextClickRef.current = false
        resizeSuppressRef.current = false
        return
      }
      const cmd = e.metaKey || e.ctrlKey
      const isLocked = (p: string) => (scene ? isPathLocked(scene as SceneJson, p) : false)
      const path = pickScenePathAt(e, { cmd, stageEl: stageRef.current ?? undefined, isPathLocked: isLocked })
      if (!path) {
        setSelectedPath(null)
        setDrillCursor(null)
        return
      }
      const stack = buildHitStack(path)
      const sameSpot =
        drillCursor != null &&
        Math.abs(e.clientX - drillCursor.x) <= 3 &&
        Math.abs(e.clientY - drillCursor.y) <= 3
      const idx = sameSpot && selectedPath ? stack.indexOf(selectedPath) : -1
      const depth = idx >= 0 ? Math.min(idx + 1, stack.length - 1) : 0
      setSelectedPath(stack[depth])
      setDrillCursor({ x: e.clientX, y: e.clientY })
    },
    [setSelectedPath, setDrillCursor, drillCursor, selectedPath, suppressNextClickRef, resizeSuppressRef, scene],
  )

  const frameStyle: CSSProperties = frame
    ? {
        width: frame.width,
        height: frame.height,
      }
    : {
        left: '50%',
        top: '50%',
        width: 0,
        height: 0,
        transform: 'translate(-50%, -50%)',
      }

  return (
    <section
      ref={panelRef}
      className="bg-black relative overflow-hidden grid place-items-center"
      style={{ gridArea: 'canvas' }}
    >
      <div className="editor-stage-frame" ref={frameRef} style={frameStyle}>
        <div
          ref={stageRef}
          onMouseDown={handleStageMouseDown}
          onClick={handleStageClick}
          style={{
            width: STAGE_W,
            height: STAGE_H,
            position: 'relative',
            transformOrigin: 'top left',
            background: '#000',
          }}
        />
        <SelectionOverlay box={selectionBox} onHandleMouseDown={onHandleMouseDown} />
      </div>
    </section>
  )
}
