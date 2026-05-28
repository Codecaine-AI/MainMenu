# External Project Workspaces Report

## Outcome

The Scene Engine now loads Codecaine from an external project workspace through a file-backed catalog. The engine owns renderer/editor/API/export primitives; Codecaine owns its scenes, media, fonts, registries, modules, and effects in `../codecaine-site/`.

## Implemented

- Added workspace catalog discovery and shared project path resolution.
- Added project-local dev file routes for registries, assets, modules, and fonts with traversal protection.
- Refactored scene APIs, asset library, upload, registry patch, font discovery, renderer registry loading, component schema loading, preview/editor URLs, desktop runtime prep, and export to resolve through project paths.
- Migrated Codecaine into the Unity-style layout:
  - `ProjectSettings/project.json`
  - `ProjectSettings/registries/{assets,modules}.json`
  - `Assets/Scenes/{title,menu}/scene.json`
  - `Assets/Media/{audio,image,video,glyph}`
  - `Assets/Modules/{components,effects}`
  - `Assets/Fonts`
- Added `apps/scene-engine/workspace.catalog.example.json`; the local catalog is gitignored.
- Patched Codecaine project modules so logical `/assets`, `/modules`, and `/fonts` URLs resolve through project dev routes or `MELEE_BUNDLE_ROOT` in exports.
- Removed app-global Codecaine font-face loading so scene fonts come from project font registries.
- Updated docs for the project model, registry model, export, upload/selection, asset APIs, editor loader/panels, renderer registry, manifests, running, and current state.

## Validation

- `cd apps/scene-engine && npx tsc --noEmit` passed.
- Dev API checks passed for catalog scene load, project registries, project module serving, traversal rejection, and unknown-project 404.
- `POST /api/export?project=codecaine` regenerated `artifacts/codecaine-external.zip`.
- Playwright validation passed for dashboard, project page, title/menu previews, editor save, upload, asset-library selection, and project-local request routing.
- Exported bundle validation passed for title render, title click navigation to menu, and direct menu route render.
- Hard-coded path/docs audit reports zero stale docs hits; remaining app-code hits are documented export or legacy fallback defaults.

## Policy

Legacy app-local Codecaine files remain in place as fallback/source comparison data. They are not used by normal catalog-backed Codecaine authoring or export. Removing them should be a separate cleanup after fallback is no longer needed.
