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

## URLs

| URL                                          | What it serves                                  |
|----------------------------------------------|-------------------------------------------------|
| `http://localhost:3000/`                     | Dashboard — list of projects                    |
| `http://localhost:3000/projects/<project-id>` | Project page — list of scenes + links          |
| `http://localhost:3000/scenes/<id>?project=<project-id>` | Preview of one project scene            |
| `http://localhost:3000/editor?project=<project-id>&scene=<id>` | Visual editor for the named scene |
| `http://localhost:3000/upload`               | Asset upload page                               |
| `http://localhost:3000/assets/registry.json` | Public asset registry                           |
| `http://localhost:3000/modules/registry.json` | Public module registry                         |
| `http://localhost:3000/api/scenes?project=<project-id>` | `GET` — list scenes                    |
| `http://localhost:3000/api/scenes/<id>?project=<project-id>` | `GET` / `PUT` scene JSON          |
| `http://localhost:3000/api/export?project=<project-id>` | `POST` — standalone zip export         |

The `/api/*` endpoints are Next route handlers and are part of the app runtime.

## Adding a New Scene

1. Create `apps/scene-engine/projects/<project-id>/scenes/<id>/scene.json` (kebab-case `id`).
2. Add the scene to `apps/scene-engine/projects/<project-id>/project.json`.
3. The new scene appears on the project page and is accessible at `/scenes/<id>?project=<project-id>`.
