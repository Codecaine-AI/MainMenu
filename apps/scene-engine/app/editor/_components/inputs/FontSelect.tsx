'use client'

import { useMemo } from 'react'
import { fontEntriesFromRegistry } from '@/renderer/font-registry'
import { useEditorStore } from '@/store/editor-store'

interface Props {
  value?: string
  onChange: (next: string) => void
}

const GENERIC_FAMILIES = ['sans-serif', 'serif', 'monospace']

export function FontSelect({ value, onChange }: Props) {
  const registry = useEditorStore((state) => state.registry)
  const fontFamilies = useMemo(() => {
    const families = new Set(
      fontEntriesFromRegistry(registry).map((font) => font.family),
    )
    return [...families].sort((a, b) => a.localeCompare(b))
  }, [registry])
  const isExtraValue = Boolean(
    value &&
    !fontFamilies.includes(value) &&
    !GENERIC_FAMILIES.includes(value),
  )

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none"
    >
      {isExtraValue && <option value={value}>{value}</option>}
      {fontFamilies.map((family) => (
        <option key={family} value={family}>{family}</option>
      ))}
      <optgroup label="Generic">
        {GENERIC_FAMILIES.map((family) => (
          <option key={family} value={family}>{family}</option>
        ))}
      </optgroup>
    </select>
  )
}
