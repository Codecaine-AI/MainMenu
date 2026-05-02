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

function normalizeColor(value: unknown): string {
  const text = String(value ?? '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(text)) return text
  if (/^#[0-9a-fA-F]{3}$/.test(text)) {
    return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`
  }
  return '#4e5f6c'
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

  if (schema.type === 'color') {
    const color = normalizeColor(getEffectiveValue(value, schema))
    return (
      <div className="flex items-center gap-2 min-w-0">
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 shrink-0 bg-transparent border border-[#333] rounded-sm cursor-pointer"
        />
        <input
          type="text"
          value={String(getEffectiveValue(value, schema) ?? color)}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none"
        />
      </div>
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
