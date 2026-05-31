export interface MainMenuAppInfo {
  productName: 'Main Menu'
  version: string
  platform: NodeJS.Platform
  packaged: boolean
  workspacePath: string | null
  rendererUrl: string
}

export type MainMenuCommand = 'save-scene' | 'export-project' | 'open-project'

export interface MainMenuCommandEvent {
  command: MainMenuCommand
}

export interface MainMenuAgentContext {
  projectId: string | null
  sceneId: string
  selectedPath: string | null
  selectedId: string | null
  selectedName: string | null
  selectedType: string | null
  selectedAsset: string | null
}

export const MAIN_MENU_AGENT_MODEL = {
  id: 'openai-codex/gpt-5.5',
  provider: 'openai-codex',
  model: 'gpt-5.5',
  label: 'GPT-5.5',
} as const

export type MainMenuAgentModelId = typeof MAIN_MENU_AGENT_MODEL.id

export const DEFAULT_MAIN_MENU_AGENT_MODEL_ID: MainMenuAgentModelId = MAIN_MENU_AGENT_MODEL.id

export const MAIN_MENU_AGENT_THINKING_LEVELS = [
  { id: 'off', label: 'Off' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'xhigh', label: 'X High' },
] as const

export type MainMenuAgentThinkingLevelOption = (typeof MAIN_MENU_AGENT_THINKING_LEVELS)[number]
export type MainMenuAgentThinkingLevel = (typeof MAIN_MENU_AGENT_THINKING_LEVELS)[number]['id']

export const DEFAULT_MAIN_MENU_AGENT_THINKING_LEVEL: MainMenuAgentThinkingLevel = 'medium'

export function mainMenuAgentThinkingLevelOption(
  thinkingLevel: string | null | undefined,
): MainMenuAgentThinkingLevelOption {
  return (
    MAIN_MENU_AGENT_THINKING_LEVELS.find((option) => option.id === thinkingLevel) ??
    MAIN_MENU_AGENT_THINKING_LEVELS.find((option) => option.id === DEFAULT_MAIN_MENU_AGENT_THINKING_LEVEL) ??
    MAIN_MENU_AGENT_THINKING_LEVELS[0]
  )
}

export interface MainMenuAgentPromptRequest {
  message: string
  context: MainMenuAgentContext
  thinkingLevel?: MainMenuAgentThinkingLevel
}

export interface MainMenuAgentMessage {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'system' | 'error'
  text: string
  timestamp: number
}

export interface MainMenuAgentState {
  status: 'idle' | 'running' | 'starting' | 'error'
  messages: MainMenuAgentMessage[]
  modelId: MainMenuAgentModelId
  thinkingLevel: MainMenuAgentThinkingLevel
  cwd: string | null
  sessionId: string | null
  sessionFile: string | null
  activeTool: string | null
  error: string | null
}

export interface MainMenuAgentEvent {
  type: 'state'
  state: MainMenuAgentState
}

export interface MainMenuBridge {
  app: {
    getInfo(): Promise<MainMenuAppInfo>
    onCommand(listener: (event: MainMenuCommandEvent) => void): () => void
  }
  agent: {
    getState(): Promise<MainMenuAgentState>
    sendMessage(request: MainMenuAgentPromptRequest): Promise<MainMenuAgentState>
    abort(): Promise<MainMenuAgentState>
    reset(): Promise<MainMenuAgentState>
    onEvent(listener: (event: MainMenuAgentEvent) => void): () => void
  }
}

declare global {
  interface Window {
    mainMenu?: MainMenuBridge
  }
}

export {}
