'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { resolveObject } from '@/lib/path'
import type { SceneJson } from '@/types/scene'
import type {
  MainMenuAgentContext,
  MainMenuAgentMessage,
  MainMenuAgentState,
} from '../../../desktop/types/main-menu'

interface Props {
  projectId: string | null
  sceneId: string
}

const initialAgentState: MainMenuAgentState = {
  status: 'idle',
  messages: [],
  cwd: null,
  sessionId: null,
  sessionFile: null,
  activeTool: null,
  error: null,
}

function roleClass(role: MainMenuAgentMessage['role']) {
  if (role === 'user') return 'ml-7 border-[#4b5563] bg-[#2a2f36] text-gray-100'
  if (role === 'assistant') return 'mr-4 border-[#314252] bg-[#202832] text-gray-100'
  if (role === 'error') return 'border-[#6e3434] bg-[#2b1919] text-[#f0aaaa]'
  if (role === 'tool') return 'border-[#3d3d3d] bg-[#171717] text-gray-500'
  return 'border-[#343434] bg-[#181818] text-gray-500'
}

function roleLabel(role: MainMenuAgentMessage['role']) {
  if (role === 'user') return 'You'
  if (role === 'assistant') return 'Pi'
  if (role === 'tool') return 'Tool'
  if (role === 'error') return 'Error'
  return 'System'
}

function contextFromSelection(input: {
  projectId: string | null
  sceneId: string
  scene: SceneJson | null
  selectedPath: string | null
}): MainMenuAgentContext {
  const layer = input.scene && input.selectedPath ? resolveObject(input.scene, input.selectedPath) : null
  return {
    projectId: input.projectId,
    sceneId: input.sceneId,
    selectedPath: input.selectedPath,
    selectedName: layer ? String(layer.name ?? layer.id ?? 'Unnamed layer') : null,
    selectedType: layer ? String(layer.type ?? 'unknown') : null,
  }
}

function statusText(state: MainMenuAgentState, bridgeAvailable: boolean) {
  if (!bridgeAvailable) return 'Unavailable'
  if (state.activeTool) return `Running ${state.activeTool}`
  if (state.status === 'starting') return 'Starting'
  if (state.status === 'running') return 'Running'
  if (state.status === 'error') return 'Error'
  return 'Idle'
}

export function PiAgentChatPanel({ projectId, sceneId }: Props) {
  const scene = useEditorStore((s) => s.scene) as SceneJson | null
  const selectedPath = useEditorStore((s) => s.selectedPath)
  const [agentState, setAgentState] = useState<MainMenuAgentState>(initialAgentState)
  const [draft, setDraft] = useState('')
  const [bridgeAvailable, setBridgeAvailable] = useState(true)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const context = useMemo(
    () => contextFromSelection({ projectId, sceneId, scene, selectedPath }),
    [projectId, sceneId, scene, selectedPath],
  )

  useEffect(() => {
    const bridge = window.mainMenu?.agent
    if (!bridge) {
      setBridgeAvailable(false)
      return
    }

    setBridgeAvailable(true)
    let cancelled = false
    void bridge.getState().then((state) => {
      if (!cancelled) setAgentState(state)
    })
    const unsubscribe = bridge.onEvent((event) => {
      if (event.type === 'state') setAgentState(event.state)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [agentState.messages.length, agentState.status])

  const send = useCallback(async () => {
    const message = draft.trim()
    if (!message || !window.mainMenu?.agent) return
    setDraft('')
    const state = await window.mainMenu.agent.sendMessage({ message, context })
    setAgentState(state)
  }, [context, draft])

  const abort = useCallback(async () => {
    if (!window.mainMenu?.agent) return
    setAgentState(await window.mainMenu.agent.abort())
  }, [])

  const reset = useCallback(async () => {
    if (!window.mainMenu?.agent) return
    setAgentState(await window.mainMenu.agent.reset())
  }, [])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Enter' || event.shiftKey) return
      event.preventDefault()
      void send()
    },
    [send],
  )

  const isBusy = agentState.status === 'running' || agentState.status === 'starting'

  return (
    <aside className="mt-2 h-[316px] shrink-0 border-t border-[#2b2b2b] bg-[#181818] pt-2 pb-3 font-mono text-[11px]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="m-0 text-[12px] font-bold uppercase tracking-wide text-gray-100">Pi Agent</h3>
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

      <div ref={scrollRef} className="h-[148px] overflow-auto border-y border-[#242424] py-2 pr-1">
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
          placeholder="Message Pi"
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
