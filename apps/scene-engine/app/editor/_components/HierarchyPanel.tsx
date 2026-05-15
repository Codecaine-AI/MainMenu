'use client'

import { useState, useCallback } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { resolveObject } from '@/lib/path'
import type { Registry, SceneJson } from '@/types/scene'
import { HierarchyRow } from './HierarchyRow'
import { SceneSection } from './SceneSection'
import { AddLayerDialog } from './AddLayerDialog'

interface Props {
  sceneId: string
}

function computeRegion(e: React.DragEvent, row: HTMLElement, isGroup: boolean): 'before' | 'after' | 'into' {
  const rect = row.getBoundingClientRect()
  const y = e.clientY - rect.top
  const h = rect.height
  if (isGroup) {
    if (y < h * 0.25) return 'before'
    if (y > h * 0.75) return 'after'
    return 'into'
  }
  return y < h / 2 ? 'before' : 'after'
}

function regionToToPath(targetPath: string, region: string, scene: SceneJson): string {
  if (region === 'into') {
    const layer = resolveObject(scene, targetPath)
    const childCount = Array.isArray(layer?.children) ? (layer!.children as unknown[]).length : 0
    return `${targetPath}.children.${childCount}`
  }
  if (region === 'before') return targetPath
  const parts = targetPath.split('.children.')
  const lastIndex = Number(parts[parts.length - 1])
  parts[parts.length - 1] = String(lastIndex + 1)
  return parts.join('.children.')
}

export function HierarchyPanel({ sceneId }: Props) {
  const scene = useEditorStore((s) => s.scene)
  const registry = useEditorStore((s) => s.registry) as Registry | null
  const selectedPath = useEditorStore((s) => s.selectedPath)
  const setSelectedPath = useEditorStore((s) => s.setSelectedPath)
  const addObjectAt = useEditorStore((s) => s.addObjectAt)
  const moveObject = useEditorStore((s) => s.moveObject)
  const mutateObjectAt = useEditorStore((s) => s.mutateObjectAt)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dropIndicator, setDropIndicator] = useState<{ path: string; region: string } | null>(null)
  const [addTarget, setAddTarget] = useState<{ parentPath: string; insertIndex: number } | null>(null)

  const handleToggle = useCallback((path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const handleDragStart = useCallback((e: React.DragEvent, path: string) => {
    e.dataTransfer.setData('application/x-layer-path', path)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const openTopLevelAdd = useCallback(() => {
    setAddTarget({ parentPath: '', insertIndex: scene?.objects?.length ?? 0 })
  }, [scene])

  const openChildAdd = useCallback(
    (path: string) => {
      const object = scene ? resolveObject(scene as SceneJson, path) : null
      const childCount = Array.isArray(object?.children) ? (object!.children as unknown[]).length : 0
      setCollapsed((prev) => {
        const next = new Set(prev)
        next.delete(path)
        return next
      })
      setAddTarget({ parentPath: path, insertIndex: childCount })
    },
    [scene],
  )

  const handleAddObject = useCallback(
    (object: Record<string, unknown>, parentPath: string, insertIndex: number) => {
      addObjectAt(parentPath, insertIndex, object)
      setSelectedPath(parentPath === '' ? String(insertIndex) : `${parentPath}.children.${insertIndex}`)
      setAddTarget(null)
    },
    [addObjectAt, setSelectedPath],
  )

  const handleToggleLock = useCallback(
    (path: string) => {
      if (!scene) return
      const layer = resolveObject(scene as SceneJson, path)
      const next = layer?.locked === true ? false : true
      mutateObjectAt(path, { locked: next })
    },
    [scene, mutateObjectAt],
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent, path: string) => {
      if (!e.dataTransfer.types.includes('application/x-layer-path')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      const row = (e.target as HTMLElement).closest('[data-path]') as HTMLElement | null
      if (!row || !scene) return
      const layer = resolveObject(scene as SceneJson, path)
      const isGroup = Array.isArray(layer?.children)
      const region = computeRegion(e, row, isGroup)
      setDropIndicator({ path, region })
    },
    [scene],
  )

  const handleDragLeave = useCallback(() => {
    setDropIndicator(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, targetPath: string) => {
      e.preventDefault()
      setDropIndicator(null)
      const fromPath = e.dataTransfer.getData('application/x-layer-path')
      if (!fromPath || !scene) return
      const row = (e.target as HTMLElement).closest('[data-path]') as HTMLElement | null
      if (!row) return
      const layer = resolveObject(scene as SceneJson, targetPath)
      const isGroup = Array.isArray(layer?.children)
      const region = computeRegion(e, row, isGroup)
      const toPath = regionToToPath(targetPath, region, scene as SceneJson)
      moveObject(fromPath, toPath)
    },
    [scene, moveObject],
  )

  if (!scene) {
    return (
      <section className="bg-[#1a1a1a] overflow-auto p-2" style={{ gridArea: 'hierarchy' }}>
        <h3 className="text-[13px] uppercase tracking-wide text-gray-100 font-bold mb-2">Globals</h3>
        <p className="text-gray-600 text-xs italic mb-3">Loading...</p>
        <h3 className="text-[13px] uppercase tracking-wide text-gray-100 font-bold mb-2">Hierarchy</h3>
        <p className="text-gray-600 text-xs italic">Loading...</p>
      </section>
    )
  }

  return (
    <section className="bg-[#1a1a1a] overflow-auto p-2" style={{ gridArea: 'hierarchy' }}>
      <SceneSection sceneId={sceneId} />
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="m-0 text-[13px] uppercase tracking-wide text-gray-100 font-bold">Hierarchy</h3>
        <button
          type="button"
          onClick={openTopLevelAdd}
          className="h-5 w-5 border border-[#4a4a4a] bg-[#242424] text-sm leading-none text-gray-100 hover:bg-[#303030] active:translate-y-px"
          aria-label="Add top-level layer"
        >
          +
        </button>
      </div>
      <ul className="list-none p-0 m-0">
        {(scene.objects as unknown as Record<string, unknown>[]).map((layer, i) => {
          const path = String(i)
          return (
            <HierarchyRow
              key={path}
              layer={layer}
              path={path}
              depth={0}
              isSelected={selectedPath === path}
              isCollapsed={collapsed.has(path)}
              onSelect={setSelectedPath}
              onToggle={handleToggle}
              onAddChild={openChildAdd}
              onToggleLock={handleToggleLock}
              collapsedSet={collapsed}
              selectedPath={selectedPath}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              dropIndicator={dropIndicator}
            />
          )
        })}
      </ul>
      {addTarget && (
        <AddLayerDialog
          scene={scene as SceneJson}
          registry={registry}
          parentPath={addTarget.parentPath}
          insertIndex={addTarget.insertIndex}
          onAdd={handleAddObject}
          onClose={() => setAddTarget(null)}
        />
      )}
    </section>
  )
}
