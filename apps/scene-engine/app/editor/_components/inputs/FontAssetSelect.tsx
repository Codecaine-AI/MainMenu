'use client'

import { useMemo } from 'react'
import { fontEntriesFromRegistry } from '@/renderer/font-registry'
import { useEditorStore } from '@/store/editor-store'

interface Props {
  value?: string
  onChange: (next: string) => void
}

const ORIGINAL_FONT_ID = 'melee-3'

export function FontAssetSelect({ value, onChange }: Props) {
  const registry = useEditorStore((state) => state.registry)
  const fonts = useMemo(
    () => fontEntriesFromRegistry(registry).sort((a, b) => (
      a.family.localeCompare(b.family) || a.weight - b.weight
    )),
    [registry],
  )
  const isExtraValue = Boolean(
    value &&
    value !== ORIGINAL_FONT_ID &&
    !fonts.some((font) => font.id === value),
  )

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none"
    >
      <option value={ORIGINAL_FONT_ID}>Original (melee-3)</option>
      {isExtraValue && <option value={value}>{value}</option>}
      {fonts.map((font) => (
        <option key={font.id} value={font.id}>
          {font.family} {font.weight}{font.style === 'italic' ? ' Italic' : ''}
        </option>
      ))}
    </select>
  )
}
