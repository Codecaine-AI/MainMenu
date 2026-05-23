# Asset Library And Active Export Report

## Baseline

- Baseline export command: `curl -fS -X POST "http://localhost:3000/api/export?project=codecaine" -o objectives/asset-library-active-export/artifacts/baseline_codecaine.zip`
- Baseline zip: `133.29 MiB`, `140` entries.
- Registered assets: `14` records, `112.02 MiB` on disk.
- Main bloat source: inactive main-menu background videos (`blue`, `green`, `red`, `yellow`) were exported with the active `purple` video.

## Model

- `public/assets/registry.json` is now the reusable asset library.
- Scene objects and slots keep stable object ids and store selected library asset ids in scene data through their local `asset` field.
- Editor selection changes update scene state and mark the scene dirty. Browser validation changed `main-menu-bg-purple` to `main-menu-bg-red` with `0` `/api/registry/[id]` requests.
- Uploads create library records with optional `label`, `scope`, `projectIds`, and timestamps. Existing records remain compatible and get derived labels/global availability at read time.

## UI

- Dashboard root exposes Projects plus Asset Library and upload entry points.
- `/asset-library` lists asset label, id, type, file, availability, and usage count.
- Project pages show scenes, export, upload, Asset Library, and per-project asset usage.
- Editor media/slot pickers read from `/api/asset-library` and update scene-local asset ids.

## Export Graph

- Export traversal includes active project scenes, selected asset ids, component/effect module ids, declared module dependencies, literal public files, and used font families.
- Module manifests now support `dependencies.modules`, `dependencies.assets`, `dependencies.publicFiles`, `dependencies.fonts`, and string-property `assetType`.
- `main-menu-system` declares `menu-items`, `menu-shield`, `side-menu`, its CSS/SVG/config files, and audio asset-ref properties.
- Export writes pruned `assets/registry.json`, `modules/registry.json`, `fonts/registry.json`, plus `export-graph.json`, `Makefile`, and `server.mjs`.

## Final Export

- Final export command: `curl -fS -X POST "http://localhost:3000/api/export?project=codecaine" -o objectives/asset-library-active-export/artifacts/codecaine.zip`
- Final zip: `54.65 MiB`, `127` entries.
- Size delta: `-78.64 MiB` (`59.0%` smaller).
- Excluded assets include `main-menu-bg-blue`, `main-menu-bg-green`, `main-menu-bg-red`, `main-menu-bg-yellow`, `bg-video`, `codecaine-logo`, and `start-cue`.
- Included menu background video: `assets/video/main-menu-backgrounds/purple.webm`.

## Validation

- `cd apps/scene-engine && npx tsc --noEmit`: passed.
- Dev UI screenshots: `artifacts/screenshots/dashboard.png`, `asset-library.png`, `project-codecaine.png`, `editor-asset-picker.png`.
- Exported runtime served from clean extraction with `make run PORT=4174`.
- Browser validation rendered title and menu, clicked title start control, and reached `http://127.0.0.1:4174/menu/index.html`.
- Exported validation recorded `0` fatal console errors and `0` failed required requests. Two `net::ERR_ABORTED` media/audio requests occurred during navigation and are classified as non-fatal aborted requests.

## Artifacts

- `artifacts/baseline_export_summary.json`
- `artifacts/baseline_zip_manifest.txt`
- `artifacts/dependency_inventory.json`
- `artifacts/route_inventory.json`
- `artifacts/model_migration_notes.md`
- `artifacts/active_export_summary.json`
- `artifacts/zip_manifest.txt`
- `artifacts/browser_summary.json`

## Risks

- `/api/registry/[id]` still exists for direct registry administration, but the editor picker no longer uses it for project-local choices.
- Font discovery currently exports needed families by family name. If future scenes use fallback font stacks, the collector may need a richer font-family parser.
- Module directory copying is active-module scoped, but it still copies all files inside each active module directory.
