# Chat Bridge Contract

Renderer surface:

```ts
window.mainMenu.agent.getState()
window.mainMenu.agent.sendMessage(request)
window.mainMenu.agent.abort()
window.mainMenu.agent.reset()
window.mainMenu.agent.onEvent(listener)
```

Prompt request:

```ts
interface MainMenuAgentPromptRequest {
  message: string
  context: {
    projectId: string | null
    sceneId: string
    selectedPath: string | null
    selectedName: string | null
    selectedType: string | null
  }
}
```

State response:

```ts
interface MainMenuAgentState {
  status: 'idle' | 'running' | 'starting' | 'error'
  messages: MainMenuAgentMessage[]
  cwd: string | null
  sessionId: string | null
  sessionFile: string | null
  activeTool: string | null
  error: string | null
}
```

Authority boundary:

- React renders the chat and sends typed requests only.
- Electron main owns SDK import, session lifecycle, prompt execution, abort/reset, and event streaming.
- Project edits happen through Pi SDK tools from the main-process session working directory.
