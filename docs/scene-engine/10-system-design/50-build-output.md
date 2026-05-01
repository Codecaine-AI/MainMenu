---
covers: How a project becomes a deployable standalone site — /api/export bundles renderer + scenes + assets + modules + fonts + boot into a zip the user downloads.
concepts: [export, standalone-bundle, zip, project-export, no-build, path-rewriting]
---

# Export Pipeline

The scene-engine exports a **fully bundled standalone copy** of the project: a zip the user downloads, unzips, and opens — `index.html` works directly from the filesystem or any static host. There is no compilation step, no framework runtime in the output, no dependency on the Next.js dev server. The zip contains the same renderer code, scene JSON, and assets that the editor uses, with paths rewritten to be relative.

---

## Why a Standalone Bundle, Not a Build

The renderer already exists as plain JS modules and works without bundling. The scene JSON **is** the source of truth in production — there is nothing to compile down to. So export is not a build; it's a copy with path rewrites.

Trade-offs:
- Pro: zero build pipeline. The export and the editor share one renderer.
- Pro: the output is inspectable — every file is the same one the developer wrote.
- Pro: works from `file://` and any static host with no server.
- Con: the bundle ships every asset registered, not only the ones used. (Currently acceptable for stylish 2–3 page sites.)

## Trigger and Endpoint

`POST /api/export` is a Next route that returns `application/zip` with `Content-Disposition: attachment; filename="<project-id>.zip"`. The toolbar's Export button calls it, reads the blob, and triggers a browser download.

There is no streaming or progress reporting; the project is small enough that synchronous zip generation is fine.

## What the Bundle Contains

```
<project-id>.zip
├── index.html               minimal boot page (stage element + boot script)
├── boot.js                  loads project.json, mounts renderer, exposes navigate()
├── project.json             copied as-is
├── scenes/<id>/scene.json   one per scene listed in project.scenes
├── renderer/                copied from src/renderer/, paths rewritten
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

1. **Read `project.json`** via `loadProject()`. If it's missing, fail with HTTP 400 — exports are project-scoped.
2. **Add `project.json`** to the zip as-is.
3. **For each scene in `project.scenes`**: add `scenes/<id>/scene.json` from disk.
4. **Copy `src/renderer/` into `renderer/`**: every file is read as text and absolute paths (`/assets/...`, `/modules/...`, `/fonts/...`) are rewritten to relative (`./assets/...`, etc.) so the bundle works without a server origin.
5. **Add `index.html` and `boot.js`** from `src/export/`. These are the entry that boots the bundle.
6. **Walk the assets registry**:
   - Rewrite leading-slash paths in `registry.json` to `./` form.
   - For each entry's `file` path: copy that file into the zip preserving its directory (`assets/<type>/<file>`).
   - For audio entries: copy the entire containing directory once (audio bundles often include sidecar JS or sprite metadata).
7. **Walk the modules registry**: same idea, but copy the entire module directory (CSS/JS/manifest live together).
8. **Copy `public/fonts/`** wholesale.
9. **Generate** the zip buffer and stream it as the response body.

The deduplication sets (`copiedAssetDirs`, `copiedModuleDirs`) avoid copying the same directory twice when multiple registry entries point into it.

## Path Rewriting

All renderer code and registry JSON use absolute paths during development (`/assets/...`, `/modules/...`, `/fonts/...`) so they work both from the Next dev server and from production routes. In the standalone bundle there is no server origin, so absolute paths break.

Two rewrite passes at export time:

- **Renderer code (text)**: simple regex `/(["'(])\/(assets|modules|fonts)\//g` → `$1./$2/`. The token-prefix capture (`"`, `'`, `(`) avoids touching things that aren't path-like (e.g. the `/` in a regex literal).
- **Registry JSON**: parse, map every entry's `file` and `path` field from `/...` to `./...`, re-stringify with stable formatting.

Once relative, `boot.js` (which uses `fetch('./project.json')`, etc.) and the renderer (which fetches assets/modules from registry paths) work from any base URL — file system, S3, GitHub Pages.

## The Boot Page

`src/export/index.html` is a minimal page with a stage container, FolkPro `@font-face` declarations, and a single `<script type="module" src="./boot.js">`.

`src/export/boot.js`:

1. Fetches `./project.json`.
2. Loads the merged asset/module registry.
3. Defines `showScene(sceneId)` that fetches `./scenes/<id>/scene.json` and calls `renderScene(scene, stage)`.
4. Exposes `window.MELEE_navigate(sceneId)` so click events with `action: "navigate"` can switch scenes without a router.
5. Fits the stage to the viewport via uniform scale (preserves the 1440×1080 aspect).
6. Boots the entry scene (`project.entry`).

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
| `project.json` missing                     | 400 `{ error: "project.json not found" }`. |
| Asset file referenced in registry but missing on disk | 500 with the underlying file-system error. |
| Any other read/zip failure                 | 500 with `{ error: <message> }`.           |

The export is fail-closed: any inconsistency surfaces as an HTTP error, not a partial zip.
