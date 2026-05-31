---
covers: Main Menu Electron desktop app — packaged authoring shell, Next runtime startup, preload bridge, and Pi Agent ownership.
type: overview
concepts: [desktop-app, electron, main-menu, next-standalone, preload-bridge, pi-agent]
code-ref: apps/scene-engine/desktop
---

# Desktop App

Main Menu is the Electron desktop authoring app for `apps/scene-engine`. It opens the same Next editor that runs in the browser, but packages the runtime and owns native capabilities that should not be exposed to React.

The desktop app has two responsibilities:

- start or locate a local Next runtime and open the editor
- expose a narrow typed bridge at `window.mainMenu`

It does not introduce a second editor implementation or a separate scene data model.

## File Tree

```
apps/scene-engine/desktop/
├── main/index.ts                         Electron main process
├── preload/index.ts                      contextBridge surface
├── types/main-menu.ts                    shared bridge and agent types
├── scripts/dev.mjs                       desktop dev launcher
├── scripts/prepare-next-runtime.mjs      stages Next standalone runtime
├── scripts/run-with-compatible-node.mjs  build helper for compatible Node
└── tsconfig.json
```

Related root files:

```
apps/scene-engine/
├── package.json                          desktop scripts + electron-builder config
├── next.config.ts                        output: 'standalone'
├── app/editor/_features/pi-agent/         renderer Pi Agent panel + controller
└── desktop/main/pi-agent/                 Electron Pi SDK service + workspace resolver
```

## Child Nodes

### [10-runtime.md](10-runtime.md)
How Electron starts in development and packaged modes, how the Next standalone runtime is staged, and where writable workspace files live.

### [20-pi-agent.md](20-pi-agent.md)
How the Pi Agent chat panel crosses the renderer/native boundary, starts SDK sessions, streams state, and preserves browser sandboxing.

## Boundaries

Electron main owns native state, runtime process management, application lifecycle, menus, shell opens, IPC handlers, and Pi SDK sessions.

Preload exposes a typed bridge. It does not leak Node primitives into the renderer.

The renderer remains a web app. It calls `window.mainMenu` when available and otherwise behaves like the normal browser editor.
