<constraints>
    <hard_rules>
        - Preserve user changes in a dirty worktree. Read `git status --short` before editing and do not revert unrelated menu/editor changes.
        - Assume the Scene Engine dev server is already available at `http://localhost:3000`; health check before starting or restarting it.
        - Do not run `npm run build` merely to check routine scene, editor, API, or frontend changes. Use targeted checks and browser validation unless production compilation is explicitly needed.
        - Export validation must use a fresh zip generated from `POST /api/export?project=codecaine`, a clean extraction, and static HTTP serving from the extracted root.
        - Keep exported projects runnable with `make run` and the dependency-free Node static server from the prior export work.
        - Existing Codecaine scenes and registry data must migrate or continue working through compatibility shims.
        - Active-only export must fail closed or warn clearly when a dependency cannot be resolved; silent omission of required files is invalid.
    </hard_rules>

    <forbidden_shortcuts>
        - `copy_everything_export`: invalid because the objective is to export only active dependencies.
        - `registry_file_swap_as_selection`: invalid because it keeps project-local choices as global mutations.
        - `ui_only_cleanup`: invalid because clearer pages without data-model changes preserve the core bug.
        - `string_scan_only_dependency_graph`: insufficient as the sole strategy because component/module dependencies should be declared in manifests or schemas where possible.
        - `hardcode_codecaine_only_pruning`: invalid unless isolated as a temporary compatibility fallback; the export graph must work for projects generally.
        - `break_old_scene_json`: invalid without a migration path and validation against existing `title` and `menu` scenes.
    </forbidden_shortcuts>

    <data_and_feature_boundaries>
        - Deployable inputs: `project.json`, scene JSON, asset registry/library records, module registry records, module manifests, renderer import behavior, and public file references.
        - Diagnostic-only inputs: temporary reachability scripts, baseline size reports, screenshots, console/network captures, and zip manifests under objective artifacts.
        - Local-only outputs: exported zips, extracted folders, browser profiles, static server logs, and generated audit JSON under `objectives/asset-library-active-export/artifacts/`.
        - Forbidden inputs: external hosted assets, cloud storage, user identity/permission assumptions, and hand-edited exported extractions used as proof.
    </data_and_feature_boundaries>

    <risk_budget>
        - `export_runtime_regression`: zero tolerance for fatal console errors or failed required requests in exported `title` and `menu` validation.
        - `bundle_size_regression`: active-only Codecaine export must be materially smaller than the baseline full-copy export; if size does not drop, the reachability graph is suspect.
        - `migration_breakage`: zero tolerance for current Codecaine scenes failing to load in dev preview after migration.
        - `implicit_dependency_unknowns`: every discovered dynamic dependency must become manifest/schema metadata or be documented as a temporary explicit collector rule.
        - `ui_text_overlap_or_confusion`: dashboard/editor UI must be checked in browser at desktop and narrow widths where practical.
    </risk_budget>

    <promotion_or_completion_gates>
        - `model_gate`: a scene object can select a library asset without mutating the global library record.
        - `dashboard_gate`: root dashboard exposes Projects and Asset Library as first-class surfaces and project pages keep export/scenes/assets coherent.
        - `dependency_gate`: export collector emits active asset ids, module ids, font ids/files, literal files, warnings, and size summary.
        - `zip_gate`: fresh exported Codecaine zip excludes inactive main-menu background variants and includes only dependency-reachable registry entries.
        - `browser_gate`: clean extraction served with `make run` renders root/title and `/menu/`, and title-to-menu navigation works.
    </promotion_or_completion_gates>
</constraints>
