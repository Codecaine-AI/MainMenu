'use client'

import { useEditorStore } from '@/store/editor-store'
import { patchFromDottedKey } from '@/lib/patch'
import { NUMERIC_PROPERTY_STEPS } from '@/lib/inspector-config'
import { isAssetType } from '@/lib/asset-types'
import { RangedInput } from './inputs/RangedInput'
import { BlendSelect } from './inputs/BlendSelect'
import { AssetSwapDropdown } from './AssetSwapDropdown'
import type { Registry } from '@/types/scene'

interface Props {
  layer: Record<string, unknown>
  path: string
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-gray-500 whitespace-nowrap">{label}</dt>
      <dd className="m-0 text-gray-300 break-all">{children}</dd>
    </>
  )
}

export function LayerForm({ layer, path }: Props) {
  const mutateLayerAt = useEditorStore((s) => s.mutateLayerAt)
  const registry = useEditorStore((s) => s.registry) as Registry | null

  function commit(dottedKey: string, value: unknown) {
    mutateLayerAt(path, patchFromDottedKey(dottedKey, value))
  }

  const props = (layer.properties ?? {}) as Record<string, unknown>
  const pos = layer.position as Record<string, unknown> | undefined

  const assetId = layer.asset as string | undefined
  const containerEntry = assetId && registry ? registry[assetId] : undefined
  const containerType = containerEntry?.type
  const assetType = containerType && isAssetType(containerType) ? containerType : null
  const currentFile =
    containerEntry && 'file' in containerEntry ? containerEntry.file : null

  return (
    <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs font-mono">
      <Field label="id"><span className="text-gray-400">{layer.id as string}</span></Field>
      {layer.type ? <Field label="type"><span className="text-gray-400">{layer.type as string}</span></Field> : null}
      {layer.asset ? <Field label="asset"><span className="text-gray-400">{layer.asset as string}</span></Field> : null}

      {(layer.visible !== undefined || layer.type) ? (
        <Field label="visible">
          <input
            type="checkbox"
            defaultChecked={layer.visible !== false}
            onChange={(e) => commit('visible', e.target.checked)}
          />
        </Field>
      ) : null}

      {assetType && assetId && currentFile ? (
        <AssetSwapDropdown
          assetId={assetId}
          assetType={assetType}
          currentFile={currentFile}
        />
      ) : null}

      {pos && pos.x !== undefined && (
        <Field label="position.x">
          <input
            type="text"
            defaultValue={String(pos.x)}
            onBlur={(e) => {
              const v = e.target.value
              const num = Number(v)
              commit('position.x', Number.isFinite(num) && v.trim() !== '' ? num : v)
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-gray-300 text-xs font-mono px-1 py-0.5 rounded-sm"
          />
        </Field>
      )}
      {pos && pos.y !== undefined && (
        <Field label="position.y">
          <input
            type="text"
            defaultValue={String(pos.y)}
            onBlur={(e) => {
              const v = e.target.value
              const num = Number(v)
              commit('position.y', Number.isFinite(num) && v.trim() !== '' ? num : v)
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-gray-300 text-xs font-mono px-1 py-0.5 rounded-sm"
          />
        </Field>
      )}

      {Object.entries(props).map(([k, v]) => {
        const dotted = `properties.${k}`
        if (k === 'blend') {
          return (
            <Field key={k} label={dotted}>
              <BlendSelect value={v as string} onChange={(val) => commit(dotted, val)} />
            </Field>
          )
        }
        if (NUMERIC_PROPERTY_STEPS[k] && typeof v === 'number') {
          return (
            <Field key={k} label={dotted}>
              <RangedInput value={v} {...NUMERIC_PROPERTY_STEPS[k]} onChange={(val) => commit(dotted, val)} />
            </Field>
          )
        }
        if (typeof v === 'number') {
          return (
            <Field key={k} label={dotted}>
              <input
                type="number"
                step="any"
                defaultValue={v}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (Number.isFinite(n)) commit(dotted, n)
                }}
                className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-gray-300 text-xs font-mono px-1 py-0.5 rounded-sm"
              />
            </Field>
          )
        }
        if (typeof v === 'boolean') {
          return (
            <Field key={k} label={dotted}>
              <input type="checkbox" defaultChecked={v} onChange={(e) => commit(dotted, e.target.checked)} />
            </Field>
          )
        }
        return (
          <Field key={k} label={dotted}>
            <input
              type="text"
              defaultValue={String(v)}
              onBlur={(e) => commit(dotted, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-gray-300 text-xs font-mono px-1 py-0.5 rounded-sm"
            />
          </Field>
        )
      })}
    </dl>
  )
}
