---
covers: How a project becomes a deployable standalone site — /api/export bundles renderer + scenes + assets + modules + fonts + boot into a zip the user downloads.
concepts: [export, standalone-bundle, zip, project-export, no-build, path-rewriting]
---

# Export Pipeline

The scene-engine exports a **fully bundled standalone copy** of the project: a zip the user downloads, unzips, and opens — `index.html` works directly from the filesystem or any static host. There is no compilation step, no framework runtime in the output, no dependency on the Next.js dev server. The zip contains static pages, the same renderer code, scene JSON, and assets that the editor uses, with runtime paths resolved from the bundle root.

---

## Why a Standalone Bundle, Not a Build

The renderer already exists as plain JS modules and works without bundling. The scene JSON **is** the source of truth in production — there is nothing to compile down to. So export is not a build; it's a copy with path rewrites.

Trade-offs:
- Pro: zero build pipeline. The export and the editor share one renderer.
- Pro: the output is inspectable — every file is the same one the developer wrote.
- Pro: works from `file://` and any static host with no server.
- Con: the bundle ships every asset registered, not only the ones used. (Currently acceptable for stylish 2–3 page sites.)

## Trigger and Endpoint

`POST /api/export?project=<project-id>` is a Next route that returns `application/zip` with `Content-Disposition: attachment; filename="<project-id>.zip"`. The editor's scene controls call it with the active project, read the blob, and trigger a browser download.

There is no streaming or progress reporting; the project is small enough that synchronous zip generation is fine.

## What the Bundle Contains

```
<project-id>.zip
├── index.html               entry scene page
├── boot.js                  loads project.json, mounts renderer, exposes navigate()
├── project.json             copied as-is
├── <scene-id>/index.html    one static page per scene, including the entry scene
├── <scene-id>/scene.css     optional per-scene page CSS if scenes/<id>/page.css or scene.css exists
├── scenes/<id>/scene.json   one per scene listed in project.scenes
├── renderer/                copied from app/_engine/renderer/, paths rewritten
│   ├── scene-renderer.js
│   ├── asset-registry.js
│   ├── positioning.js
│   └── asset-renderers/...
├── assets/                  registry + referenced files (audio dirs copied whole)
│   ├── registry.json        with /assets/... rewritten to ./assets/...
│   ├── audio/.../...
│   ├── image/.../...
│   ├── video/.../...
│   └── glyph/.../...
├── modules/                 effects + components + manifests
│   ├── registry.json        with /modules/... rewritten to ./modules/...
│   ├── effects/<id>/...
│   └── components/<id>/...
└── fonts/                   FolkPro family
```

## How the Bundle Is Assembled

1. **Read `projects/<project-id>/project.json`** via `loadProject(projectId)`. If it's missing, fail with HTTP 400 — exports are project-scoped.
2. **Add `project.json`** to the zip as-is.
3. **For each scene in `project.scenes`**: add `scenes/<id>/scene.json` from disk.
4. **Copy `app/_engine/renderer/` into `renderer/`**: every file is read as text and absolute paths (`/assets/...`, `/modules/...`, `/fonts/...`) are rewritten to relative (`./assets/...`, etc.) so the bundle works without a server origin.
5. **Generate static pages**: root `index.html` boots `project.entry`, and `<scene-id>/index.html` boots each listed scene. If `scenes/<id>/page.css` or `scenes/<id>/scene.css` exists, it is copied beside that page as `scene.css`.
6. **Add `boot.js`** from `app/_engine/export/`. This is the shared runtime for every generated page.
7. **Walk the assets registry**:
   - Rewrite leading-slash paths in `registry.json` to `./` form.
   - For each entry's `file` path: copy that file into the zip preserving its directory (`assets/<type>/<file>`).
   - For audio entries: copy the entire containing directory once (audio bundles often include sidecar JS or sprite metadata).
8. **Walk the modules registry**: same idea, but copy the entire module directory (CSS/JS/manifest live together).
9. **Copy `public/fonts/`** wholesale.
10. **Generate** the zip buffer and stream it as the response body.

The deduplication sets (`copiedAssetDirs`, `copiedModuleDirs`) avoid copying the same directory twice when multiple registry entries point into it.

## Path Rewriting

All renderer code and registry JSON use absolute paths during development (`/assets/...`, `/modules/...`, `/fonts/...`) so they work both from the Next dev server and from production routes. In the standalone bundle there is no server origin, so absolute paths break.

Two rewrite passes at export time:

- **Renderer code (text)**: simple regex `/(["'(])\/(assets|modules|fonts)\//g` → `$1./$2/`. The token-prefix capture (`"`, `'`, `(`) avoids touching things that aren't path-like (e.g. the `/` in a regex literal).
- **Registry JSON**: parse, map every entry's `file` and `path` field from `/...` to `./...`, re-stringify with stable formatting.

Once relative, `boot.js` sets `window.MELEE_BUNDLE_ROOT` from `import.meta.url`, and renderer fetches resolve against that root. This matters because nested pages like `menu/index.html` must still load `assets/`, `modules/`, `fonts/`, and `scenes/` from the bundle root rather than from `menu/`.

## The Boot Page

Each generated page is minimal: a stage container, FolkPro `@font-face` declarations with the correct relative prefix, optional `scene.css`, and a single boot script. Root `index.html` points to `./boot.js`; nested scene pages point to `../boot.js`.

`app/_engine/export/boot.js`:

1. Sets the bundle root from `import.meta.url`.
2. Fetches `project.json` from the bundle root.
3. Loads the merged asset/module registry.
4. Defines `showScene(sceneId)` that fetches `scenes/<id>/scene.json` and calls `renderScene(scene, stage)`.
5. Exposes `window.MELEE_navigate(sceneId)` so click events with `action: "navigate"` move to `<scene-id>/index.html` in page-mode exports.
6. Fits the stage to the viewport via uniform scale (preserves the 1440×1080 aspect).
7. Boots `window.MELEE_INITIAL_SCENE`, falling back to `project.entry`.

## What's Excluded From the Bundle

- The Next.js editor and its dev API. Editor code is not part of the standalone deliverable; it lives in the dev environment only.
- Assets and modules not registered in `public/assets/registry.json` / `public/modules/registry.json`. Only registered things ship.
- Session/spec/dev-notes scaffolding under `.spectre/`.
- Source maps unless explicitly opted in.

## Deploy Surface

`<project-id>.zip` is the deployable artifact. Drop it on:
- A static host (S3 + CloudFront, Vercel static, GitHub Pages, plain nginx).
- A USB stick — opens from `file://` directly.
- A zip you email to a client.

No build step, no server, no dependencies.

## Failure Modes

| Condition                                  | Response                                   |
|--------------------------------------------|--------------------------------------------|
| `project.json` missing for selected project | 400 `{ error: "project.json not found" }`. |
| `project.entry` not listed in `project.scenes` | 400 with a manifest consistency error. |
| Asset file referenced in registry but missing on disk | 500 with the underlying file-system error. |
| Any other read/zip failure                 | 500 with `{ error: <message> }`.           |

The export is fail-closed: any inconsistency surfaces as an HTTP error, not a partial zip.
