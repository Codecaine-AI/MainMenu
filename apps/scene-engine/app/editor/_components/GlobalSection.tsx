'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizePostProcessing, DEFAULT_POST_PROCESSING } from '@/lib/post-processing'
import { useEditorStore } from '@/store/editor-store'
import type { PostEffectBlend, PostProcessingSettings } from '@/types/scene'
import { InspectorSection, FieldRow } from './inputs/InspectorSection'
import { RangedInput } from './inputs/RangedInput'

const BLEND_OPTIONS: PostEffectBlend[] = [
  'screen',
  'overlay',
  'soft-light',
  'multiply',
  'normal',
]

function colorInputValue(color: string) {
  if (color.length !== 4) return color
  return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
}

async function savePostProcessing(
  projectId: string,
  settings: PostProcessingSettings,
  signal?: AbortSignal,
) {
  const response = await fetch(`/api/projects/${projectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postProcessing: settings }),
    signal,
  })
  if (!response.ok) {
    throw new Error(`Project update failed with status ${response.status}`)
  }
}

function reportSaveFailure(error: unknown) {
  console.error('[GlobalSettingsSection] Failed to save post-processing settings:', error)
}

export function GlobalSettingsSection() {
  const project = useEditorStore((state) => state.project)
  const projectId = useEditorStore((state) => state.projectId)
  const mutateProject = useEditorStore((state) => state.mutateProject)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveAbortRef = useRef<AbortController | null>(null)
  const pendingSaveRef = useRef<{
    projectId: string
    settings: PostProcessingSettings
  } | null>(null)
  const settings = normalizePostProcessing(project?.postProcessing)
  const [colorDraft, setColorDraft] = useState(settings.vignette.color)

  useEffect(() => {
    setColorDraft(settings.vignette.color)
  }, [settings.vignette.color])

  const persist = useCallback((next: PostProcessingSettings) => {
    if (!projectId) return
    pendingSaveRef.current = { projectId, settings: next }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveAbortRef.current?.abort()
    saveTimerRef.current = setTimeout(() => {
      const pending = pendingSaveRef.current
      pendingSaveRef.current = null
      if (!pending) return
      const controller = new AbortController()
      saveAbortRef.current = controller
      savePostProcessing(pending.projectId, pending.settings, controller.signal).catch((error) => {
        if (controller.signal.aborted) return
        reportSaveFailure(error)
      })
    }, 400)
  }, [projectId])

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    const pending = pendingSaveRef.current
    pendingSaveRef.current = null
    if (pending) {
      savePostProcessing(pending.projectId, pending.settings).catch(reportSaveFailure)
    }
  }, [persist])

  if (!project) {
    return (
      <p className="px-1 py-2 text-[11px] italic text-gray-600">
        No project settings loaded.
      </p>
    )
  }

  function commit(next: PostProcessingSettings) {
    const normalized = normalizePostProcessing(next)
    mutateProject({ postProcessing: normalized })
    persist(normalized)
  }

  function updateGrain(patch: Partial<PostProcessingSettings['grain']>) {
    commit({ ...settings, grain: { ...settings.grain, ...patch } })
  }

  function updateVignette(patch: Partial<PostProcessingSettings['vignette']>) {
    commit({ ...settings, vignette: { ...settings.vignette, ...patch } })
  }

  return (
    <div className="border-b border-[#2f2f2f] pb-2 text-[12px] font-mono">
      <InspectorSection title="Post-Processing" collapsible defaultOpen>
        <FieldRow label="Enabled">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => commit({ ...settings, enabled: event.target.checked })}
            className="accent-[#4a8fc2]"
          />
        </FieldRow>
      </InspectorSection>

      <InspectorSection title="Grain" collapsible defaultOpen>
        <FieldRow label="Enable">
          <input
            type="checkbox"
            checked={settings.grain.enabled}
            onChange={(event) => updateGrain({ enabled: event.target.checked })}
            className="accent-[#4a8fc2]"
          />
        </FieldRow>
        <FieldRow label="Live Static">
          <input
            type="checkbox"
            checked={settings.grain.animated}
            onChange={(event) => updateGrain({ animated: event.target.checked })}
            className="accent-[#4a8fc2]"
          />
        </FieldRow>
        <FieldRow label="Colored">
          <input
            type="checkbox"
            checked={settings.grain.colored}
            onChange={(event) => updateGrain({ colored: event.target.checked })}
            className="accent-[#4a8fc2]"
          />
        </FieldRow>
        {settings.grain.animated && (
          <FieldRow label="Speed">
            <RangedInput
              value={settings.grain.speed}
              min={1}
              max={60}
              step={1}
              onChange={(value) => updateGrain({ speed: value })}
            />
          </FieldRow>
        )}
        <FieldRow label="Intensity">
          <RangedInput
            value={settings.grain.opacity}
            min={0}
            max={1}
            step={0.005}
            onChange={(value) => updateGrain({ opacity: value })}
          />
        </FieldRow>
        <FieldRow label="Density">
          <RangedInput
            value={settings.grain.frequency}
            min={0.25}
            max={1.6}
            step={0.01}
            onChange={(value) => updateGrain({ frequency: value })}
          />
        </FieldRow>
        <FieldRow label="Contrast">
          <RangedInput
            value={settings.grain.contrast}
            min={0.55}
            max={2.2}
            step={0.01}
            onChange={(value) => updateGrain({ contrast: value })}
          />
        </FieldRow>
        <FieldRow label="Blend">
          <select
            value={settings.grain.blend}
            onChange={(event) => updateGrain({ blend: event.target.value as PostEffectBlend })}
            className="w-full rounded-sm border border-[#333] bg-[#222] px-1 py-[3px] font-mono text-[11px] text-gray-300 outline-none focus:border-[#4a8fc2]"
          >
            {BLEND_OPTIONS.map((blend) => (
              <option key={blend} value={blend}>{blend}</option>
            ))}
          </select>
        </FieldRow>
      </InspectorSection>

      <InspectorSection title="Vignette" collapsible defaultOpen>
        <FieldRow label="Enable">
          <input
            type="checkbox"
            checked={settings.vignette.enabled}
            onChange={(event) => updateVignette({ enabled: event.target.checked })}
            className="accent-[#4a8fc2]"
          />
        </FieldRow>
        <FieldRow label="Intensity">
          <RangedInput
            value={settings.vignette.intensity}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) => updateVignette({ intensity: value })}
          />
        </FieldRow>
        <FieldRow label="Size">
          <RangedInput
            value={settings.vignette.size}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) => updateVignette({ size: value })}
          />
        </FieldRow>
        <FieldRow label="Color">
          <div className="flex min-w-0 items-center gap-2">
            <input
              type="color"
              value={colorInputValue(settings.vignette.color)}
              onChange={(event) => {
                setColorDraft(event.target.value)
                updateVignette({ color: event.target.value })
              }}
              className="h-6 w-8 shrink-0 cursor-pointer rounded-sm border border-[#333] bg-transparent"
            />
            <input
              type="text"
              value={colorDraft}
              onChange={(event) => {
                const color = event.target.value
                setColorDraft(color)
                if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) {
                  updateVignette({ color })
                }
              }}
              onBlur={() => setColorDraft(settings.vignette.color)}
              className="min-w-0 flex-1 rounded-sm border border-[#333] bg-[#222] px-1 py-[3px] font-mono text-[11px] text-gray-300 outline-none focus:border-[#4a8fc2]"
            />
          </div>
        </FieldRow>
      </InspectorSection>

      <button
        type="button"
        onClick={() => {
          setColorDraft(DEFAULT_POST_PROCESSING.vignette.color)
          commit(structuredClone(DEFAULT_POST_PROCESSING))
        }}
        className="mt-2 cursor-pointer rounded-sm border border-[#333] bg-[#222] px-2 py-1 text-[11px] text-gray-300 hover:bg-[#2a2a2a] active:translate-y-px"
      >
        Reset to defaults
      </button>
    </div>
  )
}
