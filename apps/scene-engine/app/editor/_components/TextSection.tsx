'use client'

import { useMemo } from 'react'
import { fontEntriesFromRegistry } from '@/renderer/font-registry'
import { RangedInput } from './inputs/RangedInput'
import { InspectorSection, FieldRow } from './inputs/InspectorSection'
import type { Registry } from '@/types/scene'

interface Props {
  properties: Record<string, unknown>
  registry: Registry | null
  onChange: (key: string, value: unknown) => void
}

const FONT_SIZE = { min: 8, max: 240, step: 1 }
const LINE_HEIGHT = { min: 0.5, max: 3, step: 0.05 }
const LETTER_SPACING = { min: -20, max: 80, step: 0.5 }
const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900]
const TEXT_ALIGNS = ['left', 'center', 'right'] as const

export function TextSection({ properties, registry, onChange }: Props) {
  const fontFamilies = useMemo(() => {
    const families = new Set(['FolkPro'])
    for (const font of fontEntriesFromRegistry(registry)) {
      families.add(font.family)
    }
    return [...families].sort((a, b) => a.localeCompare(b))
  }, [registry])

  return (
    <InspectorSection title="Text">
      <FieldRow label="Text">
        <textarea
          value={String(properties.text ?? 'New Text')}
          onChange={(e) => onChange('text', e.target.value)}
          className="min-h-[58px] w-full resize-y bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none"
        />
      </FieldRow>
      <FieldRow label="Font">
        <select
          value={String(properties.fontFamily ?? 'FolkPro')}
          onChange={(e) => onChange('fontFamily', e.target.value)}
          className="w-full bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none"
        >
          {fontFamilies.map((family) => (
            <option key={family} value={family}>{family}</option>
          ))}
        </select>
      </FieldRow>
      <FieldRow label="Size">
        <RangedInput
          value={(properties.fontSize as number | undefined) ?? 72}
          {...FONT_SIZE}
          onChange={(v) => onChange('fontSize', v)}
        />
      </FieldRow>
      <FieldRow label="Weight">
        <select
          value={String(properties.fontWeight ?? 700)}
          onChange={(e) => onChange('fontWeight', Number(e.target.value))}
          className="w-full bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none"
        >
          {FONT_WEIGHTS.map((weight) => (
            <option key={weight} value={weight}>{weight}</option>
          ))}
        </select>
      </FieldRow>
      <FieldRow label="Color">
        <input
          type="color"
          value={String(properties.color ?? '#ffffff')}
          onChange={(e) => onChange('color', e.target.value)}
          className="h-6 w-full bg-[#222] border border-[#333] rounded-sm"
        />
      </FieldRow>
      <FieldRow label="Line">
        <RangedInput
          value={(properties.lineHeight as number | undefined) ?? 1}
          {...LINE_HEIGHT}
          onChange={(v) => onChange('lineHeight', v)}
        />
      </FieldRow>
      <FieldRow label="Spacing">
        <RangedInput
          value={(properties.letterSpacing as number | undefined) ?? 0}
          {...LETTER_SPACING}
          onChange={(v) => onChange('letterSpacing', v)}
        />
      </FieldRow>
      <FieldRow label="Align">
        <select
          value={String(properties.textAlign ?? 'left')}
          onChange={(e) => onChange('textAlign', e.target.value)}
          className="w-full bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none"
        >
          {TEXT_ALIGNS.map((align) => (
            <option key={align} value={align}>{align}</option>
          ))}
        </select>
      </FieldRow>
      <FieldRow label="CSS">
        <textarea
          value={String(properties.customCss ?? '')}
          onChange={(e) => onChange('customCss', e.target.value)}
          spellCheck={false}
          placeholder={'text-shadow: 0 0 8px #fff;'}
          className="min-h-[120px] w-full resize-y bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none"
        />
      </FieldRow>
    </InspectorSection>
  )
}
