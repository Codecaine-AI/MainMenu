'use client'

import { useRef, useState } from 'react'
import type { PropertyDef, SelectOption } from '@/types/property-schema'
import { RangedInput } from './inputs/RangedInput'
import { BlendSelect } from './inputs/BlendSelect'
import { FitSelect } from './inputs/FitSelect'
import { ClipSelect } from './inputs/ClipSelect'
import { AnchorSelect } from './inputs/AnchorSelect'
import { DescriptionPopover } from './DescriptionPopover'

interface Props {
  propertyKey: string
  def: PropertyDef
  value: unknown
  onChange: (next: unknown) => void
}

function selectOptionValue(option: SelectOption): string {
  return typeof option === 'string' ? option : option.value
}

function selectOptionLabel(option: SelectOption): string {
  return typeof option === 'string' ? option : option.label
}

function renderInput(def: PropertyDef, value: unknown, onChange: (next: unknown) => void) {
  if (def.type === 'number') {
    return (
      <RangedInput
        value={Number(value ?? 0)}
        min={def.min ?? 0}
        max={def.max ?? 1}
        step={def.step ?? 0.01}
        onChange={onChange}
      />
    )
  }

  if (def.type === 'string') {
    return (
      <input
        type="text"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none"
      />
    )
  }

  if (def.type === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[#4a8fc2]"
      />
    )
  }

  if (def.type === 'select') {
    const first = def.options[0]
    const fallback = first === undefined ? '' : selectOptionValue(first)
    return (
      <select
        value={String(value ?? fallback)}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none"
      >
        {def.options.map((option) => {
          const v = selectOptionValue(option)
          return (
            <option key={v} value={v}>
              {selectOptionLabel(option)}
            </option>
          )
        })}
      </select>
    )
  }

  if (def.type === 'blend') {
    return <BlendSelect value={String(value ?? 'normal')} onChange={onChange} />
  }

  if (def.type === 'fit') {
    return <FitSelect value={String(value ?? 'cover')} onChange={onChange} />
  }

  if (def.type === 'clip') {
    return <ClipSelect value={String(value ?? '')} onChange={onChange} />
  }

  if (def.type === 'anchor') {
    return <AnchorSelect value={value as string | undefined} onChange={onChange} />
  }

  return null
}

export function PropertyField({ def, value, onChange }: Props) {
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const hasDescription = Boolean(def.description)

  return (
    <div className="flex items-center gap-2 min-h-[22px] mb-[3px]">
      <div className="w-20 shrink-0 min-w-0">
        <button
          type="button"
          ref={anchorRef}
          onClick={hasDescription ? () => setOpen((o) => !o) : undefined}
          disabled={!hasDescription}
          className={`block w-full truncate bg-transparent border-0 p-0 text-left text-[12px] text-gray-300 ${
            hasDescription ? 'cursor-pointer hover:underline' : 'cursor-default'
          }`}
          title={def.label}
        >
          {def.label}
        </button>
      </div>
      <div className="flex-1 min-w-0">{renderInput(def, value, onChange)}</div>
      <DescriptionPopover
        label={def.label}
        description={def.description}
        anchorEl={anchorRef.current}
        open={open && hasDescription}
        onClose={() => setOpen(false)}
      />
    </div>
  )
}

export default PropertyField
