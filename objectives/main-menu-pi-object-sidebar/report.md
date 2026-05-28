# Main Menu Pi Agent Chat Sidebar Report

Date: 2026-05-24

## Summary

The previous `PI Object` interpretation has been corrected. Main Menu now has a normal `Pi Agent` chat panel docked at the bottom of the editor left sidebar. The hierarchy remains above it as the primary layer-selection surface.

The renderer talks only through `window.mainMenu.agent`; Electron main owns the Pi SDK session and the working-directory authority for project edits.

## Changed Paths

- `apps/scene-engine/app/editor/_components/PiAgentChatPanel.tsx`
- `apps/scene-engine/app/editor/_components/HierarchyPanel.tsx`
- `apps/scene-engine/desktop/types/main-menu.ts`
- `apps/scene-engine/desktop/preload/index.ts`
- `apps/scene-engine/desktop/main/index.ts`
- `apps/scene-engine/package.json`
- `apps/scene-engine/package-lock.json`
- `objectives/main-menu-pi-object-sidebar/**`

## Behavior

- The bottom of the left sidebar shows `Pi Agent`.
- The panel includes transcript, message input, `Send`, `Stop`, and `Clear`.
- Each request carries project id, scene id, selected layer path, selected layer name, and selected layer type.
- Agent status streams back through IPC as state updates.
- The old `PI Object` panel and `project.scaffoldComponent` bridge are gone.

## SDK Integration

Electron main lazily imports the Pi SDK and creates a session when the user sends a message:

```ts
createAgentSession({
  cwd: editableWorkspaceRoot(),
  sessionManager: SessionManager.create(cwd, sessionDir),
})
```

The current package is:

```text
@mariozechner/pi-coding-agent@0.73.1
```

Reason: the current Electron app is on Electron 30, validated with embedded Node `20.16.0`. The newer `@earendil-works/pi-coding-agent@0.75.5` declares Node `>=22.19.0`, so it is not compatible with this runtime without an Electron upgrade.

## Validation

Passed:

- `npm run desktop:compile`
- `npx tsc --noEmit`
- Electron runtime SDK import check
- Dev Electron chat-panel smoke
- `npm run desktop:pack:mac`
- Packaged Electron chat-panel smoke
- Packaged `app.asar` SDK import check
- Source/security scan

Screenshots:

- `objectives/main-menu-pi-object-sidebar/artifacts/screenshots/dev_pi_agent_chat_panel.png`
- `objectives/main-menu-pi-object-sidebar/artifacts/screenshots/packaged_pi_agent_chat_panel.png`

## Security

Renderer code does not import the Pi SDK, Electron main modules, `fs`, or shell helpers. The BrowserWindow still uses `contextIsolation: true` and `nodeIntegration: false`. Native authority stays in Electron main.

## Remaining Risk

No live model prompt was sent during validation to avoid spending credentials/tokens or making unreviewed edits. The panel is wired to the SDK and ready for manual prompt testing.
