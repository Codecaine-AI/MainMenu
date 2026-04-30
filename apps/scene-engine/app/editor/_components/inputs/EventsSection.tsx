'use client'

import { EVENT_TRIGGERS, EVENT_ACTIONS } from '@/lib/inspector-config'
import { InspectorSection } from './InspectorSection'
import type { EventBinding, EventTrigger, EventAction } from '@/types/scene'

interface Props {
  events: EventBinding[]
  onChange: (next: EventBinding[]) => void
}

const SELECT_CLASS =
  'bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none'

export function EventsSection({ events, onChange }: Props) {
  function replaceAt(idx: number, patch: Partial<EventBinding>) {
    const next = events.map((e, i) => (i === idx ? { ...e, ...patch } : e))
    onChange(next)
  }

  function removeAt(idx: number) {
    onChange(events.filter((_, i) => i !== idx))
  }

  function addOne() {
    onChange([...events, { trigger: 'click', action: 'navigate', target: '' }])
  }

  return (
    <InspectorSection title="Events">
      {events.length === 0 && (
        <div className="text-[10px] text-gray-600 italic px-1 mb-1">No events</div>
      )}
      {events.map((evt, i) => (
        <div key={i} className="flex items-center gap-1 mb-[3px]">
          <select
            value={evt.trigger}
            onChange={(e) => replaceAt(i, { trigger: e.target.value as EventTrigger })}
            className={`${SELECT_CLASS} flex-1 min-w-0`}
          >
            {EVENT_TRIGGERS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={evt.action}
            onChange={(e) => replaceAt(i, { action: e.target.value as EventAction })}
            className={`${SELECT_CLASS} flex-1 min-w-0`}
          >
            {EVENT_ACTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <input
            type="text"
            defaultValue={evt.target ?? ''}
            placeholder="target"
            onBlur={(e) => replaceAt(i, { target: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            className={`${SELECT_CLASS} flex-1 min-w-0`}
          />
          <button
            onClick={() => removeAt(i)}
            className="bg-transparent border-0 text-gray-500 hover:text-gray-300 cursor-pointer text-[12px] px-1 leading-none"
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={addOne}
        className="bg-[#222] border border-[#333] text-gray-500 text-[10px] font-mono px-2 py-[3px] rounded-sm cursor-pointer hover:border-[#4a8fc2] hover:text-gray-300 transition-colors mt-1"
      >
        + Add event
      </button>
    </InspectorSection>
  )
}
