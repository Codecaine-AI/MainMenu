'use client'

import { RangedInput } from './RangedInput'
import type { ManifestProperty } from '@/types/scene'

interface Props {
  name: string
  schema: ManifestProperty
  value: unknown
  onChange: (next: unknown) => void
}

function getEffectiveValue(value: unknown, schema: ManifestProperty): unknown {
  if (value !== undefined && value !== '') return value
  return schema.default
}

export function ManifestPropertyField({ name: _name, schema, value, onChange }: Props) {
  if (schema.type === 'number') {
    return (
      <RangedInput
        value={Number(getEffectiveValue(value, schema) ?? 0)}
        step={schema.step ?? 0.01}
        min={schema.min ?? 0}
        max={schema.max ?? 1}
        onChange={onChange}
      />
    )
  }

  if (schema.type === 'string') {
    return (
      <input
        type="text"
        value={String(getEffectiveValue(value, schema) ?? '')}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none"
      />
    )
  }

  if (schema.type === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={Boolean(getEffectiveValue(value, schema))}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[#4a8fc2]"
      />
    )
  }

  return (
    <select
      value={String(getEffectiveValue(value, schema) ?? schema.options[0])}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none"
    >
      {schema.options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}
