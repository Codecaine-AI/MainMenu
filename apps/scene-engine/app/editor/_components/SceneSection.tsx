'use client'

import { useEditorStore } from '@/store/editor-store'
import { NUMERIC_PROPERTY_STEPS } from '@/lib/inspector-config'
import type { SceneJson, Appearance } from '@/types/scene'
import { RangedInput } from './inputs/RangedInput'
import { InspectorSection, FieldRow } from './inputs/InspectorSection'

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
        <FieldRow label="Name">
          <input
            type="text"
            value={scene.name ?? ''}
            onChange={(event) => mutateScene({ name: event.target.value })}
            className="w-full rounded-sm border border-[#333] bg-[#222] px-1 py-[3px] font-mono text-[11px] text-gray-300 outline-none focus:border-[#4a8fc2]"
          />
        </FieldRow>
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
