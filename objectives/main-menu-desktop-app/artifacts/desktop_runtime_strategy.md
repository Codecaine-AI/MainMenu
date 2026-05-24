# Main Menu Desktop Runtime Strategy

Captured: 2026-05-23

## Decision

Main Menu keeps the existing Next editor as the renderer. Electron owns the native shell under `apps/scene-engine/desktop/`, exposes a narrow typed preload bridge at `window.mainMenu`, and launches a local Next runtime for packaged builds.

## Development Runtime

`npm run desktop:dev` compiles `desktop/main` and `desktop/preload`, checks the configured dev origin, and opens Electron against the editor route.

Default route:

```text
/editor?project=codecaine&scene=title
```

If `http://localhost:3000/` is healthy, the command reuses it. If that health check fails, the command starts its own Next dev server on a free explicit port and loads that port. This matched the current workstation state: the pre-existing `localhost:3000` process served `/editor` but returned 500 for `/`, so validation used a private dev server at `127.0.0.1:59243`.

## Packaged Runtime

The package command uses Next `output: 'standalone'` and stages runtime files with `desktop/scripts/prepare-next-runtime.mjs`.

Staged package layout:

```text
Contents/Resources/next-runtime/
  manifest.json
  runtime/        # standalone Next server, .next/static, traced server dependencies
  seed/
    projects/    # bundled starter project data
    public/      # bundled starter assets/modules/fonts
```

On packaged launch, Electron copies `next-runtime/runtime` into:

```text
~/Library/Application Support/Main Menu/runtime/<version>/
```

It seeds writable data only if missing:

```text
~/Library/Application Support/Main Menu/workspace/public
~/Library/Application Support/Main Menu/workspace/projects
```

Then it creates runtime symlinks:

```text
runtime/<version>/public -> workspace/public
runtime/<version>/projects -> workspace/projects
```

The Next standalone server is launched with Electron's bundled runtime via `ELECTRON_RUN_AS_NODE=1`, bound to `127.0.0.1` on a free port. The renderer loads that internal URL. Validation reported `http://127.0.0.1:59500/editor?project=codecaine&scene=title`.

## Writable Data Strategy

The existing scene APIs use `process.cwd()/projects` and `process.cwd()/public/assets`. Rather than rewriting those APIs to IPC in this objective, packaged Main Menu makes `process.cwd()` the copied runtime directory and links the data-bearing paths to the writable workspace.

This keeps the current editor/API behavior intact while preventing scene saves and asset registry writes from targeting the read-only `.app` bundle.

Validated save path:

```text
~/Library/Application Support/Main Menu/workspace/projects/codecaine/scenes/title/scene.json
```

Packaged smoke test result:

```text
GET /api/scenes/title?project=codecaine -> 200
PUT /api/scenes/title?project=codecaine -> 204
```

## Security Boundary

Electron window settings:

```text
contextIsolation: true
nodeIntegration: false
```

Native capabilities are exposed only through `desktop/preload/index.ts`:

```ts
window.mainMenu.app.getInfo()
```

Renderer smoke validation confirmed `typeof window.require === 'undefined'`.

## Helper Layout Decision

Helper relocation is explicitly deferred. Current references include:

- `Makefile` using `apps/asset-extraction-pipeline`
- helper READMEs documenting both helper paths
- Python path derivation inside `apps/asset-extraction-pipeline/asset_extraction_pipeline/io/paths.py`
- `apps/pi-asset-loop` bun entrypoint and README references

No helper files were moved, so there is no broken half-move. A follow-up can relocate helpers to `apps/helpers/*` with a dedicated validation pass.

## Rejected Alternatives

- Browser-only Electron wrapper: rejected for packaged completion because it would depend on an external `localhost:3000`.
- Renderer filesystem access: rejected because React must remain UI-only with Node integration disabled.
- Full API-to-IPC migration: deferred because the standalone runtime plus writable workspace validates current scene loading/saving with much lower editor churn.
- Blind helper move: deferred to avoid breaking Makefile, README, Python, and bun entrypoints during the packaging milestone.

## Remaining Risks

- The package currently uses the default Electron icon.
- The local mac artifact is unsigned and unnotarized by design for this objective.
- The staged Next runtime is large because it includes traced standalone dependencies and media assets.
- Future app updates need a workspace migration/versioning policy beyond the first-launch seed behavior.
