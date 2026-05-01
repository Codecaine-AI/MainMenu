'use client'

import { FIT_OPTIONS } from '@/lib/inspector-config'

interface Props {
  value: string
  onChange: (v: string) => void
}

export function FitSelect({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none"
    >
      {FIT_OPTIONS.map((fit) => (
        <option key={fit} value={fit}>{fit}</option>
      ))}
    </select>
  )
}
