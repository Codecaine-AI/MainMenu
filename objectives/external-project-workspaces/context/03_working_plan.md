<working_plan>
    <overview>
        1. inventory_and_contract - Inventory current path assumptions and finalize the workspace catalog/project folder contract.
        2. workspace_catalog_and_paths - Implement catalog loading plus project path resolution with legacy fallback.
        3. project_local_content_and_serving - Migrate Codecaine content into the external layout and serve project-local assets/modules/fonts in dev.
        4. editor_api_export_migration - Update editor, APIs, renderer registry loading, upload, and export to use project-local data.
        5. validation_docs_handoff - Validate authoring/export behavior, update docs, and leave durable handoff artifacts.
    </overview>

    <operating_principles>
        - The engine opens projects; it does not own project content.
        - The workspace catalog is the local source of truth for where projects live.
        - Project data access must be centralized through one path adapter, not scattered `process.cwd()` joins.
        - No shared asset/module library for v1. Move project-authored modules into Codecaine, and leave only renderer primitives in the engine.
        - Keep migration reversible until validation proves the external workspace works.
    </operating_principles>

    <phase id="1" name="inventory_and_contract">
        <objective>
            - Establish the current embedded layout, path assumptions, export behavior, and finalized external workspace contract before editing implementation code.
        </objective>
        <inputs>
            - `apps/scene-engine/projects/codecaine/project.json`
            - `apps/scene-engine/projects/codecaine/scenes/**/scene.json`
            - `apps/scene-engine/public/assets/registry.json`
            - `apps/scene-engine/public/modules/registry.json`
            - `apps/scene-engine/public/assets/**`
            - `apps/scene-engine/public/modules/**`
            - `apps/scene-engine/public/fonts/**`
            - `docs/scene-engine/10-system-design/05-project-model.md`
            - `docs/scene-engine/10-system-design/20-asset-registry.md`
            - `docs/scene-engine/10-system-design/50-build-output.md`
            - `rg` output for `process.cwd()`, `public/assets`, `public/modules`, `projects/`, `/assets/registry.json`, and `/modules/registry.json`.
        </inputs>
        <process>
            - Run `git status --short` and record unrelated dirty files in `current_state.md`.
            - Inventory every app-local project/public path assumption and classify it as discovery, API read/write, renderer fetch, editor URL, export copy, desktop seed, or docs.
            - Capture a baseline Codecaine export from the currently running dev server if available.
            - Finalize the workspace catalog schema and project folder contract from `context/01_constraints.md`, updating that file if implementation reality requires a narrower first step.
            - Decide the local catalog default path and example file path; ensure machine-specific absolute paths stay gitignored.
        </process>
        <outputs>
            - `artifacts/path_inventory.json`: current path assumptions, owner files, migration category, and intended adapter replacement.
            - `artifacts/baseline_export_summary.json`: baseline export size, manifest counts, and validation notes if export is available.
            - `examples/workspace.catalog.example.json`: example catalog with relative Codecaine root.
            - Updated `context/01_constraints.md` if the final folder contract changes.
        </outputs>
        <gate>
            - A future agent can point to one catalog schema, one project layout, and a complete list of current path assumptions before code migration begins.
        </gate>
        <failure_handling>
            - If baseline export fails before migration, capture the failure and proceed only if the failure is unrelated to external workspace design or has a narrow prerequisite fix.
        </failure_handling>
    </phase>

    <phase id="2" name="workspace_catalog_and_paths">
        <objective>
            - Add the local project database/catalog and central project path adapter while preserving legacy embedded project loading.
        </objective>
        <inputs>
            - Phase 1 contract and path inventory.
            - `apps/scene-engine/app/_engine/lib/scenes.ts`
            - dashboard/project pages that call `discoverProjects`, `loadProject`, `projectRoot`, and `discoverScenes`.
        </inputs>
        <process>
            - Implement workspace catalog parsing, validation, relative-root resolution, and duplicate/missing project diagnostics.
            - Add `project-paths` helpers for manifest, scenes, media, modules, fonts, registries, generated cache, export output, and safe child path resolution.
            - Refactor project discovery/loading to prefer catalog projects and keep legacy `apps/scene-engine/projects` as a compatibility fallback.
            - Update dashboard/project routes to surface catalog diagnostics without blocking valid projects.
            - Add unit-level or script-level checks for catalog parsing and path traversal rejection.
        </process>
        <outputs>
            - Workspace catalog helper code.
            - Project path adapter code.
            - Legacy fallback behavior documented in code/docs.
            - `artifacts/catalog_validation.json`: valid/invalid catalog cases and path safety checks.
        </outputs>
        <gate>
            - Dashboard can list a catalog-defined project and legacy Codecaine can still load if no catalog is configured.
        </gate>
        <failure_handling>
            - If full catalog diagnostics are too large for the first pass, keep parsing strict and expose a concise error per invalid project while preserving valid entries.
        </failure_handling>
    </phase>

    <phase id="3" name="project_local_content_and_serving">
        <objective>
            - Move Codecaine-owned content into the external project layout and make dev-time logical URLs resolve from the active project.
        </objective>
        <inputs>
            - Phase 2 path adapter.
            - Current Codecaine scenes, media, modules, fonts, and registries.
            - Renderer registry loader and API/static serving routes.
        </inputs>
        <process>
            - Create or populate a Codecaine external workspace using the folder contract in `context/01_constraints.md`.
            - Migrate scenes to `Assets/Scenes`, project manifest to `ProjectSettings/project.json`, registries to `ProjectSettings/registries`, media to `Assets/Media`, modules to `Assets/Modules`, and fonts to `Assets/Fonts`.
            - Rewrite registry `file`/`path` fields to logical project URLs while preserving ids.
            - Add project-aware dev serving routes for media, modules, font files, and registries. Routes must resolve through the project path adapter.
            - Update renderer registry loading in dev so `/assets/registry.json`/`/modules/registry.json` assumptions are replaced or routed through the active project.
            - Record old-to-new path mappings and any files intentionally left engine-owned.
        </process>
        <outputs>
            - External Codecaine workspace content.
            - Project-local dev serving routes.
            - Updated registry/logical path behavior.
            - `artifacts/migration_manifest.json`: old path, new path, file type, registry id when applicable, and migration status.
        </outputs>
        <gate>
            - Codecaine title/menu previews render from the external workspace without reading active project assets/modules/fonts from `apps/scene-engine/public`.
        </gate>
        <failure_handling>
            - If physical file moves are too disruptive inside an existing dirty worktree, first implement a copied external workspace and document the final deletion step for app-local duplicates after validation.
        </failure_handling>
    </phase>

    <phase id="4" name="editor_api_export_migration">
        <objective>
            - Update authoring APIs, editor flows, asset upload/selection, font discovery, desktop seed behavior, and export to use project-local data.
        </objective>
        <inputs>
            - External workspace from phase 3.
            - Scene, asset, upload, registry, font, asset-library, project, editor, and export code.
        </inputs>
        <process>
            - Refactor scene GET/PUT APIs to read/write `Assets/Scenes` through the selected project path adapter.
            - Refactor upload and asset/registry APIs to write project-local media files and `ProjectSettings/registries/assets.json`.
            - Refactor module registry loading and asset-library usage to read project-local modules and project-local registries.
            - Refactor font discovery to use project-local `Assets/Fonts`.
            - Update editor and upload UI query/body parameters so project identity is always present when reading or mutating project data.
            - Refactor export to consume the selected external project root and emit the same static bundle shape as before.
            - Update desktop runtime preparation so it no longer seeds app-local Codecaine `projects`/`public` as if they were engine assets.
        </process>
        <outputs>
            - Project-aware API/editor/export implementation.
            - Updated desktop preparation behavior or a documented desktop follow-up if desktop support cannot be safely finished in this objective.
            - `artifacts/api_route_inventory.json`: route, project path helper used, read/write targets, and validation status.
        </outputs>
        <gate>
            - From the dashboard, a user can open external Codecaine, edit/save a scene, upload/select an asset, and export a static bundle without relying on engine-local project/public content.
        </gate>
        <failure_handling>
            - If a route still needs temporary legacy fallback, mark it explicitly in `api_route_inventory.json` and `current_state.md`; do not leave silent mixed-root behavior.
        </failure_handling>
    </phase>

    <phase id="5" name="validation_docs_handoff">
        <objective>
            - Validate the result, write the report, and leave a durable handoff.
        </objective>
        <inputs>
            - Outputs from phases 1-4.
        </inputs>
        <process>
            - Run the validation ladder from `context/04_validation_and_handoff.md`.
            - Compare external workspace export against baseline for render behavior, navigation, zip contents, and dependency roots.
            - Search for remaining hard-coded app-local project/public assumptions and classify any leftovers as legacy fallback or bug.
            - Update scene-engine docs for project model, asset registry, authoring surfaces, export output, and running workflow.
            - Write report sections that explain the catalog schema, final project layout, migration behavior, compatibility fallbacks, rejected routes, risks, and next actions.
            - Update `current_state.md` with decisions, commands, paths, risks, and next actions.
        </process>
        <outputs>
            - `report.md`: final objective report.
            - `current_state.md`: updated handoff state.
            - `artifacts/run_summary.json`: commands, counts, decisions, and artifact index.
        </outputs>
        <gate>
            - Completion criteria in `goal.md` and validation gates in `context/04_validation_and_handoff.md` are satisfied or the report clearly marks the objective as blocked/rejected.
        </gate>
        <failure_handling>
            - If validation fails, keep artifacts, explain the failure, and route the next objective or rollback path.
        </failure_handling>
    </phase>
</working_plan>
