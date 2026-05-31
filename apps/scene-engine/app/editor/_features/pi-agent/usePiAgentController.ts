'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { resolveObject } from '@/lib/path'
import { useEditorStore } from '@/store/editor-store'
import type { SceneJson } from '@/types/scene'
import {
  DEFAULT_MAIN_MENU_AGENT_MODEL_ID,
  DEFAULT_MAIN_MENU_AGENT_THINKING_LEVEL,
  mainMenuAgentThinkingLevelOption,
  type MainMenuAgentContext,
  type MainMenuAgentMessage,
  type MainMenuAgentState,
  type MainMenuAgentThinkingLevel,
} from '../../../../desktop/types/main-menu'

interface Input {
  projectId: string | null
  sceneId: string
}

const initialAgentState: MainMenuAgentState = {
  status: 'idle',
  messages: [],
  modelId: DEFAULT_MAIN_MENU_AGENT_MODEL_ID,
  thinkingLevel: DEFAULT_MAIN_MENU_AGENT_THINKING_LEVEL,
  cwd: null,
  sessionId: null,
  sessionFile: null,
  activeTool: null,
  error: null,
}

function contextFromSelection(input: {
  projectId: string | null
  sceneId: string
  scene: SceneJson | null
  selectedPath: string | null
}): MainMenuAgentContext {
  const layer = input.scene && input.selectedPath ? resolveObject(input.scene, input.selectedPath) : null
  const typedLayer = layer as { id?: unknown; name?: unknown; type?: unknown; asset?: unknown } | null
  return {
    projectId: input.projectId,
    sceneId: input.sceneId,
    selectedPath: input.selectedPath,
    selectedId: typedLayer?.id != null ? String(typedLayer.id) : null,
    selectedName: typedLayer ? String(typedLayer.name ?? typedLayer.id ?? 'Unnamed layer') : null,
    selectedType: typedLayer ? String(typedLayer.type ?? 'unknown') : null,
    selectedAsset: typedLayer?.asset != null ? String(typedLayer.asset) : null,
  }
}

export function roleClass(role: MainMenuAgentMessage['role']) {
  if (role === 'user') return 'ml-7 border-[#4b5563] bg-[#2a2f36] text-gray-100'
  if (role === 'assistant') return 'mr-4 border-[#314252] bg-[#202832] text-gray-100'
  if (role === 'error') return 'border-[#6e3434] bg-[#2b1919] text-[#f0aaaa]'
  if (role === 'tool') return 'border-[#3d3d3d] bg-[#171717] text-gray-500'
  return 'border-[#343434] bg-[#181818] text-gray-500'
}

export function roleLabel(role: MainMenuAgentMessage['role']) {
  if (role === 'user') return 'You'
  if (role === 'assistant') return 'Scene Agent'
  if (role === 'tool') return 'Tool'
  if (role === 'error') return 'Error'
  return 'System'
}

export function statusText(state: MainMenuAgentState, bridgeAvailable: boolean) {
  if (!bridgeAvailable) return 'Unavailable'
  if (state.activeTool) return `Running ${state.activeTool}`
  if (state.status === 'starting') return 'Starting'
  if (state.status === 'running') return 'Running'
  if (state.status === 'error') return 'Error'
  return 'Idle'
}

export function usePiAgentController({ projectId, sceneId }: Input) {
  const scene = useEditorStore((s) => s.scene) as SceneJson | null
  const selectedPath = useEditorStore((s) => s.selectedPath)
  const [agentState, setAgentState] = useState<MainMenuAgentState>(initialAgentState)
  const [thinkingLevel, setThinkingLevel] = useState<MainMenuAgentThinkingLevel>(
    DEFAULT_MAIN_MENU_AGENT_THINKING_LEVEL,
  )
  const [draft, setDraft] = useState('')
  const [bridgeAvailable, setBridgeAvailable] = useState(true)

  const context = useMemo(
    () => contextFromSelection({ projectId, sceneId, scene, selectedPath }),
    [projectId, sceneId, scene, selectedPath],
  )

  const applyAgentState = useCallback((state: MainMenuAgentState) => {
    const normalizedThinkingLevel = mainMenuAgentThinkingLevelOption(state.thinkingLevel).id
    const normalizedState = {
      ...state,
      modelId: state.modelId ?? DEFAULT_MAIN_MENU_AGENT_MODEL_ID,
      thinkingLevel: normalizedThinkingLevel,
    }
    setAgentState(normalizedState)
    setThinkingLevel(normalizedThinkingLevel)
  }, [])

  useEffect(() => {
    const bridge = window.mainMenu?.agent
    if (!bridge) {
      setBridgeAvailable(false)
      return
    }

    setBridgeAvailable(true)
    let cancelled = false
    void bridge.getState().then((state) => {
      if (!cancelled) applyAgentState(state)
    })
    const unsubscribe = bridge.onEvent((event) => {
      if (event.type === 'state') applyAgentState(event.state)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [applyAgentState])

  const send = useCallback(async () => {
    const message = draft.trim()
    if (!message || !window.mainMenu?.agent) return
    setDraft('')
    const state = await window.mainMenu.agent.sendMessage({ message, context, thinkingLevel })
    applyAgentState(state)
  }, [applyAgentState, context, draft, thinkingLevel])

  const abort = useCallback(async () => {
    if (!window.mainMenu?.agent) return
    applyAgentState(await window.mainMenu.agent.abort())
  }, [applyAgentState])

  const reset = useCallback(async () => {
    if (!window.mainMenu?.agent) return
    applyAgentState(await window.mainMenu.agent.reset())
  }, [applyAgentState])

  return {
    scene,
    context,
    agentState,
    draft,
    setDraft,
    thinkingLevel,
    setThinkingLevel,
    bridgeAvailable,
    isBusy: agentState.status === 'running' || agentState.status === 'starting',
    send,
    abort,
    reset,
  }
}
