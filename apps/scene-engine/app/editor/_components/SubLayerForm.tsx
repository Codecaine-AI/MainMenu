'use client'

import { useEditorStore } from '@/store/editor-store'
import { patchFromDottedKey } from '@/lib/patch'
import { NUMERIC_PROPERTY_STEPS, SUB_LAYER_ADDABLE } from '@/lib/inspector-config'
import { RangedInput } from './inputs/RangedInput'
import { BlendSelect } from './inputs/BlendSelect'
import { InspectorHeader, InspectorSection, FieldRow, ReadonlyValue } from './inputs/InspectorSection'

interface Props {
  layer: Record<string, unknown>
  path: string
}

export function SubLayerForm({ layer, path }: Props) {
  const mutateObjectAt = useEditorStore((s) => s.mutateObjectAt)
  const props = (layer.properties ?? {}) as Record<string, unknown>

  function commit(dottedKey: string, value: unknown) {
    mutateObjectAt(path, patchFromDottedKey(dottedKey, value))
  }

  return (
    <div className="text-[11px] font-mono">
      <InspectorHeader name={layer.id as string} type="sub-layer" />

      <FieldRow label="Layer">
        <ReadonlyValue value={layer.layer as string} />
      </FieldRow>
      <FieldRow label="Visible">
        <input
          type="checkbox"
          defaultChecked={layer.visible !== false}
          onChange={(e) => commit('visible', e.target.checked)}
          className="accent-[#4a8fc2]"
        />
      </FieldRow>

      {(props.opacity !== undefined || props.blend !== undefined || props.hue !== undefined) && (
        <InspectorSection title="Appearance">
          {props.opacity !== undefined && (
            <FieldRow label="Opacity">
              <RangedInput
                value={props.opacity as number}
                {...NUMERIC_PROPERTY_STEPS.opacity}
                onChange={(v) => commit('properties.opacity', v)}
              />
            </FieldRow>
          )}
          {props.blend !== undefined && (
            <FieldRow label="Blend">
              <BlendSelect
                value={props.blend as string}
                onChange={(v) => commit('properties.blend', v)}
              />
            </FieldRow>
          )}
          {props.hue !== undefined && (
            <FieldRow label="Hue">
              <RangedInput
                value={props.hue as number}
                {...NUMERIC_PROPERTY_STEPS.hue}
                onChange={(v) => commit('properties.hue', v)}
              />
            </FieldRow>
          )}
        </InspectorSection>
      )}

      {(() => {
        const missing = SUB_LAYER_ADDABLE.filter((a) => props[a.key] === undefined)
        if (missing.length === 0) return null
        return (
          <div className="flex gap-1.5 flex-wrap mt-3 pt-2 border-t border-[#2a2a2a]">
            {missing.map(({ key, label, defaultValue }) => (
              <button
                key={key}
                onClick={() => commit(`properties.${key}`, defaultValue)}
                className="bg-[#222] border border-[#333] text-gray-500 text-[10px] font-mono px-2 py-[3px] rounded-sm cursor-pointer hover:border-[#4a8fc2] hover:text-gray-300 transition-colors"
              >
                + {label}
              </button>
            ))}
          </div>
        )
      })()}
    </div>
  )
}
