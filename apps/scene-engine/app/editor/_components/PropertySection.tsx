'use client'

import { useRef, useState } from 'react'
import type { Section } from '@/types/property-schema'
import { PropertyField } from './PropertyField'
import { DescriptionPopover } from './DescriptionPopover'

interface Props {
  section: Section
  values: Record<string, unknown>
  onChange: (key: string, next: unknown) => void
  depth?: number
}

export function PropertySection({ section, values, onChange, depth = 0 }: Props) {
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const hasDescription = Boolean(section.description)
  const isTopLevel = depth === 0

  const headerButtonClass = isTopLevel
    ? 'text-[13px] font-bold text-gray-100 truncate flex-1 text-left bg-transparent border-0 p-0'
    : 'text-[12px] font-semibold text-gray-200 truncate flex-1 text-left bg-transparent border-0 p-0'

  const interactiveClass = hasDescription ? 'cursor-pointer hover:underline' : 'cursor-default'

  const indentStyle = isTopLevel ? undefined : { marginLeft: depth * 8 }

  const headerWrapperClass = isTopLevel
    ? 'w-full flex items-center gap-1 py-1 px-1.5 bg-[#303030] border-t border-b border-[#444]'
    : 'w-full flex items-center gap-1 py-0.5 px-0.5'

  const bodyClass = isTopLevel ? 'pt-1.5 pb-0.5 px-1' : 'pt-1'

  return (
    <div className={isTopLevel ? 'mt-1.5' : 'mt-1'} style={indentStyle}>
      <div className={headerWrapperClass}>
        <button
          type="button"
          ref={anchorRef}
          onClick={hasDescription ? () => setOpen((o) => !o) : undefined}
          disabled={!hasDescription}
          className={`${headerButtonClass} ${interactiveClass}`}
          title={section.label}
        >
          {section.label}
        </button>
      </div>
      <div className={bodyClass}>
        {Object.entries(section.properties ?? {}).map(([key, def]) => (
          <PropertyField
            key={key}
            propertyKey={key}
            def={def}
            value={values[key]}
            onChange={(v) => onChange(key, v)}
          />
        ))}
        {(section.sections ?? []).map((child) => (
          <PropertySection
            key={child.id}
            section={child}
            values={values}
            onChange={onChange}
            depth={depth + 1}
          />
        ))}
      </div>
      <DescriptionPopover
        label={section.label}
        description={section.description}
        anchorEl={anchorRef.current}
        open={open && hasDescription}
        onClose={() => setOpen(false)}
      />
    </div>
  )
}

export default PropertySection
