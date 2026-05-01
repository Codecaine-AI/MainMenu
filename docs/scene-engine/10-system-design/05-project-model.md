---
covers: The project manifest — how multiple scenes form a deliverable site, entry scene, navigation between scenes.
concepts: [project-json, multi-scene, entry-scene, navigation, stage]
---

# Project Model

A **project** is a collection of scenes (pages) that ship together as one site. Each scene is a single-viewport page; navigation events route between scenes the way clicking a link routes between pages on a normal website. The project manifest is intentionally thin — it ties scenes together and declares the shared stage, nothing more.

---

## Layout

```
apps/scene-engine/
├── project.json              ← project manifest
├── scenes/
│   ├── title/scene.json
│   ├── menu/scene.json
│   └── credits/scene.json
└── public/
    ├── assets/               ← shared across all scenes (audio, image, video, glyph)
    ├── modules/              ← shared modules (effects, components)
    └── fonts/
```

A project owns all its scenes and shares all assets across them. Scenes don't have private asset directories.

## project.json

```json
{
  "id": "codecaine",
  "name": "Codecaine",
  "entry": "title",
  "scenes": [
    { "id": "title", "name": "Title Screen" },
    { "id": "menu",  "name": "Main Menu" }
  ],
  "stage": { "width": 1440, "height": 1080 }
}
```

| Field    | Required | Notes                                                                                       |
|----------|----------|---------------------------------------------------------------------------------------------|
| `id`     | yes      | Project identifier. Becomes the export zip filename (`<id>.zip`).                           |
| `name`   | yes      | Human-readable display name.                                                                |
| `entry`  | yes      | Scene `id` that loads first when the export boots. Must be present in `scenes`.             |
| `scenes` | yes      | Ordered list of `{ id, name? }`. Determines order in the dashboard and the export bundle.   |
| `stage`  | yes      | Design canvas size shared across scenes. Renderer scales to the viewport at runtime.        |

`name` on each scene reference is optional; if absent, the dashboard falls back to the scene's own `name` field, then to its `id`.

## What the Project Manifest Does Not Carry

- No global appearance / color grading. Color grading lives at the [scene level](10-scene-data-model.md#top-level-shape) (`scene.appearance`) or per-object.
- No asset registry. Assets are discovered from `public/assets/registry.json` and `public/modules/registry.json`.
- No theme, no styles, no shared layout. Scenes are independently composed.

The manifest stays minimal so projects don't accumulate global config that some scenes use and others ignore.

## Scene Discovery

Two modes:

1. **Project-driven (preferred)**: if `project.json` exists, the dashboard and the export iterate `project.scenes` in declaration order. The `entry` scene is flagged.
2. **Filesystem-driven (fallback)**: if there is no `project.json`, every directory under `scenes/` containing a `scene.json` is listed. No scene is marked as entry.

`src/lib/scenes.ts` exposes `loadProject()` and `discoverScenes()` for both the dashboard server component and the export route.

## Navigation Between Scenes

Inside a scene, an event with `action: "navigate"` and `target: "<scene-id>"` switches the current page to another scene in the project. In the export bundle, the renderer registers `window.MELEE_navigate(sceneId)` and the click handler calls it. There is no client-side router; the bundle keeps a single stage element and re-renders into it when the active scene changes.

The dev environment (Next.js editor + previews) works the same way conceptually, but routing also goes through normal Next routes (`/scenes/[id]`) so each scene has a stable URL during authoring.

## Export Surface

The [export pipeline](50-build-output.md) reads `project.json` directly to decide which scenes go into the standalone bundle. Scenes not listed in `project.scenes` are excluded from the export even if they exist on disk. This makes `project.json` the authoritative inventory of what ships.
