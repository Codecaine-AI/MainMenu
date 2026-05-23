<working_plan>
    <overview>
        1. baseline_and_inventory - Measure current export size, active references, dashboard/editor flows, and dirty worktree risks.
        2. asset_library_model - Introduce backwards-compatible asset-library records, project scope, scene-local selection semantics, and API support.
        3. dashboard_and_editor_ui - Clean up the Scene Engine dashboard, Asset Library page, project pages, upload flow, and editor asset pickers.
        4. active_export_graph - Implement dependency reachability, manifest-backed module dependencies, pruned registries, and active-only zip writing.
        5. validation_and_handoff - Validate dev UI plus exported runtime, record artifacts, update docs/state, and hand off.
    </overview>

    <operating_principles>
        - Keep the asset-library model explicit. A file in `public/assets` is not the same thing as a scene object or a project-local selection.
        - Preserve old ids during migration. Existing scenes using `asset` should still resolve while the new model is introduced.
        - Prefer manifest/schema metadata over fragile path guessing. Use scanning as a safety net and warning generator, not the main contract.
        - Validate both authoring and export. A clean dashboard is not enough if exported Codecaine breaks, and a smaller zip is not enough if the editor still mutates global choices.
    </operating_principles>

    <phase id="1" name="baseline_and_inventory">
        <objective>
            - Establish the current baseline for export size, included files, active dependency estimates, dashboard routes, editor asset swapping behavior, and dirty worktree state.
        </objective>
        <inputs>
            - `apps/scene-engine/public/assets/registry.json`
            - `apps/scene-engine/public/modules/registry.json`
            - `apps/scene-engine/projects/codecaine/project.json`
            - `apps/scene-engine/projects/codecaine/scenes/title/scene.json`
            - `apps/scene-engine/projects/codecaine/scenes/menu/scene.json`
            - `apps/scene-engine/app/api/export/route.ts`
            - `apps/scene-engine/app/page.tsx`
            - `apps/scene-engine/app/projects/[projectId]/page.tsx`
            - `apps/scene-engine/app/editor/_components/AssetSwapDropdown.tsx`
        </inputs>
        <process>
            - Run `git status --short` and record unrelated dirty files in `current_state.md`.
            - Generate a fresh baseline export zip from `POST /api/export?project=codecaine`.
            - Write a manifest and size summary for the baseline zip.
            - Run or add a temporary reachability audit that reports scene asset ids, module ids, literal public files, font references, unresolved references, and estimated active bytes.
            - Inventory current dashboard/editor routes and capture screenshots or notes for root, project page, upload page, and asset picker behavior.
            - Identify component modules with implicit dependencies that the active export graph cannot infer from manifests.
        </process>
        <outputs>
            - `artifacts/baseline_export_summary.json`: baseline zip size, registry counts, copied file counts, estimated active bytes, and known bloat sources.
            - `artifacts/baseline_zip_manifest.txt`: current zip manifest.
            - `artifacts/dependency_inventory.json`: active id/path estimate plus unresolved or implicit dependencies.
            - `current_state.md`: updated with baseline, dirty worktree notes, and first implementation target.
        </outputs>
        <gate>
            - Baseline export and active dependency estimate exist, or a documented server/export blocker explains the narrow fix required before proceeding.
        </gate>
        <failure_handling>
            - If the dev server is unavailable, perform a light health check and start it only if needed.
            - If export fails before this objective changes behavior, preserve the error and decide whether it is caused by the uncommitted make-run export changes or a separate regression.
        </failure_handling>
    </phase>

    <phase id="2" name="asset_library_model">
        <objective>
            - Introduce the data model and APIs that separate shared asset records from scene/project selections.
        </objective>
        <inputs>
            - Output from phase 1.
            - Existing asset registry, module registry, scene JSON, editor store, upload route, assets routes, and registry route.
        </inputs>
        <process>
            - Define TypeScript types for library assets, asset scope/gating, selected asset refs, module dependencies, and export graph summaries.
            - Keep current registry ids as library asset ids where possible. Add optional metadata such as label, type, file, tags, scope, project ids, created/updated timestamps, and usage notes.
            - Update upload APIs so new uploads create library asset records with type and metadata.
            - Add or refactor asset-library list/update APIs to support filters by type, project availability, and usage.
            - Change editor state actions so selecting a different video/audio/glyph/image updates the scene object or slot binding, not the global asset file path.
            - Provide compatibility loading for old scenes whose `asset` field directly names an asset id.
            - Add migration notes or scripts only if manual JSON changes would be error-prone.
        </process>
        <outputs>
            - Updated types and APIs for asset-library records and project availability.
            - Updated editor store behavior for scene-local asset selection.
            - `artifacts/model_migration_notes.md`: model decisions, legacy compatibility, and data examples.
        </outputs>
        <gate>
            - A Codecaine scene object can select a different eligible background asset in editor state without changing the selected asset's library file globally.
        </gate>
        <failure_handling>
            - If a full schema migration becomes too large, implement the smallest compatible bridge: preserve `asset` as selected library id, stop PATCHing registry files for swaps, and defer deeper metadata enrichment with a documented follow-up.
        </failure_handling>
    </phase>

    <phase id="3" name="dashboard_and_editor_ui">
        <objective>
            - Make the Scene Engine authoring UI communicate Projects, Asset Library, upload/import, project usage, and scene editing clearly.
        </objective>
        <inputs>
            - Data/API outputs from phase 2.
            - Current dashboard root, project page, upload page, editor layer form, add-layer dialog, asset picker, and global CSS/design conventions.
        </inputs>
        <process>
            - Redesign the root dashboard as an operational workspace with first-class navigation for Projects and Asset Library.
            - Add an Asset Library page with type filters, asset rows/cards, file/type metadata, project availability, and usage count or usage locations where available.
            - Update upload/import flow so it returns users to the asset library and shows created asset metadata.
            - Update project page to show scenes, export action/status, and project asset usage or availability.
            - Update editor asset picker controls to choose from library assets filtered by object/slot type and project scope.
            - Verify no visible UI copy describes implementation internals such as registry mutation; user-facing labels should match workflows.
        </process>
        <outputs>
            - Dashboard, Asset Library, project page, upload, and editor asset picker UI changes.
            - Screenshots or browser notes under `artifacts/screenshots/` for root, asset library, project page, and picker states.
        </outputs>
        <gate>
            - A user can start at the Scene Engine dashboard, open projects, inspect assets, upload/import an asset, and choose an asset for a scene object through a clear workflow.
        </gate>
        <failure_handling>
            - If usage counting is not reliable yet, label it as unavailable or partial and keep the rest of the asset library workflow functional.
        </failure_handling>
    </phase>

    <phase id="4" name="active_export_graph">
        <objective>
            - Replace broad-copy export with deterministic reachability and pruned registries.
        </objective>
        <inputs>
            - Project manifest and scene JSON.
            - Asset-library records, module registry, module manifests, renderer requirements, font registry/discovery, and outputs from phases 1-3.
        </inputs>
        <process>
            - Implement an export collector that traverses project scenes, objects, children, slots, events, selected asset refs, module ids, typed component properties, literal `/assets`, `/modules`, and `/fonts` references, and font usage.
            - Add manifest dependency fields for modules that load secondary JS/CSS/SVG/assets, starting with `main-menu-system`, `menu-items`, `menu-shield`, `side-menu`, and keycap-related components.
            - Update component property schemas so asset-ref properties such as `ui-navigation-sound`, `ui-forward-sound`, and `ui-back-sound` are declared as audio asset refs rather than plain strings.
            - Have `app/api/export/route.ts` write pruned `assets/registry.json`, `modules/registry.json`, and `fonts/registry.json` from the collector output.
            - Copy only dependency-reachable asset files, module directories/files, literal files, and fonts. Preserve text path rewriting and standalone runtime behavior from the prior export objective.
            - Emit warnings or an artifact summary for unresolved dynamic references rather than silently dropping them.
        </process>
        <outputs>
            - Export reachability collector code and tests/audit artifacts.
            - Updated module manifests and property schemas for dependency declaration.
            - Pruned export zip and `artifacts/active_export_summary.json`.
        </outputs>
        <gate>
            - Fresh Codecaine export excludes unused main-menu background variants, contains all required runtime files, and is materially smaller than the baseline.
        </gate>
        <failure_handling>
            - If a dependency cannot be represented cleanly in metadata, add a temporary explicit dependency rule with a warning and document the module that must be cleaned up later.
        </failure_handling>
    </phase>

    <phase id="5" name="validation_and_handoff">
        <objective>
            - Validate the result, write the report, and leave a durable
              handoff.
        </objective>
        <inputs>
            - Outputs from phases 1-4.
        </inputs>
        <process>
            - Run the validation ladder from `context/04_validation_and_handoff.md`.
            - Compare final export size, manifest counts, included asset ids, excluded asset ids, and browser runtime result against baseline.
            - Verify dashboard root, Asset Library, project page, upload flow, and editor picker in browser.
            - Write report sections that explain model changes, migration behavior, UI changes, export pruning, rejected routes, risks, and next actions.
            - Update `current_state.md` with decisions, commands, paths, risks,
              and next actions.
        </process>
        <outputs>
            - `report.md`: final objective report.
            - `current_state.md`: updated handoff state.
            - `artifacts/run_summary.json`: commands, counts, decisions, and
              artifact index.
        </outputs>
        <gate>
            - Completion criteria in `goal.md` and validation gates in
              `context/04_validation_and_handoff.md` are satisfied or the
              report clearly marks the objective as blocked/rejected.
        </gate>
        <failure_handling>
            - If validation fails, keep artifacts, explain the failure, and
              route the next objective or rollback path.
        </failure_handling>
    </phase>
</working_plan>
