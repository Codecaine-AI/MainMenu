'use client'

import { useEffect, useMemo, useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { patchFromDottedKey } from '@/lib/patch'
import { NUMERIC_PROPERTY_STEPS, POSITION_X_OPTIONS, POSITION_Y_OPTIONS } from '@/lib/inspector-config'
import { isAssetType } from '@/lib/asset-types'
import { resolveRuntimeUrl } from '@/renderer/runtime-url'
import { RangedInput } from './inputs/RangedInput'
import { BlendSelect } from './inputs/BlendSelect'
import { FitSelect } from './inputs/FitSelect'
import { AnchorSelect } from './inputs/AnchorSelect'
import { AssetSwapDropdown } from './AssetSwapDropdown'
import { EventsSection } from './inputs/EventsSection'
import { ManifestPropertyField } from './inputs/ManifestPropertyField'
import { GlyphBakeSection } from './GlyphBakeSection'
import { MainMenuConfigEditor } from './MainMenuConfigEditor'
import { SlotsSection } from './SlotsSection'
import { TextSection } from './TextSection'
import { InspectorHeader, InspectorSection, FieldRow, ReadonlyValue } from './inputs/InspectorSection'
import { PropertySection } from './PropertySection'
import {
  buildGeneralSection,
  extractSchemaPropertyKeys,
  getBuiltinPropertySchema,
} from '@/lib/builtin-property-schemas'
import type { Registry, Transform, Appearance, EventBinding, Slot, AssetContainer, ModuleEntry, SceneObjectType } from '@/types/scene'

interface Props {
  layer: Record<string, unknown>
  path: string
}

const MEDIA_TYPES = new Set(['video', 'image'])
const TEXT_PROPERTY_KEYS = new Set([
  'text',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'color',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'customCss',
])
const MEDIA_PROPERTY_DEFAULTS = {
  repeat_x: 1,
  repeat_y: 1,
  position_x: 0,
  position_y: 0,
  scale: 1,
  rotation: 0,
  speed: 1,
} as const
const MAIN_MENU_SYSTEM_CUSTOM_SCHEMA_SECTION_IDS = new Set([
  'main-menu-system-data',
  'main-menu-system-menu-layout',
  'main-menu-system-shield-layout',
  'main-menu-system-side-layout',
  'main-menu-system-detail-layout',
  'main-menu-system-back-layout',
  'main-menu-system-motion',
  'main-menu-system-input',
  'main-menu-system-audio',
])
const aspectRatioCache = new Map<string, Promise<number | null>>()
type PositionAxisValue = number | string | undefined

function defaultPercentForPin(value: PositionAxisValue): number {
  if (value === 'center' || value === 'middle') return 50
  if (value === 'right' || value === 'bottom') return 100
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function PositionAxisInput({
  value,
  axis,
  onChange,
}: {
  value: PositionAxisValue
  axis: 'x' | 'y'
  onChange: (value: number | string) => void
}) {
  const options = axis === 'x' ? POSITION_X_OPTIONS : POSITION_Y_OPTIONS
  const isPinned = typeof value === 'string' && (options as readonly string[]).includes(value)
  const selected = isPinned ? value : 'custom'

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <select
        value={selected}
        onChange={(e) => {
          if (e.target.value === 'custom') onChange(defaultPercentForPin(value))
          else onChange(e.target.value)
        }}
        className="w-[84px] shrink-0 bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      {selected === 'custom' && (
        <div className="flex-1 min-w-0">
          <RangedInput
            value={typeof value === 'number' ? value : defaultPercentForPin(value)}
            {...NUMERIC_PROPERTY_STEPS[axis]}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  )
}

function parseSvgAspectRatio(svgText: string): number | null {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const svg = doc.documentElement
  const viewBox = svg.getAttribute('viewBox')
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number)
    const width = parts[2]
    const height = parts[3]
    if (width > 0 && height > 0) return width / height
  }
  const width = Number.parseFloat(svg.getAttribute('width') ?? '')
  const height = Number.parseFloat(svg.getAttribute('height') ?? '')
  return width > 0 && height > 0 ? width / height : null
}

function imageAspectRatio(src: string): Promise<number | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      resolve(image.naturalWidth > 0 && image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : null)
    }
    image.onerror = () => resolve(null)
    image.src = src
  })
}

function videoAspectRatio(src: string): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      resolve(video.videoWidth > 0 && video.videoHeight > 0 ? video.videoWidth / video.videoHeight : null)
    }
    video.onerror = () => resolve(null)
    video.src = src
  })
}

function measuredLayerAspectRatio(layerId: string | undefined): number | null {
  if (!layerId) return null
  const element = document.querySelector<HTMLElement>(`[data-layer-id="${CSS.escape(layerId)}"]`)
  if (!element) return null
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0 ? rect.width / rect.height : null
}

async function resolveAssetAspectRatio(
  entry: AssetContainer | ModuleEntry | undefined,
  layerId: string | undefined,
): Promise<number | null> {
  if (!entry) return measuredLayerAspectRatio(layerId)
  const manifestRatio = 'manifest' in entry ? entry.manifest?.aspectRatio : undefined
  if (typeof manifestRatio === 'number' && manifestRatio > 0) return manifestRatio

  const src = 'file' in entry ? entry.file : entry.path
  const cacheKey = `${entry.type}:${src ?? layerId ?? ''}`
  if (aspectRatioCache.has(cacheKey)) return aspectRatioCache.get(cacheKey)!

  const promise = (async () => {
    if (typeof src === 'string') {
      const resolvedSrc = resolveRuntimeUrl(src)
      if (src.endsWith('.svg')) {
        try {
          const response = await fetch(resolvedSrc)
          if (response.ok) return parseSvgAspectRatio(await response.text())
        } catch {
          return measuredLayerAspectRatio(layerId)
        }
      }
      if (entry.type === 'image') return imageAspectRatio(resolvedSrc)
      if (entry.type === 'video') return videoAspectRatio(resolvedSrc)
    }
    return measuredLayerAspectRatio(layerId)
  })()

  aspectRatioCache.set(cacheKey, promise)
  return promise
}

export function LayerForm({ layer, path }: Props) {
  const mutateObjectAt = useEditorStore((s) => s.mutateObjectAt)
  const setObjectAssetAt = useEditorStore((s) => s.setObjectAssetAt)
  const removeObjectAt = useEditorStore((s) => s.removeObjectAt)
  const setSelectedPath = useEditorStore((s) => s.setSelectedPath)
  const projectId = useEditorStore((s) => s.projectId)
  const registry = useEditorStore((s) => s.registry) as Registry | null
  const scene = useEditorStore((s) => s.scene)
  const componentSchemas = useEditorStore((s) => s.componentSchemas)
  const [aspectRatio, setAspectRatio] = useState<number | null>(null)

  function commit(dottedKey: string, value: unknown) {
    mutateObjectAt(path, patchFromDottedKey(dottedKey, value))
  }

  function handleDelete() {
    removeObjectAt(path)
    setSelectedPath(null)
  }

  const transform = layer.transform as Transform | undefined
  const appearance = (layer.appearance ?? {}) as Appearance
  const props = (layer.properties ?? {}) as Record<string, unknown>
  const isFill = transform?.mode === 'fill'
  const explicit = !isFill ? (transform as { x?: number | string; y?: number | string; width?: number | 'auto'; height?: number | 'auto'; rotation?: number; scale?: number; anchor?: string } | undefined) : undefined
  const layerType = layer.type as string | undefined
  const isMedia = layerType ? MEDIA_TYPES.has(layerType) : false
  const isText = layerType === 'text'
  const isSubLayerOverride = typeof layer.layer === 'string' && typeof layer.type !== 'string'

  const assetId = layer.asset as string | undefined
  const isMainMenuSystem = layerType === 'component' && assetId === 'main-menu-system'
  const isGlyphGroup = layerType === 'glyph-group'
  const containerEntry = assetId && registry ? registry[assetId] : undefined
  const containerType = containerEntry?.type
  const assetType = containerType && isAssetType(containerType) ? containerType : null
  const currentFile =
    containerEntry && 'file' in containerEntry ? containerEntry.file : null
  const manifest =
    (containerEntry && 'manifest' in containerEntry ? containerEntry.manifest : undefined) ?? null
  const stageWidth = scene?.stage?.width ?? 1440
  const stageHeight = scene?.stage?.height ?? 1080

  const builtinSchema = useMemo(
    () => getBuiltinPropertySchema(layerType as SceneObjectType | undefined),
    [layerType],
  )
  const componentSchema = useMemo(
    () =>
      layerType === 'component' && typeof assetId === 'string'
        ? componentSchemas[assetId] ?? null
        : null,
    [layerType, assetId, componentSchemas],
  )
  const layerSchema = useMemo(
    () => builtinSchema ?? componentSchema,
    [builtinSchema, componentSchema],
  )
  const declaredKeys = useMemo(
    () => (layerSchema ? extractSchemaPropertyKeys(layerSchema) : new Set<string>()),
    [layerSchema],
  )
  const orphans = useMemo(
    () =>
      Object.entries(props).filter(
        ([k]) =>
          !declaredKeys.has(k) &&
          !(isText && TEXT_PROPERTY_KEYS.has(k)) &&
          !(isMainMenuSystem && k === 'menu-config') &&
          !(isGlyphGroup && k === 'logo-bake'),
      ),
    [props, declaredKeys, isText, isMainMenuSystem, isGlyphGroup],
  )
  const orphanKeySignature = orphans.map(([k]) => k).join(',')
  const visibleSchemaSections = useMemo(
    () =>
      layerSchema?.sections.filter(
        (section) =>
          !(
            isMainMenuSystem &&
            MAIN_MENU_SYSTEM_CUSTOM_SCHEMA_SECTION_IDS.has(section.id)
          ),
      ) ?? [],
    [layerSchema, isMainMenuSystem],
  )

  useEffect(() => {
    if (layerType === 'effect') return
    if (!orphans.length) return
    for (const [key] of orphans) {
      console.warn(
        `[builtin-property-schemas] orphan property '${key}' on layer type '${layerType}' — not declared in schema`,
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerType, orphanKeySignature])

  useEffect(() => {
    let cancelled = false
    setAspectRatio(null)
    resolveAssetAspectRatio(containerEntry, layer.id as string | undefined).then((ratio) => {
      if (!cancelled) setAspectRatio(ratio && Number.isFinite(ratio) && ratio > 0 ? ratio : null)
    })
    return () => {
      cancelled = true
    }
  }, [containerEntry, layer.id])

  function heightPercentForWidth(widthPercent: number): number | null {
    if (!aspectRatio || stageHeight <= 0) return null
    return Number((widthPercent * (stageWidth / stageHeight) / aspectRatio).toFixed(2))
  }

  function widthPercentForHeight(heightPercent: number): number | null {
    if (!aspectRatio || stageWidth <= 0) return null
    return Number((heightPercent * aspectRatio * (stageHeight / stageWidth)).toFixed(2))
  }

  function commitWidth(width: number) {
    if (explicit?.height === 'auto') {
      const height = heightPercentForWidth(width)
      if (height !== null) {
        mutateObjectAt(path, { transform: { width, height } })
        return
      }
    }
    commit('transform.width', width)
  }

  function commitHeight(height: number) {
    if (explicit?.width === 'auto') {
      const width = widthPercentForHeight(height)
      if (width !== null) {
        mutateObjectAt(path, { transform: { width, height } })
        return
      }
    }
    commit('transform.height', height)
  }

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
    <div className="text-[12px] font-mono">
      <InspectorHeader
        name={(layer.name as string | undefined) ?? (layer.id as string)}
        type={isSubLayerOverride ? 'sub-layer' : layerType}
        visible={layer.visible !== false}
        onToggleVisible={(visible) => commit('visible', visible)}
        onRename={(name) => commit('name', name || undefined)}
        onDelete={handleDelete}
      />

      {!isSubLayerOverride && assetId && assetType ? (
        <FieldRow label="Asset">
          <AssetSwapDropdown
            assetId={assetId}
            assetType={assetType}
            projectId={projectId}
            onSelect={(nextAssetId) => setObjectAssetAt(path, nextAssetId)}
          />
        </FieldRow>
      ) : !isSubLayerOverride && assetId ? (
        <FieldRow label="Asset">
          <ReadonlyValue value={assetId} />
        </FieldRow>
      ) : null}

      {!isSubLayerOverride && (
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
            <FieldRow label="Position X">
              <PositionAxisInput
                axis="x"
                value={explicit?.x ?? 0}
                onChange={(v) => commit('transform.x', v)}
              />
            </FieldRow>
            <FieldRow label="Position Y">
              <PositionAxisInput
                axis="y"
                value={explicit?.y ?? 0}
                onChange={(v) => commit('transform.y', v)}
              />
            </FieldRow>
            <FieldRow label="Width %">
              <div className="flex items-center gap-2">
                <RangedInput
                  value={typeof explicit?.width === 'number' ? explicit.width : 50}
                  {...NUMERIC_PROPERTY_STEPS.width}
                  onChange={commitWidth}
                />
                <label className="flex items-center gap-1 text-[10px] text-gray-500 shrink-0 select-none">
                  <input
                    type="checkbox"
                    checked={explicit?.width === 'auto'}
                    onChange={(e) => {
                      if (e.target.checked) commit('transform.width', 'auto')
                      else commitWidth(
                        typeof explicit?.height === 'number'
                          ? widthPercentForHeight(explicit.height) ?? 50
                          : 50,
                      )
                    }}
                    className="accent-[#4a8fc2]"
                  />
                  auto
                </label>
              </div>
            </FieldRow>
            <FieldRow label="Height %">
              <div className="flex items-center gap-2">
                <RangedInput
                  value={typeof explicit?.height === 'number' ? explicit.height : 50}
                  {...NUMERIC_PROPERTY_STEPS.height}
                  onChange={commitHeight}
                />
                <label className="flex items-center gap-1 text-[10px] text-gray-500 shrink-0 select-none">
                  <input
                    type="checkbox"
                    checked={explicit?.height === 'auto'}
                    onChange={(e) => {
                      if (e.target.checked) commit('transform.height', 'auto')
                      else commitHeight(
                        typeof explicit?.width === 'number'
                          ? heightPercentForWidth(explicit.width) ?? 50
                          : 50,
                      )
                    }}
                    className="accent-[#4a8fc2]"
                  />
                  auto
                </label>
              </div>
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
      )}

      {!isSubLayerOverride && (
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
      )}

      {isMainMenuSystem && (
        <MainMenuConfigEditor path={path} properties={props} />
      )}

      {((layerSchema && visibleSchemaSections.length > 0) || (layerType !== 'effect' && orphans.length > 0)) && (
        <InspectorSection title="Properties">
          {layerSchema && visibleSchemaSections.length > 0 && (() => {
            const schemaValues: Record<string, unknown> = isMedia
              ? { ...MEDIA_PROPERTY_DEFAULTS, ...props }
              : props
            return visibleSchemaSections.map((section) => (
              <PropertySection
                key={section.id}
                section={section}
                values={schemaValues}
                onChange={(key, value) =>
                  commit(
                    `properties.${key}`,
                    key === 'repeat_x' || key === 'repeat_y'
                      ? Math.round(value as number)
                      : value,
                  )
                }
              />
            ))
          })()}

          {layerType !== 'effect' && orphans.length > 0 && (
            <PropertySection
              section={buildGeneralSection(orphans)}
              values={Object.fromEntries(orphans)}
              onChange={(key, value) => commit(`properties.${key}`, value)}
            />
          )}
        </InspectorSection>
      )}

      {isText && (
        <TextSection
          properties={props}
          registry={registry}
          onChange={(key, value) => commit(`properties.${key}`, value)}
        />
      )}

      {layerType === 'effect' && manifest && Object.keys(manifest.properties).length > 0 && (
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
      )}

      {isGlyphGroup && (
        <GlyphBakeSection layer={layer} path={path} properties={props} />
      )}

      {isGlyphGroup && Array.isArray(layer.slots) && (layer.slots as Slot[]).length > 0 && (
        <SlotsSection slots={layer.slots as Slot[]} path={path} />
      )}

      <EventsSection
        events={(layer.events as EventBinding[] | undefined) ?? []}
        onChange={(next) => commit('events', next)}
      />
    </div>
  )
}
