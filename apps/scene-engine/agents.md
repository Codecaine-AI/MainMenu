# Agent Guide: Scene Engine

How to author, edit, and verify scenes programmatically from Claude Code or any file-based agent.

## Quick Start

The Scene Engine is a Next.js + React + Tailwind + Zustand app. Each page is a **scene**: a JSON manifest of typed asset objects rendered onto a 1440x1080 stage.

The dev server runs at **http://localhost:3000**.

- Dashboard: http://localhost:3000/
- Editor: http://localhost:3000/editor?scene=title
- Scene preview: http://localhost:3000/scenes/title
- Asset upload: http://localhost:3000/upload

Assume the dev server is already running in the user's dev container unless a request or failed health check proves otherwise. Next dev uses hot reload, so scene JSON, public module, component, CSS, and manifest edits should be checked through the running dev server/browser, not by rebuilding.

Start if needed:

```bash
npm run dev
```

Or from the repo root:

```bash
make dev
```

Build:

```bash
npm run build
```

Do **not** run `npm run build` after routine scene/component edits while the dev server is active. A production build rewrites `.next` and can destabilize a running `next dev` process with stale or missing chunks. Use build only when explicitly requested, before production handoff, or after app-level changes where production compilation is the specific thing being verified.

Serve production:

```bash
npm run start
```

## Common Commands

List available scenes:

```bash
curl -s http://localhost:3000/api/scenes | jq
```

Read a scene from disk:

```bash
cat apps/scene-engine/scenes/title/scene.json | jq
```

Fetch a scene from the dev server:

```bash
curl -s http://localhost:3000/api/scenes/title | jq
```

Save a scene through the API:

```bash
curl -X PUT http://localhost:3000/api/scenes/title \
  -H 'Content-Type: application/json' \
  -d @apps/scene-engine/scenes/title/scene.json
```

The PUT endpoint writes the JSON to disk with stable 2-space formatting.

## Project Layout

```text
apps/scene-engine/
  next.config.ts             Next.js configuration
  tsconfig.json              TypeScript config, strict, @/* path alias
  postcss.config.mjs         Tailwind PostCSS plugin
  package.json               Dependencies: next, react, zustand, tailwindcss

  scenes/{id}/scene.json     Scene definitions, one per page, writable by API

  public/
    assets/registry.json     Asset containers: { id: { type, file } }
    assets/audio/            Sound effects
    assets/image/            Static images
    assets/video/            Video loops
    assets/glyph/            SVG font assets
    modules/registry.json    Module entries: { id: { type, path } }
    modules/effects/         CSS effect stylesheets
    modules/components/      Data-driven JS components
    fonts/                   FolkPro font family

  app/
    page.tsx                 Dashboard
    scenes/[id]/page.tsx     Scene preview
    upload/page.tsx          Asset upload form
    editor/page.tsx          Editor shell
    api/scenes/route.ts      GET /api/scenes
    api/scenes/[id]/route.ts GET scene.json, PUT to save
    api/upload/route.ts      POST asset upload
    api/assets/[type]/route.ts
    api/registry/[id]/route.ts

    _engine/                 Private non-route implementation code (@/* alias)
    store/editor-store.ts    Zustand editor store
    hooks/useSceneLoader.ts  Fetches registry + scene
    lib/                     Shared scene, path, patch, asset utilities
    types/scene.ts           TypeScript scene interfaces
    renderer/                Imperative vanilla JS scene renderer
```

## Scene Data

Canonical scene files live at:

```text
scenes/{id}/scene.json
```

The current renderer uses an `objects` array. Z-order is array position: index 0 is back, last object is on top.

```json
{
  "id": "title",
  "name": "Title Screen",
  "stage": { "width": 1440, "height": 1080 },
  "objects": [
    {
      "id": "bg-video",
      "type": "video",
      "asset": "bg-video",
      "transform": { "mode": "fill" },
      "appearance": { "fit": "fill", "blend": "normal", "opacity": 0.75 }
    },
    {
      "id": "press-start",
      "type": "component",
      "asset": "orbit-press-start",
      "transform": {
        "x": "center",
        "y": 79,
        "width": 46,
        "height": 16,
        "anchor": "center"
      },
      "properties": {
        "text": "PRESS  START"
      }
    }
  ]
}
```

Object fields:

- `id`: unique object ID
- `type`: renderer type
- `asset`: registry ID, except assetless object types such as `group` or `text`
- `visible`: optional boolean
- `transform`: placement and sizing
- `appearance`: opacity, blend, hue, saturation, fit
- `properties`: renderer/component-specific data
- `children`, `slots`, `events`: optional object-specific configuration

Common object types:

| type | what it renders |
| --- | --- |
| `video`, `image`, `media` | video or image assets |
| `effect` | CSS overlay effects |
| `glyph-group` | layered SVG font/glyph assets |
| `component` | authored JS components |
| `audio` | Web Audio assets |
| `group` | assetless grouping object |
| `text` | assetless text object |

## Transform

Full-stage objects:

```json
"transform": { "mode": "fill" }
```

Positioned objects:

```json
"transform": {
  "x": "center",
  "y": 33,
  "width": 80.5,
  "height": "auto",
  "anchor": "center"
}
```

Numeric `x`, `y`, `width`, and `height` values are percentages. Pin values like `"center"`, `"top"`, `"bottom"`, `"left"`, and `"right"` are supported where applicable. `rotation` and `scale` may also be used.

## Asset Registries

There are two registries, merged at runtime by `app/_engine/renderer/asset-registry.js`.

`public/assets/registry.json` is for uploadable file containers:

```json
{
  "bg-video": {
    "type": "video",
    "file": "/assets/video/test-fire-2.mp4"
  }
}
```

Container types: `audio`, `image`, `video`, `glyph`.

`public/modules/registry.json` is for authored code modules:

```json
{
  "orbit-press-start": {
    "type": "component",
    "path": "/modules/components/orbit-press-start/orbit-press-start.js"
  }
}
```

Module types: `effect`, `component`.

Layers/objects reference container IDs only. Swapping a file in a container updates every scene using that container. Prefer the `/upload` page for adding new file assets; it writes under `public/assets/{type}/` and registers the container automatically.

## API Endpoints

- `GET /api/scenes` — list all scenes
- `GET /api/scenes/{id}` — read `scene.json`
- `PUT /api/scenes/{id}` — save full scene JSON
- `POST /api/upload` — multipart `file` + `type`; writes file and registers container
- `GET /api/assets/{type}` — list files in `public/assets/{type}/`
- `PATCH /api/registry/{id}` — body `{ "file": "..." }`; updates a container's file pointer

## Editing Scenes

Edit `scenes/{id}/scene.json` directly. The editor picks up changes after Reload or browser refresh.

Scene IDs must match:

```text
^[a-z0-9]+(?:-[a-z0-9]+)*$
```

To create a new scene:

1. Create `scenes/{id}/scene.json`.
2. Use the standard scene JSON shape with `id`, `name`, `stage`, and `objects`.
3. Refresh the dashboard at http://localhost:3000/.

## Components And Effects

Component and audio assets are loaded dynamically from public static files. Component modules should default-export a function:

```js
export default function ({ properties = {}, layerId } = {}) {
  const el = document.createElement('div');
  if (layerId) el.dataset.layerId = layerId;
  return el;
}
```

For components, the renderer automatically loads a sibling CSS file with the same base name when present.

Module manifests may live next to component/effect modules as `manifest.json`. The editor uses them to expose configurable properties.

## Architecture Notes

- `app/_engine/renderer/` is an imperative vanilla JS renderer. React mounts it through `useEffect` and `useRef`.
- `app/_engine/` is a private App Router folder, so it can sit under `app/` without creating routes.
- Zustand replaces the old EventTarget pub/sub editor state.
- Renderer imports happen inside `useEffect` for SSR safety.
- Dynamic imports from `public/` static files can produce expected benign webpack warnings.
- The inspector has focus guards so slider edits do not constantly remount the form.

## Verification

After editing a scene or public component/module, prefer lightweight validation against the hot-reloading dev server:

```bash
cat apps/scene-engine/scenes/title/scene.json | jq . > /dev/null && echo "valid"
cat apps/scene-engine/public/modules/components/orbit-press-start/manifest.json | jq . > /dev/null && echo "manifest valid"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/scenes/title
```

Expected HTTP status: `200`.

Always verify the visual result in the already-running browser/dev server:

- Preview: http://localhost:3000/scenes/title
- Editor: http://localhost:3000/editor?scene=title

## Current Scene

| id | name | description |
| --- | --- | --- |
| `title` | Title Screen | CODECAINE chrome logo, procedural sphere, orbiting PRESS START component, CRT, audio |
