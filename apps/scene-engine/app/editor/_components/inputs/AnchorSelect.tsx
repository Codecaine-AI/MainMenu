'use client'

import { ANCHOR_OPTIONS } from '@/lib/inspector-config'

interface Props {
  value: string | undefined
  onChange: (v: string) => void
}

export function AnchorSelect({ value, onChange }: Props) {
  return (
    <select
      value={value ?? 'top-left'}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none"
    >
      {ANCHOR_OPTIONS.map((anchor) => (
        <option key={anchor} value={anchor}>{anchor}</option>
      ))}
    </select>
  )
}
