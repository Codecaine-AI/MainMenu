'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  MAIN_MENU_AGENT_MODEL,
  MAIN_MENU_AGENT_THINKING_LEVELS,
  type MainMenuAgentThinkingLevel,
} from '../../../../desktop/types/main-menu'
import { roleClass, roleLabel, statusText, usePiAgentController } from './usePiAgentController'

interface Props {
  projectId: string | null
  sceneId: string
}

export function PiAgentChatPanel({ projectId, sceneId }: Props) {
  const {
    scene,
    context,
    agentState,
    draft,
    setDraft,
    thinkingLevel,
    setThinkingLevel,
    bridgeAvailable,
    isBusy,
    send,
    abort,
    reset,
  } = usePiAgentController({ projectId, sceneId })
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [agentState.messages.length, agentState.status])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Enter' || event.shiftKey) return
      event.preventDefault()
      void send()
    },
    [send],
  )

  return (
    <aside className="flex min-h-0 flex-1 flex-col overflow-hidden border border-[#262626] bg-[#181818] p-2 pb-3 font-mono text-[11px]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="m-0 text-[12px] font-bold uppercase tracking-wide text-gray-100">Scene Agent</h3>
          <div className="mt-0.5 truncate text-[10px] text-gray-600">
            {context.selectedName ?? scene?.name ?? sceneId}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full border ${
              isBusy
                ? 'border-[#c7a14a] bg-[#c7a14a]'
                : agentState.status === 'error'
                  ? 'border-[#c06b6b] bg-[#c06b6b]'
                  : bridgeAvailable
                    ? 'border-[#5d7d67] bg-[#5d7d67]'
                    : 'border-[#555]'
            }`}
          />
          <span className="max-w-[96px] truncate text-[10px] uppercase tracking-wide text-gray-500">
            {statusText(agentState, bridgeAvailable)}
          </span>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-[minmax(0,1fr)_104px] gap-1.5">
        <div
          title={MAIN_MENU_AGENT_MODEL.id}
          className="flex h-6 min-w-0 items-center border border-[#303030] bg-[#141414] px-2 text-[10px] text-gray-500"
        >
          <span className="truncate">{MAIN_MENU_AGENT_MODEL.label}</span>
        </div>
        <select
          aria-label="Thinking level"
          value={thinkingLevel}
          onChange={(event) => setThinkingLevel(event.target.value as MainMenuAgentThinkingLevel)}
          disabled={!bridgeAvailable || isBusy}
          className="h-6 border border-[#333] bg-[#111] px-1 text-[10px] text-gray-300 outline-none focus:border-[#5d7790] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {MAIN_MENU_AGENT_THINKING_LEVELS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto border-y border-[#242424] py-2 pr-1">
        {agentState.messages.length === 0 ? (
          <div className="grid h-full place-items-center text-[11px] text-gray-600">No messages</div>
        ) : (
          <div className="space-y-2">
            {agentState.messages.map((message) => (
              <div key={message.id} className={`rounded-sm border px-2 py-1.5 ${roleClass(message.role)}`}>
                <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-gray-500">
                  {roleLabel(message.role)}
                </div>
                <div className="whitespace-pre-wrap break-words leading-snug">{message.text || '...'}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2 space-y-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!bridgeAvailable}
          placeholder="Message Scene Agent"
          className="h-[54px] w-full resize-none border border-[#333] bg-[#111] px-2 py-1.5 text-[11px] leading-snug text-gray-100 outline-none placeholder:text-gray-700 focus:border-[#5d7790] disabled:cursor-not-allowed disabled:opacity-55"
        />
        <div className="grid grid-cols-[1fr_auto_auto] gap-1.5">
          <button
            type="button"
            onClick={() => void send()}
            disabled={!bridgeAvailable || draft.trim().length === 0}
            className="h-7 border border-[#405064] bg-[#26313d] px-2 text-[11px] font-bold text-gray-100 hover:bg-[#303d4b] active:translate-y-px disabled:cursor-not-allowed disabled:border-[#2f2f2f] disabled:bg-[#1b1b1b] disabled:text-gray-600"
          >
            Send
          </button>
          <button
            type="button"
            onClick={() => void abort()}
            disabled={!isBusy}
            className="h-7 border border-[#3a3a3a] bg-[#202020] px-2 text-[11px] text-gray-300 hover:bg-[#292929] active:translate-y-px disabled:cursor-not-allowed disabled:text-gray-600"
          >
            Stop
          </button>
          <button
            type="button"
            onClick={() => void reset()}
            disabled={agentState.messages.length === 0 && !agentState.sessionId}
            className="h-7 border border-[#3a3a3a] bg-[#202020] px-2 text-[11px] text-gray-300 hover:bg-[#292929] active:translate-y-px disabled:cursor-not-allowed disabled:text-gray-600"
          >
            Clear
          </button>
        </div>
      </div>
    </aside>
  )
}
