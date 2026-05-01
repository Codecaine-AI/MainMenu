'use client'

interface SectionProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export function InspectorSection({ title, children }: SectionProps) {
  return (
    <div className="mt-1.5">
      <div className="w-full flex items-center gap-1 py-[3px] px-1 bg-[#282828] border-t border-b border-[#333]">
        <span className="text-[12px] font-semibold text-gray-300">
          {title}
        </span>
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
      <label className="text-[12px] text-gray-500 w-20 shrink-0 select-none truncate">
        {label}
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
    <span className="text-[12px] text-gray-500 font-mono truncate block">
      {value}
    </span>
  )
}

export function InspectorHeader({
  name,
  type,
  visible,
  onToggleVisible,
  onDelete,
}: {
  name: string
  type?: string
  visible?: boolean
  onToggleVisible?: (v: boolean) => void
  onDelete?: () => void
}) {
  return (
    <div className="mb-2 pb-1.5 border-b border-[#333]">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={visible !== false}
          onChange={(e) => onToggleVisible?.(e.target.checked)}
          className="accent-[#4a8fc2] shrink-0"
        />
        <span className="text-[14px] font-semibold text-gray-200 truncate flex-1" title={name}>
          {name}
        </span>
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
