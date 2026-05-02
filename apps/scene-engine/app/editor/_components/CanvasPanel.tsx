'use client'

import { useEffect, useRef, useCallback, useState, type CSSProperties } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { pickScenePathAt } from '@/lib/hit-test'
import { createObjectFromAsset } from '@/lib/create-scene-object'
import useCanvasDrag from './canvas/useCanvasDrag'
import useCanvasResize from './canvas/useCanvasResize'
import useSelectionBox from './canvas/useSelectionBox'
import SelectionOverlay from './canvas/SelectionOverlay'
import type { SceneJson, Registry } from '@/types/scene'

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
  const addObjectAt = useEditorStore((s) => s.addObjectAt)
  const setSelectedPath = useEditorStore((s) => s.setSelectedPath)
  const drillCursor = useEditorStore((s) => s.drillCursor)
  const setDrillCursor = useEditorStore((s) => s.setDrillCursor)
  const stageRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState<FrameMetrics | null>(null)
  const [isDropTarget, setIsDropTarget] = useState(false)
  const { onMouseDown: handleStageMouseDown, suppressNextClickRef } = useCanvasDrag({ stageRef })
  const { onHandleMouseDown, suppressNextClickRef: resizeSuppressRef } = useCanvasResize({ stageRef })
  const selectionBox = useSelectionBox({ stageRef, frameRef, scene: scene as SceneJson | null, selectedPath })

  useEffect(() => {
    if (!scene || !stageRef.current) return
    let cancelled = false
    import('@/renderer/scene-renderer').then(({ renderScene }) => {
      if (!cancelled && stageRef.current) {
        renderScene(scene, stageRef.current)
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
      const path = pickScenePathAt(e, { cmd, stageEl: stageRef.current ?? undefined })
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
    [setSelectedPath, setDrillCursor, drillCursor, selectedPath, suppressNextClickRef, resizeSuppressRef],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/x-asset-id')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDropTarget(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const panel = panelRef.current
    if (!panel) return
    if (e.target === panel || !panel.contains(e.relatedTarget as Node)) {
      setIsDropTarget(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      setIsDropTarget(false)
      const assetId = e.dataTransfer.getData('application/x-asset-id') || e.dataTransfer.getData('text/plain')
      if (!assetId || !scene || !registry) return
      const entry = (registry as Registry)[assetId]
      if (!entry) return
      e.preventDefault()
      const stage = stageRef.current
      if (!stage) return
      const rect = stage.getBoundingClientRect()
      const scaleX = rect.width === 0 ? 1 : rect.width / STAGE_W
      const scaleY = rect.height === 0 ? 1 : rect.height / STAGE_H
      const x = Math.max(0, Math.min(STAGE_W, Math.round((e.clientX - rect.left) / scaleX)))
      const y = Math.max(0, Math.min(STAGE_H, Math.round((e.clientY - rect.top) / scaleY)))
      const newLayer = createObjectFromAsset(assetId, entry, scene as SceneJson, { x, y })
      addObjectAt('', scene.objects?.length ?? 0, newLayer)
    },
    [scene, registry, addObjectAt],
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
      className={`bg-black relative overflow-hidden grid place-items-center ${isDropTarget ? 'after:content-[""] after:absolute after:inset-1 after:border-2 after:border-dashed after:border-[#ffd84d] after:pointer-events-none after:rounded' : ''}`}
      style={{ gridArea: 'canvas' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
