'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { patchFromDottedKey } from '@/lib/patch'
import { useEditorStore } from '@/store/editor-store'
import { FieldRow, InspectorSection } from './inputs/InspectorSection'
import { FontAssetSelect } from './inputs/FontAssetSelect'
import { RangedInput } from './inputs/RangedInput'

interface Props {
  layer: Record<string, unknown>
  path: string
  properties: Record<string, unknown>
}

interface LogoBakeConfig {
  fontAssetId: string
  text: string
  tracking: number
  gapAdjustments?: number[]
}

interface DraftConfig {
  fontAssetId: string
  text: string
  tracking: number
  gaps: string
}

type BakeStatus =
  | { kind: 'idle' }
  | { kind: 'baking'; mode: 'single' | 'all' }
  | { kind: 'error'; message: string }
  | { kind: 'warning'; message: string }
  | { kind: 'success'; message: string }

interface BakeAllResult {
  fontAssetId: string
  assetId?: string
  cached?: boolean
  error?: string
}

const DEFAULT_CONFIG: LogoBakeConfig = {
  fontAssetId: 'melee-3',
  text: 'CODECAINE',
  tracking: 4,
}

const INPUT_CLASS = 'w-full bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none'
const BUTTON_CLASS = 'bg-[#222] text-gray-300 border border-[#333] px-2 py-1 rounded-sm text-[11px] cursor-pointer hover:bg-[#2a2a2a] active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed'

function configFromProperties(properties: Record<string, unknown>): LogoBakeConfig {
  const value = properties['logo-bake']
  const stored = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const tracking = typeof stored.tracking === 'number' && Number.isFinite(stored.tracking)
    ? Math.max(-100, Math.min(200, stored.tracking))
    : DEFAULT_CONFIG.tracking
  const gapAdjustments = Array.isArray(stored.gapAdjustments) &&
    stored.gapAdjustments.length > 0 &&
    stored.gapAdjustments.every((gap) => typeof gap === 'number' && Number.isFinite(gap))
    ? stored.gapAdjustments as number[]
    : undefined

  return {
    fontAssetId: typeof stored.fontAssetId === 'string' && stored.fontAssetId
      ? stored.fontAssetId
      : DEFAULT_CONFIG.fontAssetId,
    text: typeof stored.text === 'string' ? stored.text : DEFAULT_CONFIG.text,
    tracking,
    gapAdjustments,
  }
}

function gapsToText(gaps: number[] | undefined): string {
  return gaps?.join(', ') ?? ''
}

function parseGaps(value: string): { valid: boolean; gapAdjustments?: number[] } {
  if (!value.trim()) return { valid: true }

  const tokens = value.split(',')
  if (tokens.some((token) => token.trim() === '')) return { valid: false }

  const gapAdjustments = tokens.map((token) => Number(token.trim()))
  if (gapAdjustments.some((gap) => !Number.isFinite(gap))) return { valid: false }
  return { valid: true, gapAdjustments }
}

function statusText(status: BakeStatus): string {
  if (status.kind === 'baking') {
    return status.mode === 'all' ? 'Baking all fonts…' : 'Baking…'
  }
  if (status.kind === 'error') return status.message
  if (status.kind === 'warning' || status.kind === 'success') return status.message
  return 'Idle'
}

export function GlyphBakeSection({ layer, path, properties }: Props) {
  const mutateObjectAt = useEditorStore((state) => state.mutateObjectAt)
  const setObjectAssetAt = useEditorStore((state) => state.setObjectAssetAt)
  const setRegistry = useEditorStore((state) => state.setRegistry)
  const projectId = useEditorStore((state) => state.projectId)
  const sceneId = useEditorStore((state) => state.sceneId)
  const persisted = configFromProperties(properties)
  const persistedGaps = gapsToText(persisted.gapAdjustments)
  const layerId = typeof layer.id === 'string' ? layer.id : ''
  const selectionKey = `${projectId ?? ''}:${sceneId ?? ''}:${path}:${layerId}`
  const selectionKeyRef = useRef(selectionKey)
  const previousSelectionKeyRef = useRef(selectionKey)
  const requestIdRef = useRef(0)
  const mountedRef = useRef(false)
  const [draft, setDraft] = useState<DraftConfig>(() => ({
    fontAssetId: persisted.fontAssetId,
    text: persisted.text,
    tracking: persisted.tracking,
    gaps: persistedGaps,
  }))
  const [status, setStatus] = useState<BakeStatus>({ kind: 'idle' })
  const parsedGaps = useMemo(() => parseGaps(draft.gaps), [draft.gaps])
  const isBaking = status.kind === 'baking'
  const isBakingAll = status.kind === 'baking' && status.mode === 'all'

  selectionKeyRef.current = selectionKey

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestIdRef.current += 1
    }
  }, [])

  useEffect(() => {
    const selectionChanged = previousSelectionKeyRef.current !== selectionKey
    previousSelectionKeyRef.current = selectionKey
    if (selectionChanged) requestIdRef.current += 1
    setDraft({
      fontAssetId: persisted.fontAssetId,
      text: persisted.text,
      tracking: persisted.tracking,
      gaps: persistedGaps,
    })
    setStatus((current) => (
      selectionChanged || current.kind !== 'baking' ? { kind: 'idle' } : current
    ))
  }, [selectionKey, persisted.fontAssetId, persisted.text, persisted.tracking, persistedGaps])

  function updateDraft(patch: Partial<DraftConfig>) {
    setDraft((current) => ({ ...current, ...patch }))
    setStatus((current) => current.kind === 'baking' ? current : { kind: 'idle' })
  }

  async function refreshRegistry(activeProjectId: string) {
    const registryModule = await import('@/renderer/asset-registry')
    const registry = await registryModule.loadRegistry({
      projectId: activeProjectId,
      force: true,
      activate: false,
    })
    return {
      registry,
      activate: () => registryModule.activateRegistry(
        { projectId: activeProjectId },
        registry,
      ),
    }
  }

  function isLatestRequest(requestId: number, requestSelectionKey: string) {
    return mountedRef.current &&
      requestIdRef.current === requestId &&
      selectionKeyRef.current === requestSelectionKey
  }

  async function bakeConfig(config: LogoBakeConfig) {
    const activeProjectId = projectId
    if (!activeProjectId) {
      setStatus({ kind: 'error', message: 'No project selected.' })
      return
    }

    const requestSelectionKey = selectionKey
    const requestId = ++requestIdRef.current

    setStatus({ kind: 'baking', mode: 'single' })
    mutateObjectAt(path, patchFromDottedKey('properties.logo-bake', config))

    try {
      const response = await fetch('/api/glyph-bake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProjectId, ...config }),
      })
      const result = await response.json().catch(() => null) as {
        assetId?: unknown
        error?: unknown
      } | null

      if (!response.ok) {
        const message = typeof result?.error === 'string' && result.error
          ? result.error
          : `Glyph bake failed (${response.status}).`
        throw new Error(message)
      }
      if (typeof result?.assetId !== 'string' || !result.assetId) {
        throw new Error('Glyph bake response did not include an asset id.')
      }

      if (!isLatestRequest(requestId, requestSelectionKey)) return

      const refreshedRegistry = await refreshRegistry(activeProjectId)
      if (!isLatestRequest(requestId, requestSelectionKey)) return

      refreshedRegistry.activate()
      setRegistry(refreshedRegistry.registry)
      setObjectAssetAt(path, result.assetId)
      setStatus({ kind: 'success', message: 'Baked ✓' })
    } catch (error) {
      if (isLatestRequest(requestId, requestSelectionKey)) {
        setStatus({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Unable to bake glyphs.',
        })
      }
    }
  }

  function bake() {
    if (!parsedGaps.valid) return
    void bakeConfig({
      fontAssetId: draft.fontAssetId,
      text: draft.text,
      tracking: draft.tracking,
      gapAdjustments: parsedGaps.gapAdjustments,
    })
  }

  function changeFont(fontAssetId: string) {
    if (!parsedGaps.valid) return
    const config: LogoBakeConfig = {
      fontAssetId,
      text: draft.text,
      tracking: draft.tracking,
      gapAdjustments: parsedGaps.gapAdjustments,
    }
    setDraft((current) => ({ ...current, fontAssetId }))
    void bakeConfig(config)
  }

  async function bakeAll() {
    const activeProjectId = projectId
    if (!activeProjectId) {
      setStatus({ kind: 'error', message: 'No project selected.' })
      return
    }
    if (!parsedGaps.valid) return

    const requestSelectionKey = selectionKey
    const requestId = ++requestIdRef.current
    setStatus({ kind: 'baking', mode: 'all' })

    try {
      const response = await fetch('/api/glyph-bake/all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProjectId,
          text: draft.text,
          tracking: draft.tracking,
          gapAdjustments: parsedGaps.gapAdjustments,
        }),
      })
      const result = await response.json().catch(() => null) as {
        results?: unknown
        error?: unknown
      } | null

      if (!response.ok) {
        const message = typeof result?.error === 'string' && result.error
          ? result.error
          : `Glyph bake-all failed (${response.status}).`
        throw new Error(message)
      }
      if (!Array.isArray(result?.results)) {
        throw new Error('Glyph bake-all response did not include results.')
      }

      const results = result.results as BakeAllResult[]
      if (!isLatestRequest(requestId, requestSelectionKey)) return
      const refreshedRegistry = await refreshRegistry(activeProjectId)
      if (!isLatestRequest(requestId, requestSelectionKey)) return

      refreshedRegistry.activate()
      setRegistry(refreshedRegistry.registry)
      const failures = results.filter((item) => (
        typeof item?.error === 'string' && item.error
      ))
      const successCount = results.length - failures.length
      if (failures.length === 0) {
        setStatus({
          kind: 'success',
          message: `All fonts baked ✓ (${successCount}/${results.length})`,
        })
      } else {
        const failureText = failures.map((item) => (
          `${item.fontAssetId}: ${item.error}`
        )).join('; ')
        setStatus({
          kind: 'warning',
          message: `Fonts baked: ${successCount}/${results.length}; failed: ${failureText}`,
        })
      }
    } catch (error) {
      if (isLatestRequest(requestId, requestSelectionKey)) {
        setStatus({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Unable to bake all fonts.',
        })
      }
    }
  }

  return (
    <InspectorSection title="Logo">
      <fieldset
        disabled={isBakingAll || !parsedGaps.valid}
        className="m-0 min-w-0 border-0 p-0"
      >
        <FieldRow label="Font">
          <FontAssetSelect
            value={draft.fontAssetId}
            onChange={changeFont}
          />
        </FieldRow>
      </fieldset>
      <fieldset disabled={isBaking} className="m-0 min-w-0 border-0 p-0">
        <FieldRow label="Text">
          <input
            type="text"
            value={draft.text}
            onChange={(event) => updateDraft({ text: event.target.value })}
            className={INPUT_CLASS}
          />
        </FieldRow>
        <FieldRow label="Tracking">
          <RangedInput
            value={draft.tracking}
            min={-100}
            max={200}
            step={1}
            onChange={(tracking) => updateDraft({ tracking })}
          />
        </FieldRow>
        <FieldRow label="Gaps">
          <div>
            <input
              type="text"
              value={draft.gaps}
              onChange={(event) => updateDraft({ gaps: event.target.value })}
              placeholder="0, -2, 1"
              aria-invalid={!parsedGaps.valid}
              aria-describedby={!parsedGaps.valid ? 'glyph-bake-gaps-error' : undefined}
              className={`${INPUT_CLASS} ${!parsedGaps.valid ? 'border-[#8a4b4b] focus:border-[#a85a5a]' : ''}`}
            />
            {!parsedGaps.valid && (
              <p id="glyph-bake-gaps-error" className="mt-1 text-[10px] leading-tight text-red-400">
                Enter comma-separated numbers only.
              </p>
            )}
          </div>
        </FieldRow>
        <div className="mb-[3px] flex min-h-[24px] items-center gap-2 pl-[88px]">
          <button
            type="button"
            onClick={bake}
            disabled={isBaking || !parsedGaps.valid}
            aria-busy={isBaking}
            className={BUTTON_CLASS}
          >
            Bake
          </button>
          <button
            type="button"
            onClick={() => void bakeAll()}
            disabled={isBaking || !parsedGaps.valid}
            aria-busy={isBakingAll}
            className={BUTTON_CLASS}
          >
            Bake All Fonts
          </button>
          <span
            role={status.kind === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            className={`min-w-0 text-[10px] leading-tight ${
              status.kind === 'error'
                ? 'text-red-400'
                : status.kind === 'warning'
                  ? 'text-amber-400'
                : status.kind === 'success'
                  ? 'text-[#8fbf9f]'
                  : 'text-gray-500'
            }`}
          >
            {statusText(status)}
          </span>
        </div>
      </fieldset>
    </InspectorSection>
  )
}
