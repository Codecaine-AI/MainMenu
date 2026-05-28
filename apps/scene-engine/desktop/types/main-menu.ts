export interface MainMenuAppInfo {
  productName: 'Main Menu'
  version: string
  platform: NodeJS.Platform
  packaged: boolean
  workspacePath: string | null
  rendererUrl: string
}

export interface MainMenuAgentContext {
  projectId: string | null
  sceneId: string
  selectedPath: string | null
  selectedName: string | null
  selectedType: string | null
}

export interface MainMenuAgentPromptRequest {
  message: string
  context: MainMenuAgentContext
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
