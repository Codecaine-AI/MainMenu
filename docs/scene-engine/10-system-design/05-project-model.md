---
covers: The project manifest — how multiple scenes form a deliverable site, entry scene, navigation between scenes.
concepts: [project-json, multi-scene, entry-scene, navigation, stage]
---

# Project Model

A **project** is a collection of scenes (pages) that ship together as one site. Each scene is a single-viewport page; navigation events route between scenes the way clicking a link routes between pages on a normal website. The project manifest is intentionally thin — it ties scenes together and declares the shared stage, nothing more.

---

## Layout

```
workspace.catalog.json
└── projects[]                ← project ids and root folders

codecaine-site/
├── ProjectSettings/
│   ├── project.json          ← project manifest
│   └── registries/
│       ├── assets.json
│       └── modules.json
├── Assets/
│   ├── Scenes/
│   │   ├── title/scene.json
│   │   └── menu/scene.json
│   ├── Media/
│   │   ├── audio/
│   │   ├── image/
│   │   ├── video/
│   │   └── glyph/
│   ├── Modules/
│   │   ├── components/
│   │   └── effects/
│   └── Fonts/
├── Library/
└── Builds/
```

The scene engine opens project roots from a file-backed workspace catalog. A project owns the scenes, registries, media, modules, and fonts needed to author and export it. Engine-owned files are renderer/editor primitives and APIs that interpret the project data.

The local catalog file is `workspace.catalog.json` beside the scene-engine app, with `SCENE_ENGINE_WORKSPACE_CATALOG` available for alternate locations. Relative project roots resolve relative to the catalog file, not the process working directory. `workspace.catalog.example.json` is committed; the local catalog is gitignored.

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
- No asset registry. Assets and modules are discovered from the project-local registries in `ProjectSettings/registries/`.
- No theme, no styles, no shared layout. Scenes are independently composed.

The manifest stays minimal so projects don't accumulate global config that some scenes use and others ignore.

## Scene Discovery

Project discovery starts with the workspace catalog:

1. **Catalog projects**: enabled catalog entries point at external project roots. The manifest lives at `ProjectSettings/project.json`, and scene files live under `Assets/Scenes/<scene-id>/scene.json`.
2. **Manifest inventory**: `ProjectSettings/project.json` lists the scenes that the dashboard, editor, preview, and export surfaces should expose.
3. **Diagnostics**: missing catalog roots or unreadable manifests are reported as workspace diagnostics rather than silently falling back to app-local data.

`app/_engine/lib/scenes.ts` exposes `discoverProjects()`, `loadProject(projectId)`, `projectRoot(projectId)`, and `discoverScenes(projectId)` for the dashboard, project page, scene APIs, and export route.

## Navigation Between Scenes

Inside a scene, an event with `action: "navigate"` and `target: "<scene-id>"` navigates to another scene in the project. In the export bundle, the renderer registers `window.MELEE_navigate(sceneId)` and the click handler calls it. Page-mode exports perform real static-page navigation to `<scene-id>/index.html`; runtime scene re-rendering remains available as a fallback for single-page previews.

The dev environment works the same way conceptually, but routing carries the active project in the query string: `/scenes/<scene-id>?project=<project-id>` for preview and `/editor?project=<project-id>&scene=<scene-id>` for editing. The editor still views one scene at a time and disables runtime events so clicks select layers instead of navigating.

## Export Surface

The [export pipeline](50-build-output.md) resolves `<project-id>` through the workspace catalog and reads `ProjectSettings/project.json` to decide which scenes go into the standalone bundle. Scenes not listed in `project.scenes` are excluded from the export even if they exist on disk. This makes the selected project's manifest the authoritative inventory of what ships.
