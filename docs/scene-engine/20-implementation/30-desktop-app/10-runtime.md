---
covers: Main Menu desktop runtime startup, packaged Next standalone server, writable workspace seeding, and Electron window security.
concepts: [electron-main, next-standalone, packaged-runtime, workspace-seeding, browser-window-security]
code-ref: [apps/scene-engine/desktop/main/index.ts, apps/scene-engine/desktop/scripts/dev.mjs, apps/scene-engine/desktop/scripts/prepare-next-runtime.mjs, apps/scene-engine/package.json, apps/scene-engine/next.config.ts]
---

# Desktop Runtime

Main Menu runs the Scene Engine editor inside Electron. The editor is still served by Next; Electron supplies the native shell and chooses which Next runtime to load.

## Development Mode

`npm run desktop:dev` compiles desktop TypeScript and launches Electron. The dev script:

1. checks whether `http://localhost:3000/` is healthy
2. reuses that server when present
3. starts a private free-port Next dev server when the default server is unavailable
4. opens `/editor?project=codecaine&scene=title`

This keeps normal browser development and desktop development aligned.

## Packaged Mode

The package flow is:

```bash
npm run desktop:pack:mac
```

That expands to:

```text
desktop:compile
desktop:build:next
electron-builder --mac dir
```

`next.config.ts` sets `output: 'standalone'`. `desktop/scripts/prepare-next-runtime.mjs` copies the Next standalone output into `desktop/dist-next`, alongside a manifest consumed by Electron main. `electron-builder` ships that directory as `extraResources/next-runtime`.

On launch, Electron copies runtime resources into the user's application support directory and starts the local Next server from there. Runtime project data is writable, not stored inside read-only app resources.

## Workspace Handling

Packaged runtime state lives below the app user-data directory. Main Menu seeds a workspace directory and points `SCENE_ENGINE_WORKSPACE_CATALOG` at the packaged workspace catalog:

```text
~/Library/Application Support/Main Menu/
├── runtime/<version>/
├── workspace/
│   ├── workspace.catalog.example.json
│   └── workspace.catalog.json
└── pi-agent-sessions/
```

The workspace catalog still resolves projects through the same project path adapter as the browser dev server. The desktop app does not bypass the Scene Engine project model.

## BrowserWindow Security

The main BrowserWindow uses:

```text
contextIsolation: true
nodeIntegration: false
```

The renderer cannot call `require`, import Electron main modules, or touch the filesystem directly. Native capabilities are exposed only through preload's typed `window.mainMenu` bridge.

## App Identity

Current packaged app metadata:

| Field | Value |
| --- | --- |
| Product name | `Main Menu` |
| Bundle identifier | `com.codecaine.main-menu` |
| Output target | mac `dir` |
| Signing/notarization | skipped |

The local macOS package path is:

```text
apps/scene-engine/dist/desktop/mac-arm64/Main Menu.app
```
