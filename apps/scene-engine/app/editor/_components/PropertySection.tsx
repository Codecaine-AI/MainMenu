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
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(depth > 0)
  const hasDescription = Boolean(section.description)
  const isTopLevel = depth === 0
  const canCollapse = !isTopLevel
  const isCollapsed = canCollapse && collapsed

  const headerButtonClass = isTopLevel
    ? 'text-[12px] font-semibold text-gray-200 truncate flex-1 text-left bg-transparent border-0 p-0'
    : 'text-[11px] font-semibold text-gray-300 truncate flex-1 text-left bg-transparent border-0 p-0'

  const interactiveClass = canCollapse || hasDescription ? 'cursor-pointer hover:underline' : 'cursor-default'

  const indentStyle = !isTopLevel ? { marginLeft: depth * 8 } : undefined

  const headerWrapperClass = isTopLevel
    ? 'w-full flex items-center gap-1 py-1 px-2 bg-[#252525] rounded-t border-b border-[#333]'
    : 'w-full flex items-center gap-1 py-0.5 px-0.5'

  const bodyClass = isTopLevel ? 'pt-1.5 pb-1.5 px-2' : 'pt-1'

  const wrapperClass = isTopLevel
    ? 'mt-1.5 rounded border border-[#333] bg-[#1a1a1a]'
    : 'mt-1'

  return (
    <div className={wrapperClass} style={indentStyle}>
      <div className={headerWrapperClass}>
        <button
          type="button"
          ref={anchorRef}
          onClick={
            canCollapse
              ? () => setCollapsed((next) => !next)
              : hasDescription
                ? () => setDescriptionOpen((next) => !next)
                : undefined
          }
          disabled={!canCollapse && !hasDescription}
          aria-expanded={canCollapse ? !isCollapsed : undefined}
          className={`${headerButtonClass} ${interactiveClass}`}
          title={section.label}
        >
          {canCollapse ? `${isCollapsed ? '>' : 'v'} ${section.label}` : section.label}
        </button>
        {canCollapse && hasDescription && (
          <button
            type="button"
            onClick={() => setDescriptionOpen((next) => !next)}
            className="h-4 w-4 shrink-0 rounded-sm border border-[#3a3a3a] bg-[#1d1d1d] text-[10px] leading-none text-gray-400 hover:text-gray-200"
            aria-label={`${section.label} description`}
          >
            i
          </button>
        )}
      </div>
      {!isCollapsed && (
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
      )}
      <DescriptionPopover
        label={section.label}
        description={section.description}
        anchorEl={anchorRef.current}
        open={descriptionOpen && hasDescription}
        onClose={() => setDescriptionOpen(false)}
      />
    </div>
  )
}

export default PropertySection
