'use client'

import { useEffect, useLayoutEffect, useRef, useCallback, useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { resolveLayerEl } from '@/lib/path'
import type { SceneJson, Registry, AssetContainer, ModuleEntry } from '@/types/scene'

const STAGE_W = 1440
const STAGE_H = 1080

function collectIds(scene: SceneJson): Set<string> {
  const set = new Set<string>()
  const walk = (objects: Record<string, unknown>[]) => {
    for (const l of objects) {
      if (l.id) set.add(l.id as string)
      if (l.children) walk(l.children as Record<string, unknown>[])
    }
  }
  walk(scene.objects as unknown as Record<string, unknown>[])
  return set
}

function uniqueId(base: string, scene: SceneJson): string {
  const used = collectIds(scene)
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

function buildLayer(
  assetId: string,
  entry: AssetContainer | ModuleEntry,
  dropPos: { x: number; y: number },
  scene: SceneJson,
): Record<string, unknown> {
  const id = uniqueId(assetId, scene)
  switch (entry.type) {
    case 'video':
    case 'image':
      return { id, type: entry.type, asset: assetId, properties: { fit: 'cover', blend: 'normal', opacity: 1.0 } }
    case 'glyph':
      return { id, type: 'glyph-group', asset: assetId, position: { x: dropPos.x, y: dropPos.y }, properties: { scale: 0.18 } }
    case 'audio':
      return { id, type: 'audio', asset: assetId, properties: { volume: 1.0, loop: true, autoplay: true } }
    case 'effect':
      return { id, type: 'effect', asset: assetId, properties: { opacity: 1.0 } }
    case 'component':
      return { id, type: 'component', asset: assetId, position: { x: dropPos.x, y: dropPos.y }, properties: {} }
  }
}

export function CanvasPanel() {
  const scene = useEditorStore((s) => s.scene)
  const selectedPath = useEditorStore((s) => s.selectedPath)
  const registry = useEditorStore((s) => s.registry)
  const addLayerAt = useEditorStore((s) => s.addLayerAt)
  const stageRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
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
    const el = resolveLayerEl(scene as SceneJson, selectedPath, stage)
    if (el) el.classList.add('is-canvas-selected')
  }, [scene, selectedPath])

  const fitStage = useCallback(() => {
    if (!panelRef.current || !stageRef.current) return
    const { clientWidth: w, clientHeight: h } = panelRef.current
    const scale = Math.min(w / STAGE_W, h / STAGE_H)
    stageRef.current.style.transform = `scale(${scale})`
  }, [])

  useEffect(() => {
    if (!panelRef.current) return
    const obs = new ResizeObserver(fitStage)
    obs.observe(panelRef.current)
    fitStage()
    return () => obs.disconnect()
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
      const newLayer = buildLayer(assetId, entry, { x, y }, scene as SceneJson)
      addLayerAt('', scene.objects?.length ?? 0, newLayer)
    },
    [scene, registry, addLayerAt],
  )

  return (
    <section
      ref={panelRef}
      className={`bg-black relative overflow-hidden grid place-items-center ${isDropTarget ? 'after:content-[""] after:absolute after:inset-1 after:border-2 after:border-dashed after:border-[#ffd84d] after:pointer-events-none after:rounded' : ''}`}
      style={{ gridArea: 'canvas' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        ref={stageRef}
        style={{
          width: STAGE_W,
          height: STAGE_H,
          position: 'relative',
          transformOrigin: 'center center',
          background: '#000',
        }}
      />
    </section>
  )
}
