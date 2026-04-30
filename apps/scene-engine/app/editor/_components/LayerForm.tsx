'use client'

import { useEditorStore } from '@/store/editor-store'
import { patchFromDottedKey } from '@/lib/patch'
import { NUMERIC_PROPERTY_STEPS } from '@/lib/inspector-config'
import { isAssetType } from '@/lib/asset-types'
import { RangedInput } from './inputs/RangedInput'
import { BlendSelect } from './inputs/BlendSelect'
import { FitSelect } from './inputs/FitSelect'
import { AnchorSelect } from './inputs/AnchorSelect'
import { AssetSwapDropdown } from './AssetSwapDropdown'
import { EventsSection } from './inputs/EventsSection'
import { ManifestPropertyField } from './inputs/ManifestPropertyField'
import { InspectorHeader, InspectorSection, FieldRow, AxisField, ReadonlyValue } from './inputs/InspectorSection'
import type { Registry, Transform, Appearance, EventBinding } from '@/types/scene'

interface Props {
  layer: Record<string, unknown>
  path: string
}

const MEDIA_TYPES = new Set(['video', 'image'])

export function LayerForm({ layer, path }: Props) {
  const mutateObjectAt = useEditorStore((s) => s.mutateObjectAt)
  const registry = useEditorStore((s) => s.registry) as Registry | null

  function commit(dottedKey: string, value: unknown) {
    mutateObjectAt(path, patchFromDottedKey(dottedKey, value))
  }

  const transform = layer.transform as Transform | undefined
  const appearance = (layer.appearance ?? {}) as Appearance
  const props = (layer.properties ?? {}) as Record<string, unknown>
  const isFill = transform?.mode === 'fill'
  const explicit = !isFill ? (transform as { x?: number; y?: number; width?: number | 'auto'; height?: number | 'auto'; rotation?: number; scale?: number; anchor?: string } | undefined) : undefined
  const layerType = layer.type as string | undefined
  const isMedia = layerType ? MEDIA_TYPES.has(layerType) : false

  const assetId = layer.asset as string | undefined
  const containerEntry = assetId && registry ? registry[assetId] : undefined
  const containerType = containerEntry?.type
  const assetType = containerType && isAssetType(containerType) ? containerType : null
  const currentFile =
    containerEntry && 'file' in containerEntry ? containerEntry.file : null
  const manifest =
    (containerEntry && 'manifest' in containerEntry ? containerEntry.manifest : undefined) ?? null

  function toggleFill(nextFill: boolean) {
    if (nextFill) {
      mutateObjectAt(path, {
        transform: {
          mode: 'fill',
          x: undefined,
          y: undefined,
          width: undefined,
          height: undefined,
          anchor: undefined,
        },
      })
    } else {
      const prevRotation = transform && 'rotation' in transform ? transform.rotation : undefined
      const prevScale = transform && 'scale' in transform ? transform.scale : undefined
      mutateObjectAt(path, {
        transform: {
          mode: undefined,
          x: 0,
          y: 0,
          width: 'auto',
          height: 'auto',
          rotation: prevRotation ?? 0,
          scale: prevScale ?? 1,
          anchor: 'top-left',
        },
      })
    }
  }

  return (
    <div className="text-[11px] font-mono">
      <InspectorHeader name={(layer.name as string | undefined) ?? (layer.id as string)} type={layerType} />

      {assetId && (
        <FieldRow label="Asset">
          <ReadonlyValue value={assetId} />
        </FieldRow>
      )}

      <FieldRow label="Visible">
        <input
          type="checkbox"
          defaultChecked={layer.visible !== false}
          onChange={(e) => commit('visible', e.target.checked)}
          className="accent-[#4a8fc2]"
        />
      </FieldRow>

      {assetType && assetId && currentFile && (
        <FieldRow label="File">
          <AssetSwapDropdown
            assetId={assetId}
            assetType={assetType}
            currentFile={currentFile}
          />
        </FieldRow>
      )}

      <InspectorSection title="Transform">
        <FieldRow label="Fill">
          <input
            type="checkbox"
            checked={isFill}
            onChange={(e) => toggleFill(e.target.checked)}
            className="accent-[#4a8fc2]"
          />
        </FieldRow>

        {!isFill && (
          <>
            <FieldRow label="Position">
              <AxisField
                axes={[
                  {
                    label: 'X',
                    value: explicit?.x ?? 0,
                    onChange: (v) => {
                      const n = Number(v)
                      if (Number.isFinite(n)) commit('transform.x', n)
                    },
                    suffix: '%',
                  },
                  {
                    label: 'Y',
                    value: explicit?.y ?? 0,
                    onChange: (v) => {
                      const n = Number(v)
                      if (Number.isFinite(n)) commit('transform.y', n)
                    },
                    suffix: '%',
                  },
                ]}
              />
            </FieldRow>
            <FieldRow label="Size">
              <AxisField
                axes={[
                  {
                    label: 'W',
                    value: explicit?.width ?? 'auto',
                    onChange: (v) => {
                      const trimmed = v.trim()
                      if (trimmed === 'auto') {
                        commit('transform.width', 'auto')
                        return
                      }
                      const n = Number(trimmed)
                      if (Number.isFinite(n)) commit('transform.width', n)
                    },
                    suffix: typeof explicit?.width === 'number' ? '%' : undefined,
                  },
                  {
                    label: 'H',
                    value: explicit?.height ?? 'auto',
                    onChange: (v) => {
                      const trimmed = v.trim()
                      if (trimmed === 'auto') {
                        commit('transform.height', 'auto')
                        return
                      }
                      const n = Number(trimmed)
                      if (Number.isFinite(n)) commit('transform.height', n)
                    },
                    suffix: typeof explicit?.height === 'number' ? '%' : undefined,
                  },
                ]}
              />
            </FieldRow>
          </>
        )}

        <FieldRow label="Rotation">
          <RangedInput
            value={transform?.rotation ?? 0}
            {...NUMERIC_PROPERTY_STEPS.rotation}
            onChange={(v) => commit('transform.rotation', v)}
          />
        </FieldRow>
        <FieldRow label="Scale">
          <RangedInput
            value={transform?.scale ?? 1}
            {...NUMERIC_PROPERTY_STEPS.scale}
            onChange={(v) => commit('transform.scale', v)}
          />
        </FieldRow>
        {!isFill && (
          <FieldRow label="Anchor">
            <AnchorSelect
              value={explicit?.anchor}
              onChange={(v) => commit('transform.anchor', v)}
            />
          </FieldRow>
        )}
      </InspectorSection>

      <InspectorSection title="Appearance">
        <FieldRow label="Opacity">
          <RangedInput
            value={appearance.opacity ?? 1}
            {...NUMERIC_PROPERTY_STEPS.opacity}
            onChange={(v) => commit('appearance.opacity', v)}
          />
        </FieldRow>
        <FieldRow label="Blend">
          <BlendSelect
            value={appearance.blend ?? 'normal'}
            onChange={(v) => commit('appearance.blend', v)}
          />
        </FieldRow>
        <FieldRow label="Hue">
          <RangedInput
            value={appearance.hue ?? 0}
            {...NUMERIC_PROPERTY_STEPS.hue}
            onChange={(v) => commit('appearance.hue', v)}
          />
        </FieldRow>
        {isMedia && (
          <FieldRow label="Fit">
            <FitSelect
              value={appearance.fit ?? 'cover'}
              onChange={(v) => commit('appearance.fit', v)}
            />
          </FieldRow>
        )}
      </InspectorSection>

      {manifest && Object.keys(manifest.properties).length > 0 ? (
        <InspectorSection title="Properties">
          {Object.entries(manifest.properties).map(([name, schema]) => (
            <FieldRow key={name} label={name}>
              <ManifestPropertyField
                name={name}
                schema={schema}
                value={props[name]}
                onChange={(v) => commit(`properties.${name}`, v)}
              />
            </FieldRow>
          ))}
        </InspectorSection>
      ) : (
        !manifest &&
        Object.keys(props).length > 0 && (
          <InspectorSection title="Properties">
            {Object.entries(props).map(([k, v]) => {
              const dotted = `properties.${k}`
              if (NUMERIC_PROPERTY_STEPS[k] && typeof v === 'number') {
                return (
                  <FieldRow key={k} label={k}>
                    <RangedInput value={v} {...NUMERIC_PROPERTY_STEPS[k]} onChange={(val) => commit(dotted, val)} />
                  </FieldRow>
                )
              }
              if (typeof v === 'number') {
                return (
                  <FieldRow key={k} label={k}>
                    <input
                      type="number"
                      step="any"
                      defaultValue={v}
                      onChange={(e) => {
                        const n = Number(e.target.value)
                        if (Number.isFinite(n)) commit(dotted, n)
                      }}
                      className="w-full bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none"
                    />
                  </FieldRow>
                )
              }
              if (typeof v === 'boolean') {
                return (
                  <FieldRow key={k} label={k}>
                    <input type="checkbox" defaultChecked={v} onChange={(e) => commit(dotted, e.target.checked)} className="accent-[#4a8fc2]" />
                  </FieldRow>
                )
              }
              return (
                <FieldRow key={k} label={k}>
                  <input
                    type="text"
                    defaultValue={String(v)}
                    onBlur={(e) => commit(dotted, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    className="w-full bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none"
                  />
                </FieldRow>
              )
            })}
          </InspectorSection>
        )
      )}

      <EventsSection
        events={(layer.events as EventBinding[] | undefined) ?? []}
        onChange={(next) => commit('events', next)}
      />
    </div>
  )
}
