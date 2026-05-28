---
covers: Dev server startup, build commands, the URLs the scene-engine serves.
concepts: [dev-server, urls, npm-scripts, makefile]
---

# Running

Two ways to start the scene-engine: directly with npm, or via the repository-root Makefile.

---

## Start the dev server

From the scene-engine directory:

```bash
cd apps/scene-engine
npm install   # first time only
npm run dev
```

Or from the repo root:

```bash
make dev
```

The Makefile sets `FRONTEND_DIR=apps/scene-engine` and forwards.

The dev server listens on `http://localhost:3000`.

## Production build

```bash
npm run build       # outputs apps/scene-engine/.next/
make build          # same, from repo root
```

The production build is a Next.js app. Use `npm run start` or `make preview` after building to serve it locally.

## Desktop app

From `apps/scene-engine`:

```bash
npm run desktop:compile
npm run desktop:dev
```

`desktop:dev` opens the Main Menu Electron app. It reuses `http://localhost:3000/` when that server is already healthy; otherwise it starts a private free-port Next dev server and opens the editor route.

Package the macOS app directory:

```bash
npm run desktop:pack:mac
```

The package flow compiles Electron main/preload code, builds Next with `output: 'standalone'`, stages the runtime under `desktop/dist-next`, and writes the app directory under:

```text
apps/scene-engine/dist/desktop/mac-arm64/Main Menu.app
```

Signing, notarization, auto-update, and installer packaging are not part of the current command set.

## URLs

| URL                                          | What it serves                                  |
|----------------------------------------------|-------------------------------------------------|
| `http://localhost:3000/`                     | Dashboard — list of projects                    |
| `http://localhost:3000/projects/<project-id>` | Project page — list of scenes + links          |
| `http://localhost:3000/scenes/<id>?project=<project-id>` | Preview of one project scene            |
| `http://localhost:3000/editor?project=<project-id>&scene=<id>` | Visual editor for the named scene |
| `http://localhost:3000/upload`               | Asset upload page                               |
| `http://localhost:3000/upload?project=<project-id>` | Project-scoped asset upload page        |
| `http://localhost:3000/api/projects/<project-id>/registries/assets` | Project asset registry         |
| `http://localhost:3000/api/projects/<project-id>/registries/modules` | Project module registry       |
| `http://localhost:3000/api/scenes?project=<project-id>` | `GET` — list scenes                    |
| `http://localhost:3000/api/scenes/<id>?project=<project-id>` | `GET` / `PUT` scene JSON          |
| `http://localhost:3000/api/export?project=<project-id>` | `POST` — standalone zip export         |

The `/api/*` endpoints are Next route handlers and are part of the app runtime.

## Workspace catalog

The engine discovers external projects through `apps/scene-engine/workspace.catalog.json`. That file is local and gitignored. Start from:

```text
apps/scene-engine/workspace.catalog.example.json
```

For the current Codecaine workspace, the catalog root resolves from `apps/scene-engine` to:

```text
../../../codecaine-site
```

Use `SCENE_ENGINE_WORKSPACE_CATALOG=/absolute/or/relative/path.json` to point the server at another catalog file.

## Adding a New Scene

1. Create `Assets/Scenes/<id>/scene.json` under the catalog project root (kebab-case `id`).
2. Add the scene to `ProjectSettings/project.json`.
3. The new scene appears on the project page and is accessible at `/scenes/<id>?project=<project-id>`.

## Export a standalone site

From any running Scene Engine server:

```bash
curl -fS -X POST "http://localhost:3000/api/export?project=codecaine" -o codecaine.zip
```

After extracting the zip:

```bash
make run
```

or:

```bash
node server.mjs --host 127.0.0.1 --port 4173
```
