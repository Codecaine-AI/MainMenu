---
covers: Multi-input Vite build, scene discovery, and the closeBundle hook that copies static files into dist/.
concepts: [build, multi-input, rollup, closeBundle, scene-discovery, dist]
design_refs: [10-system-design/50-build-output.md]
---

# Build Pipeline

The production build is a single `vite build` invocation. It uses Rollup's multi-input mode to bundle one HTML page per scene plus the dashboard and editor, then copies static files into `dist/`.

---

## Inputs

`buildInput(rootDir, discoveredScenes)` returns the Rollup input map:

```js
{
  root:        <rootDir>/index.html,         // dashboard
  editor:      <rootDir>/editor/index.html,  // visual editor
  scene_<id>:  <rootDir>/scenes/<id>/index.html  // one per discovered scene
}
```

The input keys become the chunk names. The number of HTML inputs equals `2 + discoveredScenes.length`.

## Scene Discovery (`scripts/discover-scenes.js`)

Two exports:

| Function                  | Purpose                                                                |
|---------------------------|------------------------------------------------------------------------|
| `discoverScenes(rootDir)` | Walks `scenes/` and returns `[{ id, sceneJsonPath }]` for every directory containing a `scene.json`. Filters out IDs that don't match the kebab-case regex. |
| `ensureAllSceneHtml(rootDir)` | Calls `discoverScenes` and, for each scene, generates `scenes/<id>/index.html` if it doesn't exist. The generated HTML is a tiny shell that sets `window.__SCENE_ID__` and imports the renderer entry. |

`ensureAllSceneHtml` runs at config-load time so Rollup sees the generated HTML files when it computes the input map. Adding a new scene therefore requires either restarting the dev server or running the build — Vite does not pick up brand-new scenes mid-session.

## `copyStaticAssetsPlugin`

A Vite plugin with `apply: 'build'` and a `closeBundle` async hook. Runs after Rollup writes the JS/CSS/HTML bundles.

### What it copies

1. **`assets/` → `dist/assets/`** (recursive). Includes `registry.json` and every file under `glyphs/`, `media/`, `effects/`, `components/`, `audio/`.
2. **For each discovered scene: `scenes/<id>/scene.json` → `dist/scenes/<id>/scene.json`**.

### Why a plugin

Vite normally only bundles files reachable through ES module imports. The renderer **fetches** `scene.json` and asset files at runtime, so they're invisible to Rollup's import graph. Without this hook, `dist/` would be missing both, and the deployed site would render nothing.

The `public/` directory could be used for `assets/`, but `scene.json` files live under `scenes/<id>/` for editing convenience, not under `public/`. Using a custom `closeBundle` keeps the source layout clean.

## Build Output Tree

After `npm run build`:

```
dist/
├── index.html                 dashboard
├── editor/index.html          editor shell
├── scenes/<id>/index.html     one per scene (generated)
├── scenes/<id>/scene.json     copied from source
├── assets/                    full registry tree, copied from source
└── assets/<bundle-chunks>/    Rollup-emitted JS/CSS chunks (separate hash subpaths)
```

The same directory `dist/assets/` ends up holding both the source asset tree (copied) and Rollup's bundled chunks. Rollup's hashed filenames don't collide with the registry's known paths (`/assets/media/...`, `/assets/glyphs/...`).

## Source

- `apps/scene-engine/vite.config.js` — `buildInput`, `copyStaticAssetsPlugin`.
- `apps/scene-engine/scripts/discover-scenes.js` — `discoverScenes`, `ensureAllSceneHtml`.
