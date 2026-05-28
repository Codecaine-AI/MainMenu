---
covers: Pi Agent chat sidebar, preload bridge, Electron IPC handlers, SDK session lifecycle, and renderer security boundary.
concepts: [pi-agent, chat-sidebar, ipc, preload-bridge, sdk-session, context-handoff]
code-ref: [apps/scene-engine/app/editor/_components/PiAgentChatPanel.tsx, apps/scene-engine/app/editor/_components/HierarchyPanel.tsx, apps/scene-engine/desktop/main/index.ts, apps/scene-engine/desktop/preload/index.ts, apps/scene-engine/desktop/types/main-menu.ts]
---

# Pi Agent

The Pi Agent is a desktop-only chat panel docked at the bottom of the editor's left sidebar. The hierarchy remains the primary layer-selection surface above it.

The renderer never imports the Pi SDK. Electron main owns the SDK session and sends state snapshots back to the renderer through IPC.

## Renderer Surface

`PiAgentChatPanel.tsx` renders:

- transcript
- message input
- `Send`
- `Stop`
- `Clear`
- current status and session details

Each send request includes:

| Field | Meaning |
| --- | --- |
| `projectId` | Active project from the editor route. |
| `sceneId` | Active scene from the editor route. |
| `selectedPath` | Dotted selected layer path from the hierarchy/editor store. |
| `selectedLayerName` | Human-readable name for the selected layer. |
| `selectedLayerType` | Layer type used for prompt context. |

The panel degrades gracefully in a normal browser tab. If `window.mainMenu?.agent` is unavailable, the UI reports that the desktop bridge is unavailable.

## Preload Bridge

Preload exposes:

```ts
window.mainMenu.agent.getState()
window.mainMenu.agent.sendMessage(request)
window.mainMenu.agent.abort()
window.mainMenu.agent.reset()
window.mainMenu.agent.onEvent(handler)
```

The bridge is defined in `desktop/types/main-menu.ts` and implemented in `desktop/preload/index.ts`. It is the only renderer-accessible native API surface for the agent.

## Main Process Session

Electron main lazily imports:

```text
@mariozechner/pi-coding-agent
```

The pinned package line is currently:

```text
@mariozechner/pi-coding-agent@^0.73.1
```

The session is created with:

```ts
createAgentSession({
  cwd: editableWorkspaceRoot(),
  sessionManager: SessionManager.create(cwd, sessionDir),
})
```

`editableWorkspaceRoot()` selects the writable workspace in packaged mode and the project package root in development mode. Session files live under the app user-data directory.

## State Flow

The main process keeps the authoritative agent state:

- `status`
- transcript messages
- `cwd`
- `sessionId`
- `sessionFile`
- last error

SDK events update this state. The main process emits `main-menu:agent:event` to the renderer whenever state changes. The renderer uses `getState()` on mount and subscribes to events for live updates.

## Abort And Reset

`abort()` forwards to the active SDK session and returns the latest state. `reset()` unsubscribes, disposes the session, clears transcript/status/session ids, and returns an idle state.

## Security Boundary

The renderer cannot access filesystem or shell primitives directly. It can only ask the native process to start/stop/reset the agent session through the typed bridge. This keeps project-editing authority in Electron main while preserving `contextIsolation` and `nodeIntegration: false`.

## Validation Status

The bridge, package import, dev panel, packaged panel, and security scans have been validated. Live model prompts were intentionally left for manual testing so credentials/tokens and resulting file edits stay under user control.
