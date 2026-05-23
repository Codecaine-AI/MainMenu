<current_state>
<last_updated>2026-05-21</last_updated>

<status>
    - Implemented the asset-library model, APIs, dashboard pages, editor picker semantics, and graph-driven active-only export.
    - Fresh Codecaine export from the running dev server is `54.65 MiB`, down from the `133.29 MiB` baseline (`59.0%` smaller).
    - Clean exported extraction ran through `make run PORT=4174`; browser validation rendered title and menu, navigated from title to menu, and recorded `0` fatal console errors and `0` failed required requests.
    - Objective report and artifacts are written under `objectives/asset-library-active-export/`.
</status>

<completed>
    - Reread all required objective files and preserved pre-existing dirty work in export/menu/editor files.
    - Recorded dirty worktree risks with `git status --short`; existing unrelated changes included `MainMenuConfigEditor.tsx`, Codecaine menu scene/config, main-menu module CSS/JS/config, menu-items JS/manifest, and prior standalone-export objective artifacts.
    - Generated baseline export: `objectives/asset-library-active-export/artifacts/baseline_codecaine.zip`.
    - Wrote baseline and inventory artifacts: `baseline_export_summary.json`, `baseline_zip_manifest.txt`, `dependency_inventory.json`, and `route_inventory.json`.
    - Added server-side asset-library helpers and `/api/asset-library`; updated `/api/assets/[type]` and `/api/upload` to expose/create library records with labels, scope, project availability, and usage.
    - Changed editor asset picking so media object/slot selection updates scene-local `asset` ids through editor state and marks the scene dirty. Browser validation changed `main-menu-bg-purple` to `main-menu-bg-red` with `0` `/api/registry/[id]` requests.
    - Added `/asset-library`; refreshed dashboard root, project page, and upload page to expose Projects, Asset Library, upload/import, export, scenes, and asset usage.
    - Added manifest dependency metadata and `assetType` audio refs for `main-menu-system`; declared public-file dependencies for `menu-items`, `menu-shield`, `side-menu`, and `codecaine-keycap-start`.
    - Added `collectExportGraph` and changed `/api/export` to write pruned `assets/registry.json`, `modules/registry.json`, `fonts/registry.json`, and `export-graph.json`, while preserving `Makefile` and `server.mjs`.
    - Final export excludes inactive menu background variants: `main-menu-bg-blue`, `main-menu-bg-green`, `main-menu-bg-red`, and `main-menu-bg-yellow`.
    - Wrote final artifacts: `active_export_summary.json`, `zip_manifest.txt`, `browser_summary.json`, `run_summary.json`, screenshots, `model_migration_notes.md`, and `report.md`.
</completed>

<validation>
    - `curl -fS -I http://localhost:3000/`: dev server healthy.
    - `curl -fS -X POST "http://localhost:3000/api/export?project=codecaine" -o objectives/asset-library-active-export/artifacts/baseline_codecaine.zip`: baseline export captured.
    - `cd apps/scene-engine && npx tsc --noEmit`: passed.
    - `curl -fS -X POST "http://localhost:3000/api/export?project=codecaine" -o objectives/asset-library-active-export/artifacts/codecaine.zip`: final export captured from current code.
    - `zipinfo -1 objectives/asset-library-active-export/artifacts/codecaine.zip > objectives/asset-library-active-export/artifacts/zip_manifest.txt`: final manifest captured.
    - `rm -rf objectives/asset-library-active-export/artifacts/extracted && mkdir -p objectives/asset-library-active-export/artifacts/extracted && unzip -q objectives/asset-library-active-export/artifacts/codecaine.zip -d objectives/asset-library-active-export/artifacts/extracted`: clean extraction.
    - `cd objectives/asset-library-active-export/artifacts/extracted && make run PORT=4174`: exported static server ran successfully.
    - Playwright validation against `http://localhost:3000`, `http://127.0.0.1:4174/`, and `http://127.0.0.1:4174/menu/`: passed required gates. Non-fatal `net::ERR_ABORTED` media/audio requests occurred during navigation; no required exported request failed.
</validation>

<artifacts>
    - `objectives/asset-library-active-export/report.md`
    - `objectives/asset-library-active-export/artifacts/baseline_export_summary.json`
    - `objectives/asset-library-active-export/artifacts/baseline_zip_manifest.txt`
    - `objectives/asset-library-active-export/artifacts/dependency_inventory.json`
    - `objectives/asset-library-active-export/artifacts/route_inventory.json`
    - `objectives/asset-library-active-export/artifacts/model_migration_notes.md`
    - `objectives/asset-library-active-export/artifacts/active_export_summary.json`
    - `objectives/asset-library-active-export/artifacts/zip_manifest.txt`
    - `objectives/asset-library-active-export/artifacts/browser_summary.json`
    - `objectives/asset-library-active-export/artifacts/run_summary.json`
    - `objectives/asset-library-active-export/artifacts/screenshots/`
</artifacts>

<risks_or_open_questions>
    - `/api/registry/[id]` still exists for direct global registry administration, but the editor picker no longer uses it for project-local choices.
    - Active module copying is scoped to reachable module directories, but still copies all files inside each active module directory.
    - Font pruning uses discovered font family/id matches. Future fallback stacks or CSS-only font references may need a richer parser.
    - Several files were dirty before this objective began; review `git diff` carefully before committing so unrelated menu/editor changes are not mixed accidentally.
</risks_or_open_questions>

<important_paths>
    - `apps/scene-engine/app/_engine/lib/asset-library.ts`
    - `apps/scene-engine/app/_engine/lib/export-reachability.ts`
    - `apps/scene-engine/app/_engine/types/scene.ts`
    - `apps/scene-engine/app/_engine/store/editor-store.ts`
    - `apps/scene-engine/app/api/asset-library/route.ts`
    - `apps/scene-engine/app/api/export/route.ts`
    - `apps/scene-engine/app/api/upload/route.ts`
    - `apps/scene-engine/app/api/assets/[type]/route.ts`
    - `apps/scene-engine/app/asset-library/page.tsx`
    - `apps/scene-engine/app/page.tsx`
    - `apps/scene-engine/app/projects/[projectId]/page.tsx`
    - `apps/scene-engine/app/upload/page.tsx`
    - `apps/scene-engine/app/editor/_components/AssetSwapDropdown.tsx`
    - `apps/scene-engine/app/editor/_components/LayerForm.tsx`
    - `apps/scene-engine/app/editor/_components/SlotsSection.tsx`
    - `apps/scene-engine/public/modules/components/main-menu-system/manifest.json`
    - `apps/scene-engine/public/modules/components/menu-items/manifest.json`
    - `apps/scene-engine/public/modules/components/menu-shield/manifest.json`
    - `apps/scene-engine/public/modules/components/side-menu/manifest.json`
    - `apps/scene-engine/public/modules/components/codecaine-keycap-start/manifest.json`
</important_paths>
</current_state>
