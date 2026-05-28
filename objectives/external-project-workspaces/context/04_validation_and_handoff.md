<validation_and_handoff>
    <validation_ladder>
        - Health check the existing dev server before starting one:
          - `curl -fS -I http://localhost:3000/`
        - Type check after implementation:
          - `cd apps/scene-engine && npx tsc --noEmit`
        - Catalog/path safety checks:
          - valid catalog with relative Codecaine root loads.
          - missing project root produces a dashboard/API diagnostic.
          - duplicate ids are rejected or clearly reported.
          - traversal attempts against project asset/module/font serving routes are rejected.
        - Authoring browser checks through `http://localhost:3000`:
          - dashboard lists catalog projects.
          - Codecaine project page opens from external root.
          - title and menu scene previews render.
          - editor opens a scene, saves a harmless JSON change or controlled test edit, and writes to external `Assets/Scenes`.
          - upload writes to external `Assets/Media` and updates external `ProjectSettings/registries/assets.json`.
          - asset picker reads project-local assets and does not patch engine-local registries.
        - Export checks:
          - `POST /api/export?project=codecaine` returns a zip.
          - zip contains `project.json`, `scenes/`, `assets/registry.json`, `modules/registry.json`, `fonts/registry.json` when fonts are used, renderer files, `boot.js`, `Makefile`, and `server.mjs`.
          - zip content comes from the external workspace and contains no absolute local filesystem paths.
          - extracted export runs via `make run PORT=<port>` and renders title/menu with navigation.
        - Hard-coded path audit:
          - `rg -n "process\\.cwd\\(\\).*public|public/assets|public/modules|apps/scene-engine/projects|projects/codecaine|/assets/registry\\.json|/modules/registry\\.json" apps/scene-engine docs/scene-engine`
          - Every remaining hit must be documented as legacy fallback, docs reference, export bundle path, or a bug to fix before completion.
    </validation_ladder>

    <artifacts>
        - `artifacts/path_inventory.json`: path assumption inventory from phase 1.
        - `artifacts/baseline_export_summary.json`: baseline export details before migration when available.
        - `artifacts/catalog_validation.json`: catalog parsing and path safety cases.
        - `artifacts/migration_manifest.json`: old-to-new path mapping for Codecaine files.
        - `artifacts/api_route_inventory.json`: project-aware route audit.
        - `artifacts/codecaine-external.zip`: final export zip or path to the produced zip.
        - `artifacts/zip_manifest.txt`: final export manifest.
        - `artifacts/browser_summary.json`: preview/editor/export browser validation results, console/network summaries, and screenshots index.
        - `artifacts/run_summary.json`: commands run, pass/fail status, artifact index, and unresolved follow-ups.
        - `report.md`: final narrative report.
    </artifacts>

    <handoff>
        - Update `current_state.md` at the start of implementation, after each phase gate, before any compaction/handoff, and before final response.
        - Final `current_state.md` must include: final external project root used for validation, catalog file path, commands run, artifacts, remaining legacy fallbacks, docs updated, and open risks.
        - The final report must name which files remain engine-owned, which files moved to Codecaine, and how a future separate Codecaine repo should be initialized from the validated workspace.
        - If the objective is blocked, keep partial artifacts and state the exact blocker, the repeated failure condition, and the smallest next decision needed from the user.
    </handoff>
</validation_and_handoff>
