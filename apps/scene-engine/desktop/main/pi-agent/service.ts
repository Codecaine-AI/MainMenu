import fs from 'node:fs/promises'
import path from 'node:path'
import {
  DEFAULT_MAIN_MENU_AGENT_MODEL_ID,
  DEFAULT_MAIN_MENU_AGENT_THINKING_LEVEL,
  MAIN_MENU_AGENT_MODEL,
  mainMenuAgentThinkingLevelOption,
  type MainMenuAgentContext,
  type MainMenuAgentEvent,
  type MainMenuAgentMessage,
  type MainMenuAgentPromptRequest,
  type MainMenuAgentState,
  type MainMenuAgentThinkingLevel,
} from '../../types/main-menu'
import { resolveAgentWorkspace, type AgentWorkspace } from './project-workspace'

interface PiAgentServiceOptions {
  appRoot: string
  sessionRoot: () => string
  packagedWorkspacePath: () => string | null
  publish: (event: MainMenuAgentEvent) => void
}

export interface PiAgentService {
  getState(): MainMenuAgentState
  sendMessage(request: MainMenuAgentPromptRequest): Promise<MainMenuAgentState>
  abort(): Promise<MainMenuAgentState>
  reset(): Promise<MainMenuAgentState>
  dispose(): void
}

function piAuthFileLabel() {
  const customAgentDir = process.env.PI_CODING_AGENT_DIR?.trim()
  if (customAgentDir) return path.join(customAgentDir, 'auth.json')
  return '~/.pi/agent/auth.json'
}

function normalizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (/authentication token has been invalidated|try signing in again/i.test(message)) {
    return [
      message,
      '',
      `Scene Agent uses Pi auth storage at ${piAuthFileLabel()}.`,
      'Run `pi`, use `/logout` to remove the stale ChatGPT Plus/Pro (Codex) credentials, then use `/login` and select ChatGPT Plus/Pro (Codex) for the account you want Main Menu to use.',
      'If you keep multiple Codex subscriptions, launch both `pi` and Main Menu with the same `PI_CODING_AGENT_DIR` value to pin this app to a dedicated auth profile.',
    ].join('\n')
  }
  return message
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return ''
      const block = part as { type?: string; text?: string; thinking?: string; name?: string }
      if (block.type === 'text') return block.text ?? ''
      if (block.type === 'thinking') return block.thinking ? '[thinking]' : ''
      if (block.type === 'toolCall') return block.name ? `[tool: ${block.name}]` : '[tool]'
      if (block.type === 'image') return '[image]'
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function textFromAgentMessage(message: unknown): string {
  if (!message || typeof message !== 'object') return ''
  const typed = message as { content?: unknown; errorMessage?: string }
  return textFromContent(typed.content) || typed.errorMessage || ''
}

function importPiSdk(): Promise<typeof import('@mariozechner/pi-coding-agent')> {
  const dynamicImport = new Function('specifier', 'return import(specifier)') as (
    specifier: string,
  ) => Promise<typeof import('@mariozechner/pi-coding-agent')>
  return dynamicImport('@mariozechner/pi-coding-agent')
}

export function createPiAgentService(options: PiAgentServiceOptions): PiAgentService {
  let agentSession: import('@mariozechner/pi-coding-agent').AgentSession | null = null
  let agentUnsubscribe: (() => void) | null = null
  let agentMessages: MainMenuAgentMessage[] = []
  let agentStatus: MainMenuAgentState['status'] = 'idle'
  let agentCwd: string | null = null
  let agentWorkspace: AgentWorkspace | null = null
  let agentSessionId: string | null = null
  let agentSessionFile: string | null = null
  let agentThinkingLevel: MainMenuAgentThinkingLevel = DEFAULT_MAIN_MENU_AGENT_THINKING_LEVEL
  let activeTool: string | null = null
  let agentError: string | null = null
  let activeAssistantMessageId: string | null = null
  let messageSequence = 0

  function nextMessageId(prefix: string) {
    messageSequence += 1
    return `${prefix}-${Date.now().toString(36)}-${messageSequence.toString(36)}`
  }

  function addAgentMessage(role: MainMenuAgentMessage['role'], text: string) {
    const message: MainMenuAgentMessage = {
      id: nextMessageId(role),
      role,
      text,
      timestamp: Date.now(),
    }
    agentMessages = [...agentMessages, message].slice(-80)
    return message
  }

  function updateAgentMessage(id: string, text: string) {
    agentMessages = agentMessages.map((message) => (message.id === id ? { ...message, text } : message))
  }

  function appendAgentMessageText(id: string, delta: string) {
    agentMessages = agentMessages.map((message) =>
      message.id === id ? { ...message, text: `${message.text}${delta}` } : message,
    )
  }

  function getState(): MainMenuAgentState {
    return {
      status: agentStatus,
      messages: agentMessages,
      modelId: DEFAULT_MAIN_MENU_AGENT_MODEL_ID,
      thinkingLevel: agentThinkingLevel,
      cwd: agentCwd,
      sessionId: agentSessionId,
      sessionFile: agentSessionFile,
      activeTool,
      error: agentError,
    }
  }

  function broadcastAgentState() {
    options.publish({ type: 'state', state: getState() })
  }

  function disposeSession() {
    agentUnsubscribe?.()
    agentSession?.dispose()
    agentSession = null
    agentUnsubscribe = null
    agentSessionId = null
    agentSessionFile = null
    activeTool = null
    activeAssistantMessageId = null
  }

  function workspaceForRequest(request: MainMenuAgentPromptRequest) {
    return resolveAgentWorkspace({
      appRoot: options.appRoot,
      packagedWorkspacePath: options.packagedWorkspacePath(),
      context: request.context,
    })
  }

  function thinkingLevelForRequest(request: MainMenuAgentPromptRequest): MainMenuAgentThinkingLevel {
    return mainMenuAgentThinkingLevelOption(request.thinkingLevel).id
  }

  function thinkingLevelLabel(thinkingLevel: MainMenuAgentThinkingLevel) {
    return mainMenuAgentThinkingLevelOption(thinkingLevel).label
  }

  function formatAgentPrompt(request: MainMenuAgentPromptRequest, workspace: AgentWorkspace) {
    const context: MainMenuAgentContext = request.context ?? {
      projectId: workspace.projectId,
      sceneId: 'unknown',
      selectedPath: null,
      selectedId: null,
      selectedName: null,
      selectedType: null,
      selectedAsset: null,
    }

    return [
      'You are Scene Agent running inside the Main Menu desktop editor.',
      `Model: ${MAIN_MENU_AGENT_MODEL.label} (${MAIN_MENU_AGENT_MODEL.id})`,
      `Thinking level: ${thinkingLevelLabel(agentThinkingLevel)}`,
      `Working directory: ${workspace.cwd}`,
      `Project workspace source: ${workspace.source}`,
      `Project: ${context.projectId ?? workspace.projectId ?? 'default'}`,
      `Project root: ${workspace.cwd}`,
      `Engine app root: ${options.appRoot}`,
      `Scene: ${context.sceneId}`,
      `Scene file: ${workspace.sceneFile ?? 'unknown'}`,
      `Project manifest: ${workspace.manifestFile ?? 'unknown'}`,
      `Asset registry: ${workspace.assetRegistryFile ?? 'unknown'}`,
      `Module registry: ${workspace.moduleRegistryFile ?? 'unknown'}`,
      `Selected layer path: ${context.selectedPath ?? 'none'}`,
      `Selected layer id: ${context.selectedId ?? 'none'}`,
      `Selected layer: ${context.selectedName ?? 'none'}`,
      `Selected type: ${context.selectedType ?? 'none'}`,
      `Selected asset: ${context.selectedAsset ?? 'none'}`,
      '',
      'Use the project workspace files as the source of truth. For normal authoring requests, read and write files under the project root. Keep edits scoped to the active scene/project unless the user explicitly asks for engine code changes.',
      'When the selected layer is a component or effect, resolve the selected asset in the module registry before editing implementation files. Existing reusable components live under Assets/Modules in external projects. For a new reusable component, add its module files, manifest, and module registry entry, then add or update the scene layer only if requested.',
      '',
      request.message.trim(),
    ].join('\n')
  }

  function handlePiEvent(event: import('@mariozechner/pi-coding-agent').AgentSessionEvent) {
    if (event.type === 'agent_start') {
      agentStatus = 'running'
      agentError = null
      activeTool = null
      activeAssistantMessageId = null
    } else if (event.type === 'message_start') {
      const message = event.message as { role?: string }
      if (message.role === 'assistant') {
        activeAssistantMessageId = addAgentMessage('assistant', '').id
      }
    } else if (event.type === 'message_update') {
      if (event.assistantMessageEvent.type === 'text_delta') {
        if (!activeAssistantMessageId) {
          activeAssistantMessageId = addAgentMessage('assistant', '').id
        }
        appendAgentMessageText(activeAssistantMessageId, event.assistantMessageEvent.delta)
      }
    } else if (event.type === 'message_end') {
      const message = event.message as { role?: string }
      if (message.role === 'assistant') {
        const text = textFromAgentMessage(event.message)
        if (activeAssistantMessageId && text) updateAgentMessage(activeAssistantMessageId, text)
        activeAssistantMessageId = null
      }
    } else if (event.type === 'tool_execution_start') {
      activeTool = event.toolName
      addAgentMessage('tool', `Running ${event.toolName}`)
    } else if (event.type === 'tool_execution_end') {
      addAgentMessage('tool', `${event.toolName} ${event.isError ? 'failed' : 'finished'}`)
      activeTool = null
    } else if (event.type === 'agent_end') {
      agentStatus = 'idle'
      activeTool = null
      activeAssistantMessageId = null
    } else if (event.type === 'compaction_start') {
      addAgentMessage('system', 'Compacting session context')
    } else if (event.type === 'compaction_end') {
      if (event.errorMessage) addAgentMessage('error', event.errorMessage)
    }

    broadcastAgentState()
  }

  async function ensurePiAgentSession(workspace: AgentWorkspace, thinkingLevel: MainMenuAgentThinkingLevel) {
    if (agentSession && agentCwd === workspace.cwd && agentThinkingLevel === thinkingLevel) return agentSession

    if (agentSession && (agentCwd !== workspace.cwd || agentThinkingLevel !== thinkingLevel)) {
      const workspaceChanged = agentCwd !== workspace.cwd
      const thinkingChanged = agentThinkingLevel !== thinkingLevel
      disposeSession()
      if (workspaceChanged) addAgentMessage('system', `Switched Scene Agent workspace to ${workspace.cwd}`)
      if (thinkingChanged) addAgentMessage('system', `Changed thinking level to ${thinkingLevelLabel(thinkingLevel)}`)
    }

    agentStatus = 'starting'
    agentError = null
    agentCwd = workspace.cwd
    agentWorkspace = workspace
    agentThinkingLevel = thinkingLevel
    broadcastAgentState()

    try {
      const sdk = await importPiSdk()
      const sessionDir = path.join(options.sessionRoot(), workspace.projectId ?? 'default')
      await fs.mkdir(sessionDir, { recursive: true })
      const authStorage = sdk.AuthStorage.create()
      const modelRegistry = sdk.ModelRegistry.create(authStorage)
      const model = modelRegistry.find(MAIN_MENU_AGENT_MODEL.provider, MAIN_MENU_AGENT_MODEL.model)
      if (!model) throw new Error(`Scene Agent model not found: ${MAIN_MENU_AGENT_MODEL.id}`)

      const result = await sdk.createAgentSession({
        cwd: workspace.cwd,
        authStorage,
        modelRegistry,
        model,
        thinkingLevel,
        sessionManager: sdk.SessionManager.create(workspace.cwd, sessionDir),
      })

      agentSession = result.session
      agentSessionId = result.session.sessionId
      agentSessionFile = result.session.sessionFile ?? null
      agentUnsubscribe = result.session.subscribe(handlePiEvent)

      addAgentMessage('system', `Scene Agent session ready in ${agentCwd}`)
      if (result.modelFallbackMessage) addAgentMessage('system', result.modelFallbackMessage)
      agentStatus = 'idle'
      broadcastAgentState()
      return result.session
    } catch (error) {
      agentStatus = 'error'
      agentError = normalizeError(error)
      addAgentMessage('error', agentError)
      broadcastAgentState()
      throw error
    }
  }

  async function sendMessage(request: MainMenuAgentPromptRequest): Promise<MainMenuAgentState> {
    const message = typeof request?.message === 'string' ? request.message.trim() : ''
    if (message.length === 0) throw new Error('Message is required')

    const workspace = workspaceForRequest(request)
    const thinkingLevel = thinkingLevelForRequest(request)
    addAgentMessage('user', message)
    agentStatus = 'running'
    agentError = null
    broadcastAgentState()

    try {
      const session = await ensurePiAgentSession(workspace, thinkingLevel)
      const prompt = formatAgentPrompt({ ...request, message }, agentWorkspace ?? workspace)
      const sessionOptions = session.isStreaming ? { streamingBehavior: 'steer' as const } : undefined
      void session.prompt(prompt, sessionOptions).catch((error: unknown) => {
        agentStatus = 'error'
        agentError = normalizeError(error)
        activeTool = null
        activeAssistantMessageId = null
        addAgentMessage('error', agentError)
        broadcastAgentState()
      })
    } catch (error) {
      agentStatus = 'error'
      agentError = normalizeError(error)
      addAgentMessage('error', agentError)
      broadcastAgentState()
    }

    return getState()
  }

  async function abort(): Promise<MainMenuAgentState> {
    if (agentSession) await agentSession.abort()
    agentStatus = 'idle'
    activeTool = null
    addAgentMessage('system', 'Stopped')
    broadcastAgentState()
    return getState()
  }

  async function reset(): Promise<MainMenuAgentState> {
    disposeSession()
    agentMessages = []
    agentStatus = 'idle'
    agentCwd = null
    agentWorkspace = null
    agentError = null
    broadcastAgentState()
    return getState()
  }

  return {
    getState,
    sendMessage,
    abort,
    reset,
    dispose: disposeSession,
  }
}
