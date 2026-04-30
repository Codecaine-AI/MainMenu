'use client'

import { useEditorStore } from '@/store/editor-store'
import { NUMERIC_PROPERTY_STEPS } from '@/lib/inspector-config'
import { isAssetType } from '@/lib/asset-types'
import { RangedInput } from './inputs/RangedInput'
import { BlendSelect } from './inputs/BlendSelect'
import { FitSelect } from './inputs/FitSelect'
import { AssetSwapDropdown } from './AssetSwapDropdown'
import { InspectorSection, FieldRow, ReadonlyValue } from './inputs/InspectorSection'
import type { Slot, Appearance, Registry } from '@/types/scene'

interface Props {
  slots: Slot[]
  path: string
}

export function SlotsSection({ slots, path }: Props) {
  const mutateObjectAt = useEditorStore((s) => s.mutateObjectAt)
  const registry = useEditorStore((s) => s.registry) as Registry | null

  function commitAppearance(i: number, key: keyof Appearance, value: unknown) {
    const next = slots.map((s, idx) => {
      if (idx !== i) return s
      const appearance = { ...(s.appearance ?? {}), [key]: value } as Appearance
      return { ...s, appearance }
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
        const currentFile =
          containerEntry && 'file' in containerEntry ? containerEntry.file : null

        return (
          <InspectorSection key={slot.id} title={`Slot: ${slot.id}`}>
            <FieldRow label="Type">
              <ReadonlyValue value={slot.type} />
            </FieldRow>
            <FieldRow label="Asset">
              {assetType && currentFile ? (
                <AssetSwapDropdown
                  assetId={slot.asset}
                  assetType={assetType}
                  currentFile={currentFile}
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
          </InspectorSection>
        )
      })}
    </>
  )
}
