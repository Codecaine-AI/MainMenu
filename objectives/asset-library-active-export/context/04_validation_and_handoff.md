<validation_and_handoff>
    <validation_ladder>
        - `typecheck`: run `cd apps/scene-engine && npx tsc --noEmit` after TypeScript/API/editor changes; pass condition is zero type errors.
        - `dev_ui_smoke`: use the running dev server at `http://localhost:3000` to inspect root dashboard, Asset Library, project page, upload/import path, and editor asset picker; pass condition is the workflow is reachable and controls do not overlap or expose stale registry-swap semantics.
        - `model_behavior_check`: change a scene object's selected library asset through the editor/API and verify the scene JSON/project binding changes while the global library asset file path does not change unexpectedly.
        - `baseline_export`: generate a baseline or pre-change zip and record size, manifest counts, registered asset bytes, active estimate, and warnings.
        - `active_export`: generate a fresh final zip from `POST /api/export?project=codecaine`; pass condition is inactive background variants are excluded and pruned registries contain only reachable ids.
        - `exported_runtime`: cleanly extract the final zip, run `make run`, open root and `/menu/`, trigger title-to-menu navigation, and capture browser console/network summaries; pass condition is both scenes render with zero fatal console errors and zero failed required requests.
        - `manifest_audit`: inspect final `zip_manifest.txt`, `assets/registry.json`, `modules/registry.json`, and `fonts/registry.json`; pass condition is included entries match the export graph or documented compatibility exceptions.
    </validation_ladder>

    <artifact_contract>
        - `artifacts/baseline_export_summary.json`: command, timestamp, zip path, zip size, asset registry count, module registry count, font count, copied file count, and initial active dependency estimate.
        - `artifacts/dependency_inventory.json`: active scene ids, active asset ids, active module ids, font refs, literal files, implicit dependencies, unresolved refs, and warnings.
        - `artifacts/active_export_summary.json`: final command, timestamp, zip size, size delta, included/excluded asset ids, included/excluded module ids, included fonts, copied literal files, and warnings.
        - `artifacts/zip_manifest.txt`: sorted final zip file list.
        - `artifacts/browser_summary.json`: tested URLs, rendered scene signals, navigation result, console entries, network failures, and screenshot paths.
        - `artifacts/screenshots/`: root dashboard, Asset Library, project page, editor picker, exported title, exported menu, and navigation proof where browser tooling is available.
        - `report.md`: final narrative report with baseline, implementation summary, validation, risks, and follow-up recommendations.
    </artifact_contract>

    <acceptance_gates>
        - `asset_model_acceptance`: asset records are reusable library items; scene objects/slots hold selected asset refs; editor swaps do not mutate global file paths.
        - `dashboard_acceptance`: root dashboard and project pages give clear access to Projects, Asset Library, upload/import, scenes, editor, and export.
        - `export_acceptance`: Codecaine final export is active-only, excludes unused main-menu background videos, includes all required dynamic module dependencies, and remains runnable via `make run`.
        - `runtime_acceptance`: exported root/title and `/menu/` render from a clean extraction over static HTTP, and navigation from title to menu works.
        - `documentation_acceptance`: objective report or docs explain the new asset/reference/dependency model well enough for the next feature to extend it without rediscovering the architecture.
    </acceptance_gates>

    <report_contract>
        - `report.md` must summarize baseline size and UI behavior, new asset-library model, migration behavior, dashboard/editor changes, export graph design, final size comparison, validation commands, artifacts, rejected routes, risks, and recommended next action.
    </report_contract>

    <current_state_update>
        - Before handoff, update `current_state.md` with completed work, active decision, commands run, artifact paths, final size comparison, UI validation status, export validation status, risks, and next actions.
    </current_state_update>

    <blocked_or_failed_handoff>
        - If the objective cannot complete, preserve artifacts, state the blocker, identify whether it is data-model, UI, export graph, or runtime validation related, and define the smallest useful next step.
        - If active-only export is blocked by hidden module dependencies, list each module and the missing dependency metadata required.
        - If UI work is blocked by unresolved model decisions, keep the current UI stable and document the minimal model question to answer next.
    </blocked_or_failed_handoff>
</validation_and_handoff>
