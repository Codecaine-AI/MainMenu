---
covers: How a project becomes a deployable standalone site or packaged desktop authoring app.
concepts: [export, standalone-bundle, zip, active-export-graph, desktop-app, path-rewriting]
---

# Build And Distribution Output

The scene-engine has two output paths:

- **Site export** — `POST /api/export?project=<project-id>` returns a standalone zip for the selected project.
- **Git deploy trigger** — `POST /api/projects/<project-id>/deploy` commits and pushes an external project workspace so GitHub-connected hosts can deploy it.
- **Desktop authoring app** — Electron packages the Next standalone runtime as the Main Menu macOS app.

The site export contains static pages, the same renderer code, scene JSON, and the active project files needed by those scenes. There is no framework runtime in the exported site, and no dependency on the Next.js dev server.

---

## Why A Standalone Bundle, Not A Build

The renderer already exists as plain JS modules and works without bundling. The scene JSON is the source of truth in production; there is nothing to compile down to. Export is a copy with path rewrites and dependency pruning.

Trade-offs:

- Pro: the export and editor share one renderer.
- Pro: the output is inspectable; every file is the same kind of file the developer authored.
- Pro: the active dependency graph keeps unused registered media out of the zip.
- Con: modules must declare dependencies that are not visible from scene references.

## Trigger And Endpoint

`POST /api/export?project=<project-id>` returns `application/zip` with `Content-Disposition: attachment; filename="<project-id>.zip"`. The project page calls it with the active project and triggers a browser download.

There is no streaming or progress reporting. The selected projects are small enough that synchronous zip generation is acceptable for the current tool.

## Git Deploy Trigger

External project workspaces can also deploy without generating a zip. The project page's Deploy button calls `POST /api/projects/<project-id>/deploy`. The route:

1. Accepts localhost requests only, unless remote deploy is explicitly enabled.
2. Resolves the external project through the workspace catalog.
3. Requires the project root to be its own Git repository.
4. Updates `ProjectSettings/deployment.json` with a monotonically increasing deploy marker.
5. Runs `git add -A`, commits all project-repo changes, and pushes the current branch.

This is the path for the Codecaine site Railway setup: the live host listens to the `codecaine-site` GitHub repository, so pushing the workspace repo is the deploy trigger.

## What The Bundle Contains

```
<project-id>.zip
├── index.html               entry scene page
├── boot.js                  loads project.json, mounts renderer, exposes navigate()
├── project.json             active project manifest copy
├── <scene-id>/index.html    one static page per active scene
├── <scene-id>/scene.css     optional per-scene page CSS
├── scenes/<id>/scene.json   one per active scene
├── renderer/                copied from app/_engine/renderer/, paths rewritten
├── assets/
│   ├── registry.json        active assets only; /assets/... rewritten to ./assets/...
│   ├── audio/.../...
│   ├── image/.../...
│   ├── video/.../...
│   └── glyph/.../...
├── modules/
│   ├── registry.json        active modules only; /modules/... rewritten to ./modules/...
│   ├── effects/<id>/...
│   └── components/<id>/...
├── fonts/
│   └── registry.json        active font entries only
├── export-graph.json        included/excluded ids and warnings
├── Makefile                 `make run` helper
└── server.mjs               static server for local preview
```

## Active Export Graph

The export graph is built before registries are written. It includes:

- active scenes from `project.scenes`
- direct layer `asset` references
- glyph slot asset references
- `play-audio` event targets
- component/effect module references
- module dependencies declared in `manifest.json`
- public file references found in scene/module JSON, JS, CSS, SVG, or HTML text
- string schema properties marked with `assetType`
- discovered project fonts matching used font families

Anything not reached is left out of the exported registries. `export-graph.json` records included ids, excluded ids, warnings, and public files so a surprising omission can be diagnosed from the bundle.

## Assembly Flow

1. Resolve the project through the workspace catalog and read `ProjectSettings/project.json`.
2. Validate that `project.entry` exists and remains active for export.
3. Filter scene refs with `active: false` or `export: false`.
4. Collect the active export graph.
5. Write `project.json` using only active scene refs.
6. Add active scene JSON files under `scenes/<id>/scene.json`.
7. Copy `app/_engine/renderer/` into `renderer/` with path rewrites.
8. Add `boot.js`, `Makefile`, and `server.mjs` from `app/_engine/export/`.
9. Generate root and per-scene HTML pages.
10. Write pruned asset/module/font registries.
11. Copy active asset files, active module directories, active fonts, and extra public files.
12. Write `export-graph.json`.
13. Generate the zip buffer and stream it as the response body.

Audio entries copy their containing directory because audio bundles often include sidecar JS or sprite metadata. Module entries copy their containing directory because JS, CSS, manifests, SVGs, and local config commonly live together.

## Path Rewriting

Development uses logical paths such as `/assets/...`, `/modules/...`, and `/fonts/...`. The standalone bundle rewrites those to relative bundle-root paths.

Two rewrite passes matter:

- **Renderer code and text assets**: absolute logical paths are rewritten to relative paths where needed.
- **Registry JSON**: `file` and `path` fields move from `/...` to `./...`.

`boot.js` sets `window.MELEE_BUNDLE_ROOT` from `import.meta.url`, so nested pages like `menu/index.html` still load assets, modules, fonts, and scenes from the bundle root.

## Boot Runtime

Each generated page contains a stage container, font declarations, optional scene CSS, and a boot script. `app/_engine/export/boot.js`:

1. sets the bundle root
2. fetches `project.json`
3. loads the merged asset/module/font registry
4. fetches `scenes/<id>/scene.json`
5. calls `renderScene(scene, stage)`
6. exposes `window.MELEE_navigate(sceneId)`
7. scales the fixed 1440x1080 stage to the viewport

Page-mode exports perform real static-page navigation to `<scene-id>/index.html`.

## What's Excluded From The Site Export

- The Next.js editor and dev API.
- Registered assets/modules/fonts that are not reached from the active export graph.
- Scenes marked `active: false` or `export: false`.
- Session/spec/dev-notes scaffolding.
- Source maps unless explicitly opted in.

## Local Export Preview

After extracting:

```bash
make run
```

or:

```bash
node server.mjs --host 127.0.0.1 --port 4173
```

The server makes module, media, font, and nested scene page loading behave like a normal static host.

## Desktop App Output

Main Menu is the packaged authoring app, not the exported site. The desktop package:

- builds Next with `output: 'standalone'`
- stages `.next/standalone` into `desktop/dist-next`
- packages Electron main/preload code and the standalone runtime
- seeds a writable workspace under the user's application support directory
- starts a local Next server and opens the editor route in an Electron window

The macOS directory artifact is:

```text
apps/scene-engine/dist/desktop/mac-arm64/Main Menu.app
```

Signing, notarization, auto-update, and installer distribution are outside the current output contract.

## Failure Modes

| Condition | Response |
| --- | --- |
| `project.json` missing for selected project | 400 `{ error: "project.json not found" }`. |
| Project root cannot be resolved | 404 `{ error: "Project not found" }`. |
| `project.entry` not listed in `project.scenes` | 400 with a manifest consistency error. |
| `project.entry` inactive for export | 400 with a manifest consistency error. |
| Asset/module/font file referenced by the active graph but missing on disk | 500 with the underlying file-system error. |
| Any other read/zip failure | 500 with `{ error: <message> }`. |
