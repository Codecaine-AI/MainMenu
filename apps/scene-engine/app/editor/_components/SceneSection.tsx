'use client'

import { useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { NUMERIC_PROPERTY_STEPS } from '@/lib/inspector-config'
import type { SceneJson, Appearance } from '@/types/scene'
import { RangedInput } from './inputs/RangedInput'
import { InspectorSection, FieldRow } from './inputs/InspectorSection'

interface Props {
  projectId: string | null
  sceneId: string
}

export function SceneSection({ projectId, sceneId }: Props) {
  const scene = useEditorStore((s) => s.scene) as SceneJson | null
  const dirty = useEditorStore((s) => s.dirty)
  const markClean = useEditorStore((s) => s.markClean)
  const mutateScene = useEditorStore((s) => s.mutateScene)
  const [exporting, setExporting] = useState(false)

  if (!scene) return null

  const appearance = (scene.appearance ?? {}) as Appearance

  function commitAppearance(key: string, value: unknown) {
    mutateScene({ appearance: { ...appearance, [key]: value } })
  }

  async function handleSave() {
    if (!scene) return
    try {
      const projectQuery = projectId ? `?project=${encodeURIComponent(projectId)}` : ''
      const res = await fetch(`/api/scenes/${sceneId}${projectQuery}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scene),
      })
      if (!res.ok) throw new Error(`Save failed: ${res.status}`)
      markClean()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed')
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const projectQuery = projectId ? `?project=${encodeURIComponent(projectId)}` : ''
      const res = await fetch(`/api/export${projectQuery}`, { method: 'POST' })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Export failed: ${res.status} ${text}`)
      }
      const blob = await res.blob()
      const header = res.headers.get('Content-Disposition')
      const match = header?.match(/filename="?([^"]+)"?/i)
      const filename = match ? match[1] : 'project.zip'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="text-[12px] font-mono border-b border-[#2a2a2a] pb-2 mb-2">
      <div className="flex items-center gap-2 mb-2 px-1 pt-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 truncate flex-1">
          Scene Settings
        </span>
        <span
          className={`w-2 h-2 rounded-full shrink-0 border ${
            dirty
              ? 'bg-[#ffd84d] border-[#ffd84d] shadow-[0_0_0_2px_rgba(255,216,77,0.18)]'
              : 'bg-transparent border-[#444]'
          }`}
        />
      </div>

      <InspectorSection title="Scene Details" collapsible defaultOpen={false}>
        <FieldRow label="ID">
          <span className="text-gray-300 truncate">{scene.id}</span>
        </FieldRow>
        <FieldRow label="Stage">
          <span className="text-gray-300">
            {scene.stage.width} x {scene.stage.height}
          </span>
        </FieldRow>
      </InspectorSection>

      <InspectorSection title="Appearance" collapsible defaultOpen={false}>
        <FieldRow label="Opacity">
          <RangedInput
            value={appearance.opacity ?? 1}
            {...NUMERIC_PROPERTY_STEPS.opacity}
            onChange={(v) => commitAppearance('opacity', v)}
          />
        </FieldRow>
        <FieldRow label="Hue">
          <RangedInput
            value={appearance.hue ?? 0}
            {...NUMERIC_PROPERTY_STEPS.hue}
            onChange={(v) => commitAppearance('hue', v)}
          />
        </FieldRow>
        <FieldRow label="Saturation">
          <RangedInput
            value={appearance.saturation ?? 1}
            min={0} max={2} step={0.01}
            onChange={(v) => commitAppearance('saturation', v)}
          />
        </FieldRow>
      </InspectorSection>

      <div className="mt-2 flex gap-1.5">
        <button
          onClick={handleSave}
          disabled={!dirty}
          className={`flex-1 px-2 py-1.5 rounded-sm text-xs border cursor-pointer ${
            dirty
              ? 'bg-[#173247] text-[#cfe6ff] border-[#2a6da3] hover:bg-[#1d3d54]'
              : 'bg-[#222] text-gray-300 border-[#333] opacity-40 cursor-not-allowed'
          }`}
        >
          Save
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex-1 bg-[#222] text-gray-300 border border-[#333] px-2 py-1.5 rounded-sm text-xs cursor-pointer hover:bg-[#2a2a2a] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {exporting ? 'Exporting...' : 'Export'}
        </button>
      </div>
    </div>
  )
}
