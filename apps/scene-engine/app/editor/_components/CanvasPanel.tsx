'use client'

import { useEffect, useLayoutEffect, useRef, useCallback, useState, type CSSProperties } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { resolveObjectEl } from '@/lib/path'
import { createObjectFromAsset } from '@/lib/create-scene-object'
import type { SceneJson, Registry } from '@/types/scene'

const STAGE_W = 1440
const STAGE_H = 1080

interface FrameMetrics {
  width: number
  height: number
}

export function CanvasPanel() {
  const scene = useEditorStore((s) => s.scene)
  const selectedPath = useEditorStore((s) => s.selectedPath)
  const registry = useEditorStore((s) => s.registry)
  const addObjectAt = useEditorStore((s) => s.addObjectAt)
  const stageRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState<FrameMetrics | null>(null)
  const [isDropTarget, setIsDropTarget] = useState(false)

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

  useLayoutEffect(() => {
    if (!stageRef.current || !scene) return
    const stage = stageRef.current
    stage.querySelectorAll('.is-canvas-selected').forEach((el) => {
      el.classList.remove('is-canvas-selected')
    })
    if (!selectedPath) return
    const el = resolveObjectEl(scene as SceneJson, selectedPath, stage)
    if (el) el.classList.add('is-canvas-selected')
  }, [scene, selectedPath])

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
      <div className="editor-stage-frame" style={frameStyle}>
        <div
          ref={stageRef}
          style={{
            width: STAGE_W,
            height: STAGE_H,
            position: 'relative',
            transformOrigin: 'top left',
            background: '#000',
          }}
        />
      </div>
    </section>
  )
}
