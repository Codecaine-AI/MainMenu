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

The dev server listens on `http://localhost:5173`.

## Production build

```bash
npm run build       # outputs apps/scene-engine/dist/
make build          # same, from repo root
```

`dist/` is a deployable static site. See [Build Pipeline](../30-dev-server/20-build-pipeline.md).

## URLs

| URL                                          | What it serves                                  |
|----------------------------------------------|-------------------------------------------------|
| `http://localhost:5173/`                     | Dashboard — list of scenes + links              |
| `http://localhost:5173/scenes/<id>/`         | Production preview of one scene                 |
| `http://localhost:5173/editor/?scene=<id>`   | Visual editor for the named scene               |
| `http://localhost:5173/scenes/<id>/scene.json` | Raw scene JSON (served as static)             |
| `http://localhost:5173/assets/registry.json` | Asset registry                                  |
| `http://localhost:5173/api/scenes`           | `GET` — list scenes (id, name, layerCount)      |
| `http://localhost:5173/api/scenes/<id>`      | `PUT` — save scene JSON (dev-server only)       |

The `/api/*` endpoints exist only on the dev server — they don't ship with the production build.

## Adding a New Scene

1. Create `apps/scene-engine/scenes/<id>/scene.json` (kebab-case `id`).
2. Restart the dev server so `ensureAllSceneHtml` runs scene discovery and generates the per-scene `index.html`.
3. The new scene appears on the dashboard and is accessible at `/scenes/<id>/`.
