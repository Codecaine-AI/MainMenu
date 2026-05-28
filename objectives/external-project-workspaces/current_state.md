<current_state>
<last_updated>2026-05-28</last_updated>

<status>
    - Objective implementation and validation are complete.
    - Codecaine now loads from `../codecaine-site/` through `apps/scene-engine/workspace.catalog.json`.
    - Normal authoring/export paths no longer depend on `apps/scene-engine/projects/codecaine` or `apps/scene-engine/public` content.
    - Legacy app-local Codecaine duplicates remain as documented fallback/source comparison data only.
</status>

<completed>
    - Added workspace catalog loading, project path resolution, safe project file serving, and project-local dev routes under `/api/projects/[projectId]/`.
    - Refactored scenes, asset library, upload, registry patch, fonts, renderer registry loading, component schema loading, preview/editor URLs, desktop runtime prep, and export to use project-aware paths.
    - Migrated Codecaine scenes, media, modules, effects, fonts, and registries into `../codecaine-site/`.
    - Added committed `apps/scene-engine/workspace.catalog.example.json`; local `apps/scene-engine/workspace.catalog.json` is gitignored.
    - Removed app-global Codecaine font-face loading so scene typography comes through project font registries.
    - Patched project-authored Codecaine modules to resolve `/assets`, `/modules`, and `/fonts` through project dev routes or `MELEE_BUNDLE_ROOT` in exports.
    - Updated system-design and implementation docs for the catalog/project-local model.
    - Wrote final report at `objectives/external-project-workspaces/report.md`.
</completed>

<validation>
    - `cd apps/scene-engine && npx tsc --noEmit` passes.
    - Dev server health check at `http://localhost:3000/` passes.
    - Project API checks pass for scene load, asset registry, font registry, module serving/rewrite, path traversal rejection, and unknown-project 404.
    - `POST /api/export?project=codecaine` regenerated `artifacts/codecaine-external.zip`.
    - Playwright dev validation passes for dashboard, project page, title/menu preview, editor save, upload, asset-library selection, and root-static request audit.
    - Playwright export validation passes for title render, title click navigation to menu, direct menu route render, and no non-benign resource/page failures.
    - Hard-coded path/docs audit reports zero stale documentation hits; remaining app-code hits are classified export defaults or legacy fallback.
</validation>

<artifacts>
    - `objectives/external-project-workspaces/artifacts/path_inventory.json`
    - `objectives/external-project-workspaces/artifacts/baseline_export_summary.json`
    - `objectives/external-project-workspaces/artifacts/baseline_zip_manifest.txt`
    - `objectives/external-project-workspaces/artifacts/catalog_validation.json`
    - `objectives/external-project-workspaces/artifacts/migration_manifest.json`
    - `objectives/external-project-workspaces/artifacts/api_route_inventory.json`
    - `objectives/external-project-workspaces/artifacts/codecaine-external.zip`
    - `objectives/external-project-workspaces/artifacts/zip_manifest.txt`
    - `objectives/external-project-workspaces/artifacts/browser_authoring_validation.json`
    - `objectives/external-project-workspaces/artifacts/browser_recheck.json`
    - `objectives/external-project-workspaces/artifacts/browser_summary.json`
    - `objectives/external-project-workspaces/artifacts/hardcoded_path_audit.json`
    - `objectives/external-project-workspaces/artifacts/run_summary.json`
    - `objectives/external-project-workspaces/artifacts/screenshots/`
</artifacts>

<risks_or_open_questions>
    - Legacy app-local Codecaine duplicates are still present by policy. Remove them in a separate cleanup only after fallback is no longer desired.
    - Browser validation used headless Chromium via the Playwright package in `apps/pi-asset-loop`; Browser MCP tools were not exposed in this session.
    - Several unrelated dirty files from the main-menu PI objective remain in the worktree; preserve them.
</risks_or_open_questions>

<important_paths>
    - `apps/scene-engine/workspace.catalog.example.json`
    - `apps/scene-engine/workspace.catalog.json` (local, gitignored)
    - `../codecaine-site/`
    - `apps/scene-engine/app/_engine/lib/workspace-catalog.ts`
    - `apps/scene-engine/app/_engine/lib/project-paths.ts`
    - `apps/scene-engine/app/_engine/lib/project-file-serving.ts`
    - `apps/scene-engine/app/api/projects/[projectId]/`
    - `objectives/external-project-workspaces/report.md`
</important_paths>
</current_state>
