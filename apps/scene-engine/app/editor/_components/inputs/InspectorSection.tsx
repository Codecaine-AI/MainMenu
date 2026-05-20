'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

function OverflowTooltipText({
  children,
  className,
  wrapperClassName = '',
}: {
  children: string
  className: string
  wrapperClassName?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    setIsOverflowing(el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)
  }, [])

  useEffect(() => {
    measure()
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [children, measure])

  return (
    <span
      className={`group relative block min-w-0 ${wrapperClassName}`}
      onMouseEnter={measure}
      onFocus={measure}
    >
      <span
        ref={ref}
        className={className}
      >
        {children}
      </span>
      {isOverflowing && (
        <span className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden max-w-[260px] rounded-sm border border-[#3a3a3a] bg-[#111] px-2 py-1 text-[11px] leading-tight text-gray-200 shadow-lg group-hover:block group-focus-within:block">
          {children}
        </span>
      )}
    </span>
  )
}

interface SectionProps {
  title: string
  collapsible?: boolean
  defaultOpen?: boolean
  children: React.ReactNode
}

export function InspectorSection({
  title,
  collapsible = false,
  defaultOpen = true,
  children,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  if (collapsible) {
    return (
      <div className="mt-1.5">
        <button
          type="button"
          onClick={() => setOpen((next) => !next)}
          aria-expanded={open}
          className="w-full flex items-center gap-1 py-1 px-1.5 bg-[#303030] border-t border-b border-[#444] text-left hover:bg-[#353535]"
        >
          <span className="w-3 shrink-0 text-[11px] text-gray-500">{open ? 'v' : '>'}</span>
          <OverflowTooltipText
            className="text-[13px] font-bold text-gray-100 truncate block flex-1 min-w-0"
            wrapperClassName="flex-1"
            children={title}
          />
        </button>
        {open && (
          <div className="pt-1.5 pb-0.5 px-1">
            {children}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mt-1.5">
      <div className="w-full flex items-center gap-1 py-1 px-1.5 bg-[#303030] border-t border-b border-[#444]">
        <OverflowTooltipText
          className="text-[13px] font-bold text-gray-100 truncate block flex-1 min-w-0"
          wrapperClassName="flex-1"
          children={title}
        />
      </div>
      <div className="pt-1.5 pb-0.5 px-1">
        {children}
      </div>
    </div>
  )
}

interface FieldRowProps {
  label: string
  children: React.ReactNode
}

export function FieldRow({ label, children }: FieldRowProps) {
  return (
    <div className="flex items-center gap-2 min-h-[22px] mb-[3px]">
      <label className="group w-20 shrink-0 select-none min-w-0">
        <OverflowTooltipText
          className="text-[12px] text-gray-300 truncate block"
          children={label}
        />
      </label>
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}

const AXIS_COLORS: Record<string, string> = {
  X: 'text-red-400/70',
  Y: 'text-green-400/70',
  Z: 'text-blue-400/70',
}

interface AxisFieldProps {
  axes: { label: string; value: string | number; onChange: (v: string) => void; suffix?: string }[]
}

export function AxisField({ axes }: AxisFieldProps) {
  return (
    <div className="flex gap-0.5 items-center">
      {axes.map(({ label, value, onChange, suffix }) => (
        <div key={label} className="flex items-center gap-0 flex-1 min-w-0">
          <span className={`text-[11px] font-bold w-3.5 shrink-0 text-center select-none ${AXIS_COLORS[label] ?? 'text-gray-500'}`}>
            {label}
          </span>
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              defaultValue={String(value)}
              onBlur={(e) => onChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              className="w-full bg-[#222] border border-[#333] text-gray-300 text-[12px] font-mono pl-1.5 pr-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none"
            />
            {suffix && (
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-600 pointer-events-none">
                {suffix}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

interface ReadonlyFieldProps {
  value: string
}

export function ReadonlyValue({ value }: ReadonlyFieldProps) {
  return (
    <OverflowTooltipText
      className="text-[12px] text-gray-500 font-mono truncate block"
      children={value}
    />
  )
}

export function InspectorHeader({
  name,
  type,
  visible,
  onToggleVisible,
  onRename,
  onDelete,
}: {
  name: string
  type?: string
  visible?: boolean
  onToggleVisible?: (v: boolean) => void
  onRename?: (name: string) => void
  onDelete?: () => void
}) {
  const [draftName, setDraftName] = useState(name)

  useEffect(() => {
    setDraftName(name)
  }, [name])

  function commitName() {
    if (!onRename) return
    const nextName = draftName.trim()
    if (nextName !== name) onRename(nextName)
  }

  return (
    <div className="mb-2 pb-1.5 border-b border-[#333]">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={visible !== false}
          onChange={(e) => onToggleVisible?.(e.target.checked)}
          className="accent-[#4a8fc2] shrink-0"
        />
        {onRename ? (
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                setDraftName(name)
                e.currentTarget.blur()
              }
            }}
            className="min-w-0 flex-1 bg-transparent border border-transparent rounded-sm px-1 py-0.5 text-[14px] font-semibold text-gray-200 outline-none hover:border-[#333] focus:border-[#4a8fc2] focus:bg-[#191919]"
            aria-label="Object name"
          />
        ) : (
          <OverflowTooltipText
            className="text-[14px] font-semibold text-gray-200 truncate flex-1"
            wrapperClassName="flex-1"
            children={name}
          />
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="bg-transparent border-0 cursor-pointer p-0 shrink-0 text-red-500 hover:text-red-400"
            title="Delete object"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4M6.667 7.333v4M9.333 7.333v4M12.667 4v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4" />
            </svg>
          </button>
        )}
      </div>
      {type && (
        <div className="flex gap-2 mt-1 ml-5">
          <span className="text-[10px] uppercase tracking-wider text-gray-600 bg-[#222] border border-[#333] px-1.5 py-[1px] rounded-sm">
            {type}
          </span>
        </div>
      )}
    </div>
  )
}
