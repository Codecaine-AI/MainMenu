# Main Menu Desktop App Report

Date: 2026-05-23

## Summary

`apps/scene-engine` is now the macOS Electron desktop authoring app **Main Menu** while preserving the existing Next editor as the renderer.

The desktop implementation adds a native-process boundary under `apps/scene-engine/desktop/`, keeps renderer Node integration off, exposes a typed preload bridge at `window.mainMenu`, and packages a local Next standalone runtime so the mac app does not depend on an already-running `localhost:3000`.

## Changed Paths

- `apps/scene-engine/package.json`
- `apps/scene-engine/package-lock.json`
- `apps/scene-engine/next.config.ts`
- `apps/scene-engine/tsconfig.json`
- `apps/scene-engine/desktop/**`
- `apps/scene-engine/app/_components/DesktopBridgeProbe.tsx`
- `apps/scene-engine/app/layout.tsx`
- `apps/scene-engine/app/page.tsx`
- `.gitignore`
- `objectives/main-menu-desktop-app/artifacts/**`

## Architecture

Electron main owns native lifecycle, menus, window creation, packaged runtime startup, and IPC handlers.

Preload exposes:

```ts
window.mainMenu.app.getInfo()
```

The renderer consumes the bridge only through a hidden validation probe. React components do not import Electron main-process modules.

Window security settings:

```text
contextIsolation: true
nodeIntegration: false
```

## Runtime Strategy

Development:

- `npm run desktop:dev`
- Reuses `http://localhost:3000/` when healthy.
- Starts a private free-port Next dev server when the default health check fails.
- Opens `/editor?project=codecaine&scene=title` in an Electron window titled `Main Menu`.

Packaged:

- `next.config.ts` uses `output: 'standalone'`.
- `desktop/scripts/prepare-next-runtime.mjs` stages the standalone server as an Electron `extraResources` payload.
- On app launch, Electron copies runtime code to `~/Library/Application Support/Main Menu/runtime/<version>/`.
- Bundled `public` and `projects` templates seed `~/Library/Application Support/Main Menu/workspace/`.
- Runtime `public` and `projects` paths are symlinked to that writable workspace before the local Next server starts.

This preserves the current filesystem-backed API behavior while preventing saves from targeting read-only app resources.

## Package Artifact

```text
apps/scene-engine/dist/desktop/mac-arm64/Main Menu.app
```

Bundle metadata:

- Display name: `Main Menu`
- Executable: `Main Menu`
- Bundle identifier: `com.codecaine.main-menu`
- Version: `1.0.0`
- Target: mac `dir`
- Signing/notarization: intentionally skipped

## Validation

- `npm run desktop:compile` passed.
- `npx tsc --noEmit` passed.
- `npm run desktop:dev` opened Main Menu and loaded the editor.
- Dev bridge smoke passed: `window.mainMenu.app.getInfo()` returned `Main Menu`; `typeof window.require` was `undefined`.
- `npm run desktop:pack:mac` passed.
- Packaged launch passed without external `localhost:3000`; bridge reported `packaged: true` and `rendererUrl: http://127.0.0.1:59500/editor?project=codecaine&scene=title`.
- Packaged layer selection passed: clicked hierarchy row `data-path=0` labeled `Base Barber Cylinder [component]`; selected styling changed from false to true.
- Packaged scene persistence passed: `GET /api/scenes/title?project=codecaine -> 200`, `PUT /api/scenes/title?project=codecaine -> 204`.

Screenshots:

- `objectives/main-menu-desktop-app/artifacts/screenshots/desktop_dev_editor.png`
- `objectives/main-menu-desktop-app/artifacts/screenshots/desktop_dev_playwright_editor.png`
- `objectives/main-menu-desktop-app/artifacts/screenshots/mac_packaged_editor.png`

## Helper Layout

Helper app relocation is deferred with no files moved. Current helper paths are still referenced by the Makefile, helper READMEs, Python path derivation, and the PI asset-loop bun entrypoint. Moving them should be a separate mechanical objective with entrypoint validation.

## Scope Boundary

This objective only converted `apps/scene-engine` into the Main Menu Electron app. It did not implement a PI Agent sidebar, terminal UI, or autonomous scene-editing workflow.

## Risks And Follow-Ups

- Add a custom Main Menu app icon.
- Define update/migration behavior for existing user workspaces.
- Consider a narrower IPC migration for scene/project APIs if the embedded Next server becomes too heavy.
- Add notarization, signing, auto-update, and distribution only in a later release objective.
