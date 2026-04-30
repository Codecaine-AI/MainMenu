'use client'

import { useEditorStore } from '@/store/editor-store'
import { patchFromDottedKey } from '@/lib/patch'
import { NUMERIC_PROPERTY_STEPS } from '@/lib/inspector-config'
import { RangedInput } from './inputs/RangedInput'
import { BlendSelect } from './inputs/BlendSelect'
import { FitSelect } from './inputs/FitSelect'
import { ClipSelect } from './inputs/ClipSelect'
import { InspectorHeader, InspectorSection, FieldRow, AxisField, ReadonlyValue } from './inputs/InspectorSection'

interface Props {
  layer: Record<string, unknown>
  path: string
}

export function MediaChildForm({ layer, path }: Props) {
  const mutateObjectAt = useEditorStore((s) => s.mutateObjectAt)
  const props = (layer.properties ?? {}) as Record<string, unknown>

  function commit(dottedKey: string, value: unknown) {
    mutateObjectAt(path, patchFromDottedKey(dottedKey, value))
  }

  function commitClip(value: string | undefined) {
    if (value) {
      commit('properties.clip', value)
    } else {
      const next = { ...(props as Record<string, unknown>) }
      delete next.clip
      mutateObjectAt(path, { properties: next })
    }
  }

  return (
    <div className="text-[11px] font-mono">
      <InspectorHeader name={layer.id as string} type="media" />

      <FieldRow label="Asset">
        <ReadonlyValue value={layer.asset as string} />
      </FieldRow>

      <InspectorSection title="Transform">
        <FieldRow label="Position X">
          <RangedInput
            value={(props.position_x as number) ?? 0}
            {...NUMERIC_PROPERTY_STEPS.position_x}
            onChange={(v) => commit('properties.position_x', v)}
          />
        </FieldRow>
        <FieldRow label="Position Y">
          <RangedInput
            value={(props.position_y as number) ?? 0}
            {...NUMERIC_PROPERTY_STEPS.position_y}
            onChange={(v) => commit('properties.position_y', v)}
          />
        </FieldRow>
        <FieldRow label="Rotation">
          <RangedInput
            value={(props.rotation as number) ?? 0}
            {...NUMERIC_PROPERTY_STEPS.rotation}
            onChange={(v) => commit('properties.rotation', v)}
          />
        </FieldRow>
        <FieldRow label="Scale">
          <RangedInput
            value={(props.scale as number) ?? 1}
            {...NUMERIC_PROPERTY_STEPS.scale}
            onChange={(v) => commit('properties.scale', v)}
          />
        </FieldRow>
      </InspectorSection>

      <InspectorSection title="Appearance">
        <FieldRow label="Opacity">
          <RangedInput
            value={(props.opacity as number) ?? 1}
            {...NUMERIC_PROPERTY_STEPS.opacity}
            onChange={(v) => commit('properties.opacity', v)}
          />
        </FieldRow>
        <FieldRow label="Blend">
          <BlendSelect
            value={(props.blend as string) ?? 'normal'}
            onChange={(v) => commit('properties.blend', v)}
          />
        </FieldRow>
        <FieldRow label="Clip">
          <ClipSelect
            value={(props.clip as string) ?? ''}
            onChange={commitClip}
          />
        </FieldRow>
        <FieldRow label="Hue">
          <RangedInput
            value={(props.hue as number) ?? 0}
            {...NUMERIC_PROPERTY_STEPS.hue}
            onChange={(v) => commit('properties.hue', v)}
          />
        </FieldRow>
      </InspectorSection>

      <InspectorSection title="Playback">
        <FieldRow label="Speed">
          <RangedInput
            value={(props.speed as number) ?? 1}
            {...NUMERIC_PROPERTY_STEPS.speed}
            onChange={(v) => commit('properties.speed', v)}
          />
        </FieldRow>
      </InspectorSection>

      <InspectorSection title="Fit & Repeat">
        <FieldRow label="Object Fit">
          <FitSelect
            value={(props.fit as string) ?? 'cover'}
            onChange={(v) => commit('properties.fit', v)}
          />
        </FieldRow>
        <FieldRow label="Repeat">
          <AxisField
            axes={[
              {
                label: 'X',
                value: (props.repeat_x as number) ?? 1,
                onChange: (v) => {
                  const n = Number(v)
                  if (Number.isFinite(n)) commit('properties.repeat_x', n)
                },
              },
              {
                label: 'Y',
                value: (props.repeat_y as number) ?? 1,
                onChange: (v) => {
                  const n = Number(v)
                  if (Number.isFinite(n)) commit('properties.repeat_y', n)
                },
              },
            ]}
          />
        </FieldRow>
      </InspectorSection>
    </div>
  )
}
