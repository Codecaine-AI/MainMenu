'use client'

import { BLEND_MODES } from '@/lib/inspector-config'

interface Props {
  value: string
  onChange: (v: string) => void
}

export function BlendSelect({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none"
    >
      {BLEND_MODES.map((mode) => (
        <option key={mode} value={mode}>{mode}</option>
      ))}
    </select>
  )
}
