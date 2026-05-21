'use client'

import { useEditorStore } from '@/store/editor-store'
import { NUMERIC_PROPERTY_STEPS } from '@/lib/inspector-config'
import type { SceneJson, Appearance } from '@/types/scene'
import { RangedInput } from './inputs/RangedInput'
import { InspectorSection, FieldRow } from './inputs/InspectorSection'

interface Props {
  projectId: string | null
  sceneId: string
}

export function SceneSettingsSection() {
  const scene = useEditorStore((s) => s.scene) as SceneJson | null
  const mutateScene = useEditorStore((s) => s.mutateScene)

  if (!scene) return null

  const appearance = (scene.appearance ?? {}) as Appearance

  function commitAppearance(key: string, value: unknown) {
    mutateScene({ appearance: { ...appearance, [key]: value } })
  }

  return (
    <div className="mb-2 border-b border-[#2f2f2f] pb-2 text-[12px] font-mono">
      <InspectorSection title="Scene Settings" collapsible defaultOpen={false}>
        <FieldRow label="ID">
          <span className="text-gray-300 truncate">{scene.id}</span>
        </FieldRow>
        <FieldRow label="Stage">
          <span className="text-gray-300">
            {scene.stage.width} x {scene.stage.height}
          </span>
        </FieldRow>
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
            min={0}
            max={2}
            step={0.01}
            onChange={(v) => commitAppearance('saturation', v)}
          />
        </FieldRow>
      </InspectorSection>
    </div>
  )
}

export function SceneSaveControls({ projectId, sceneId }: Props) {
  const scene = useEditorStore((s) => s.scene) as SceneJson | null
  const dirty = useEditorStore((s) => s.dirty)
  const markClean = useEditorStore((s) => s.markClean)

  if (!scene) return null

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

  return (
    <div className="mt-3 border-t border-[#2a2a2a] pt-2 text-[12px] font-mono">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {dirty ? 'Unsaved scene changes' : 'Scene saved'}
        </span>
        <span
          className={`w-2 h-2 rounded-full shrink-0 border ${
            dirty
              ? 'bg-[#ffd84d] border-[#ffd84d] shadow-[0_0_0_2px_rgba(255,216,77,0.18)]'
              : 'bg-transparent border-[#444]'
          }`}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={!dirty}
        className={`w-full px-2 py-1.5 rounded-sm text-xs border cursor-pointer active:translate-y-px ${
          dirty
            ? 'bg-[#173247] text-[#cfe6ff] border-[#2a6da3] hover:bg-[#1d3d54]'
            : 'bg-[#222] text-gray-300 border-[#333] opacity-40 cursor-not-allowed'
        }`}
      >
        Save Scene
      </button>
    </div>
  )
}
