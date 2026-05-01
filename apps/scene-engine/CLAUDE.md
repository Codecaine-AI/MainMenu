# Scene Engine

Next.js + React + Tailwind + Zustand app that replaces the old Vite-based frontend. Each page is a **scene** — a JSON manifest of typed asset layers rendered onto a 1440x1080 stage.

## Running

Dev server runs on **http://localhost:3000**.

- Dashboard: http://localhost:3000/
- Editor: http://localhost:3000/editor?scene=title
- Scene preview: http://localhost:3000/scenes/title
- Asset upload: http://localhost:3000/upload

Start: `npm run dev` (or `make dev` from repo root)
Build: `npm run build` (output in `.next/`)
Serve production: `npm run start`

## Project layout

```
apps/scene-engine/
  next.config.ts             Next.js configuration
  tsconfig.json              TypeScript config (strict, @/* path alias)
  postcss.config.mjs         Tailwind PostCSS plugin
  package.json               Dependencies: next, react, zustand, tailwindcss

  scenes/{id}/scene.json     Scene definitions (one per page, writable by API)

  public/
    assets/registry.json     Asset containers — { id: { type, file } } for the 4 asset types
    assets/audio/            Sound effects (.mp3, .wav, .ogg, optional JS wrappers)
    assets/image/            Static images (.png, .jpg, .webp, .gif)
    assets/video/            Video loops (.mp4, .webm)
    assets/glyph/            SVG font assets (.svg, from font-creation pipeline)
    modules/registry.json    Module entries — { id: { type, path } } for effects/components
    modules/effects/         CSS effect stylesheets
    modules/components/      Data-driven JS components (press-start, etc.)
    fonts/                   FolkPro font family

  app/
    layout.tsx               Root layout (dark theme, globals.css)
    globals.css              Tailwind imports, @font-face, editor grid, CSS vars
    page.tsx                 Dashboard — server component listing scenes

    scenes/[id]/page.tsx     Scene preview (client component, lazy renderer)

    upload/
      page.tsx               /upload — standalone asset upload form

    editor/
      page.tsx               Editor shell (4-panel grid, useSceneLoader)
      _components/
        CanvasPanel.tsx      Stage renderer + drag-drop target
        HierarchyPanel.tsx   Layer tree (collapsible, drag reorder)
        HierarchyRow.tsx     Recursive tree row
        InspectorPanel.tsx   Property editor for selected layer
        SubLayerForm.tsx     Named SVG sub-layer properties
        MediaChildForm.tsx   Foreign media child properties (blend, fit, repeat)
        LayerForm.tsx        Generic top-level layer properties (mounts AssetSwapDropdown)
        AssetSwapDropdown.tsx  Per-container file swap menu (asset types only)
        EditorToolbar.tsx    Save/Reload + dirty indicator
        AssetBrowserPanel.tsx  Browse asset registry by type, drag onto canvas
        inputs/
          RangedInput.tsx    Slider + number synced, debounced commit
          BlendSelect.tsx    Blend mode dropdown
          FitSelect.tsx      Object-fit dropdown
          ClipSelect.tsx     Clip-path dropdown

    api/
      scenes/route.ts        GET /api/scenes — list all scenes
      scenes/[id]/route.ts   GET scene.json, PUT to save
      upload/route.ts        POST — write asset file + register container
      assets/[type]/route.ts GET — list files in /assets/{type}/ (powers swap dropdown)
      registry/[id]/route.ts PATCH — update a container's file pointer

  src/
    store/
      editor-store.ts       Zustand store (scene, registry, selectedPath, mutations)
    hooks/
      useSceneLoader.ts     Fetches registry + scene, expands glyph-group children
    lib/
      path.ts               resolveLayer, resolveLayerEl
      patch.ts              patchFromDottedKey utility
      scenes.ts             Server-side scene discovery (fs)
      inspector-config.ts   BLEND_MODES, FIT_OPTIONS, NUMERIC_PROPERTY_STEPS, etc.
      asset-types.ts        Asset taxonomy + mime/ext allowlists + slugify + validateUpload
    types/
      scene.ts              TypeScript interfaces (SceneJson, LayerDef, Registry, etc.)
    renderer/
      scene-renderer.js     Reads scene.json -> DOM (imperative, unchanged)
      asset-registry.js     Loads + merges assets/registry.json + modules/registry.json; updateEntry for swaps
      positioning.js        Applies layer position (center, %, px)
      asset-renderers/
        index.js            Renderer dispatch by asset type
        glyph-group.js      Layered SVG with children/sub-layers + tiling
        media.js            Video/image
        css-effect.js       CSS effects (CRT, vortex)
        component.js        Data-driven JS components
        audio.js            Web Audio assets
        stylesheet.js       Shared stylesheet loader
```

## Scene data format

`scenes/{id}/scene.json` — the canonical scene format. Z-order is array position (last on top).

```json
{
  "id": "title",
  "name": "Title Screen",
  "stage": { "width": 1440, "height": 1080 },
  "layers": [
    {
      "id": "bg-video",
      "type": "media",
      "asset": "bg-video",
      "properties": { "fit": "cover", "blend": "normal", "opacity": 1.0 }
    },
    {
      "id": "codecaine-logo",
      "type": "glyph-group",
      "asset": "codecaine-logo",
      "position": { "x": "center", "y": "33%" },
      "properties": { "scale": 0.18, "shimmer": true },
      "children": [
        { "id": "extrusion-shadow", "layer": "chrome-extrusion-shadow-layer", "visible": true },
        { "id": "in-text-fire", "type": "media", "asset": "in-text-fire", "properties": { "blend": "screen", "repeat_x": 1, "repeat_y": 1 } }
      ]
    }
  ]
}
```

**Layer types**: `glyph-group`, `media`, `effect`, `component`, `audio`

**Container types** (registry `type` field): `audio`, `image`, `video`, `glyph` (assets) and `effect`, `component` (modules). The layer's `type` and the container's `type` are expected to match.

**Group children** can be either named sub-layer overrides (`"layer": "data-layer-id"`) or foreign assets (`"type": "media"`) interleaved between the group's internal layers. Foreign media children support `repeat_x`/`repeat_y` for CSS Grid tiling.

## Asset registry (split)

There are two registries, merged at runtime by the renderer into a single ID-keyed map:

- **`public/assets/registry.json`** — uploadable file containers. Shape: `{ id: { type, file } }` where `type ∈ { audio, image, video, glyph }`. The `file` is the URL of the current bytes; swappable via the inspector.
- **`public/modules/registry.json`** — authored code modules. Shape: `{ id: { type, path } }` where `type ∈ { effect, component }`. Hand-edited.

Layers reference container IDs only; swapping the file in a container updates every scene that uses it. The expected path for adding a new asset is the `/upload` page, which writes the file under `public/assets/{type}/` and adds the container automatically.

## API endpoints

- `GET   /api/scenes` — list all scenes (returns `[{id, name, layerCount}]`)
- `GET   /api/scenes/{id}` — read scene.json
- `PUT   /api/scenes/{id}` — save scene.json (body = full scene JSON)
- `POST  /api/upload` — multipart `file`+`type`; writes file and registers container
- `GET   /api/assets/{type}` — list files in `public/assets/{type}/` (powers the swap dropdown)
- `PATCH /api/registry/{id}` — body `{ file }`; updates a container's file pointer

## Architecture notes

- **Imperative renderer**: The `src/renderer/` code is vanilla JS, unchanged from the Vite era. React wraps it via `useEffect` + `useRef` — it's a black box that owns the stage DOM.
- **Zustand store** replaces the old `state.js` EventTarget pub/sub. Same shape and mutation algorithms, wrapped in `create()`.
- **Inspector focus guard**: `InspectorPanel` subscribes only to `selectedPath`, not `scene`, so property edits via sliders don't re-render the form. `key={selectedPath}` resets forms on selection change.
- **SSR safety**: All renderer imports happen inside `useEffect` (browser-only). `'use client'` directives on all components that touch DOM APIs.
- **Dynamic imports**: Component and audio assets use runtime `import(path)` from `public/` static files. The "Critical dependency" webpack warnings are expected and benign.

## Conventions

- React components in `app/`, shared logic in `src/`.
- Tailwind for styling; minimal custom CSS in `globals.css` for grid layout and font-face.
- Asset renderer interface: each `asset-renderers/*.js` exports a `render(layer, registryEntry)` function returning a DOM element.
- Scene IDs must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- SVG sub-layer names use kebab-case `data-layer` attributes (e.g. `chrome-extrusion-shadow-layer`).
