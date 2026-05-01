---
covers: vite.config.js — scene discovery, scene-save API plugin, multi-input build, asset/scene copy.
type: overview
concepts: [vite, dev-server, plugin, build, scene-discovery]
design_refs: [10-system-design/50-build-output.md]
---

# Dev Server & Build

The Vite config is the single source of orchestration for both development and production builds. It discovers scenes, generates per-scene HTML, exposes the scene-save API as Vite middleware, and copies assets and `scene.json` files into `dist/` during the production build.

The "what / why" is in [System Design / Build Output](../../10-system-design/50-build-output.md). This section describes how the config implements it.

---

## File Tree

```
apps/scene-engine/
├── vite.config.js              defineConfig — build inputs + plugins
└── scripts/discover-scenes.js  filesystem walk + index.html generation
```

## Contents

### [10-scene-api.md](10-scene-api.md)
The `sceneApiPlugin` — middleware that handles `GET /api/scenes` (list) and `PUT /api/scenes/:id` (save). Validation, body-size limits, file-write semantics.

### [20-build-pipeline.md](20-build-pipeline.md)
Multi-input rollup configuration, the `copyStaticAssetsPlugin` `closeBundle` hook, and `discover-scenes.js` (scene discovery + per-scene HTML generation).

## Key Concepts

| Concept              | Description |
|----------------------|-------------|
| Scene discovery      | `scenes/<id>/scene.json` filesystem walk. Validates kebab-case IDs. |
| Per-scene HTML       | Generated `scenes/<id>/index.html` with a small inline script setting `__SCENE_ID__` and importing the renderer entry. |
| Multi-input build    | One Rollup input per page: `root` (dashboard), `editor`, and one per scene. |
| Scene API plugin     | Vite plugin attaching middleware to `/api/scenes` and `/api/scenes/:id`. Dev-server only — does not ship in the production build. |
| Static asset copy    | `closeBundle` hook copies `assets/` and each `scene.json` into `dist/` so the renderer's runtime fetches resolve in production. |
