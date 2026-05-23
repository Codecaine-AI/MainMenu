'use client'

import { useEditorStore } from '@/store/editor-store'
import { NUMERIC_PROPERTY_STEPS } from '@/lib/inspector-config'
import { isAssetType } from '@/lib/asset-types'
import { RangedInput } from './inputs/RangedInput'
import { BlendSelect } from './inputs/BlendSelect'
import { FitSelect } from './inputs/FitSelect'
import { AssetSwapDropdown } from './AssetSwapDropdown'
import { InspectorSection, FieldRow, ReadonlyValue } from './inputs/InspectorSection'
import type { Slot, Appearance, Registry, MediaProperties } from '@/types/scene'

interface Props {
  slots: Slot[]
  path: string
}

const MEDIA_PROPERTY_DEFAULTS = {
  repeat_x: 1,
  repeat_y: 1,
  position_x: 0,
  position_y: 0,
  scale: 1,
  rotation: 0,
  speed: 1,
} as const

export function SlotsSection({ slots, path }: Props) {
  const mutateObjectAt = useEditorStore((s) => s.mutateObjectAt)
  const setSlotAssetAt = useEditorStore((s) => s.setSlotAssetAt)
  const projectId = useEditorStore((s) => s.projectId)
  const registry = useEditorStore((s) => s.registry) as Registry | null

  function commitAppearance(i: number, key: keyof Appearance, value: unknown) {
    const next = slots.map((s, idx) => {
      if (idx !== i) return s
      const appearance = { ...(s.appearance ?? {}), [key]: value } as Appearance
      return { ...s, appearance }
    })
    mutateObjectAt(path, { slots: next })
  }

  function commitProperty(i: number, key: keyof MediaProperties, value: unknown) {
    const next = slots.map((s, idx) => {
      if (idx !== i) return s
      const properties = { ...(s.properties ?? {}), [key]: value } as MediaProperties
      return { ...s, properties }
    })
    mutateObjectAt(path, { slots: next })
  }

  return (
    <>
      {slots.map((slot, i) => {
        const appearance = slot.appearance ?? {}
        const containerEntry = registry ? registry[slot.asset] : undefined
        const containerType = containerEntry?.type
        const assetType = containerType && isAssetType(containerType) ? containerType : null
        return (
          <InspectorSection key={slot.id} title={`Slot: ${slot.id}`}>
            <FieldRow label="Type">
              <ReadonlyValue value={slot.type} />
            </FieldRow>
            <FieldRow label="Asset">
              {assetType ? (
                <AssetSwapDropdown
                  assetId={slot.asset}
                  assetType={assetType}
                  projectId={projectId}
                  onSelect={(nextAssetId) => setSlotAssetAt(path, i, nextAssetId)}
                />
              ) : (
                <ReadonlyValue value={slot.asset} />
              )}
            </FieldRow>

            <InspectorSection title="Appearance">
              <FieldRow label="Opacity">
                <RangedInput
                  value={appearance.opacity ?? 1}
                  {...NUMERIC_PROPERTY_STEPS.opacity}
                  onChange={(v) => commitAppearance(i, 'opacity', v)}
                />
              </FieldRow>
              <FieldRow label="Blend">
                <BlendSelect
                  value={appearance.blend ?? 'normal'}
                  onChange={(v) => commitAppearance(i, 'blend', v)}
                />
              </FieldRow>
              <FieldRow label="Fit">
                <FitSelect
                  value={appearance.fit ?? 'cover'}
                  onChange={(v) => commitAppearance(i, 'fit', v)}
                />
              </FieldRow>
              <FieldRow label="Hue">
                <RangedInput
                  value={appearance.hue ?? 0}
                  {...NUMERIC_PROPERTY_STEPS.hue}
                  onChange={(v) => commitAppearance(i, 'hue', v)}
                />
              </FieldRow>
            </InspectorSection>

            <InspectorSection title="Media">
              <FieldRow label="Repeat X">
                <RangedInput
                  value={slot.properties?.repeat_x ?? MEDIA_PROPERTY_DEFAULTS.repeat_x}
                  {...NUMERIC_PROPERTY_STEPS.repeat_x}
                  onChange={(v) => commitProperty(i, 'repeat_x', Math.round(v))}
                />
              </FieldRow>
              <FieldRow label="Repeat Y">
                <RangedInput
                  value={slot.properties?.repeat_y ?? MEDIA_PROPERTY_DEFAULTS.repeat_y}
                  {...NUMERIC_PROPERTY_STEPS.repeat_y}
                  onChange={(v) => commitProperty(i, 'repeat_y', Math.round(v))}
                />
              </FieldRow>
              <FieldRow label="Position X">
                <RangedInput
                  value={slot.properties?.position_x ?? MEDIA_PROPERTY_DEFAULTS.position_x}
                  {...NUMERIC_PROPERTY_STEPS.position_x}
                  onChange={(v) => commitProperty(i, 'position_x', v)}
                />
              </FieldRow>
              <FieldRow label="Position Y">
                <RangedInput
                  value={slot.properties?.position_y ?? MEDIA_PROPERTY_DEFAULTS.position_y}
                  {...NUMERIC_PROPERTY_STEPS.position_y}
                  onChange={(v) => commitProperty(i, 'position_y', v)}
                />
              </FieldRow>
              <FieldRow label="Scale">
                <RangedInput
                  value={slot.properties?.scale ?? MEDIA_PROPERTY_DEFAULTS.scale}
                  {...NUMERIC_PROPERTY_STEPS.scale}
                  onChange={(v) => commitProperty(i, 'scale', v)}
                />
              </FieldRow>
              <FieldRow label="Rotation">
                <RangedInput
                  value={slot.properties?.rotation ?? MEDIA_PROPERTY_DEFAULTS.rotation}
                  {...NUMERIC_PROPERTY_STEPS.rotation}
                  onChange={(v) => commitProperty(i, 'rotation', v)}
                />
              </FieldRow>
              <FieldRow label="Speed">
                <RangedInput
                  value={slot.properties?.speed ?? MEDIA_PROPERTY_DEFAULTS.speed}
                  {...NUMERIC_PROPERTY_STEPS.speed}
                  onChange={(v) => commitProperty(i, 'speed', v)}
                />
              </FieldRow>
            </InspectorSection>
          </InspectorSection>
        )
      })}
    </>
  )
}
