<constraints>
    <hard_rules>
        - Validate the exported artifact itself. Rendering through Next routes such as `/scenes/title` or editor pages does not satisfy this objective.
        - Regenerate the zip after code changes and validate the fresh extracted copy. Do not manually repair extracted files and count that as a fix.
        - Preserve the existing Codecaine scene content unless a scene JSON defect is proven to be the cause of export failure.
        - Keep changes scoped to export generation, standalone runtime boot, renderer path compatibility, registry/path generation, and focused validation helpers.
        - Respect the repo instruction that the scene-engine dev server is usually already running at `http://localhost:3000`; do a light health check before starting or restarting it.
    </hard_rules>

    <forbidden_shortcuts>
        - `dev_route_success`: A Next route rendering successfully is invalid because it does not prove the exported artifact works.
        - `manual_extracted_patch`: Editing files after unzip is invalid because it bypasses the export pipeline.
        - `cache_dependent_pass`: A browser cache-dependent pass is invalid because users opening a fresh export will not have cached app files.
        - `dev_origin_dependency`: A pass that imports files from `http://localhost:3000`, `/_next/`, or app source paths outside the extracted folder is invalid because the export must be standalone.
        - `root_only_smoke`: A pass that only opens root `index.html` is incomplete because the export also emits per-scene pages and navigation.
        - `ignored_console_errors`: A pass that ignores console errors or failed network requests is invalid unless each failure is documented as non-fatal and unrelated to required rendering.
    </forbidden_shortcuts>

    <data_and_feature_boundaries>
        - Deployable inputs are source files under `apps/scene-engine` and project data under `apps/scene-engine/projects/codecaine/`.
        - Diagnostic-only inputs include generated zips, extracted files, browser traces, screenshots, and temporary instrumentation used only to find the cause.
        - Local-only artifacts belong under `objectives/run-exported-codecaine-build/artifacts/`.
        - Forbidden dependencies include runtime requests to the Next dev server, absolute local filesystem paths, and files outside the extracted export root.
    </data_and_feature_boundaries>

    <risk_budget>
        - `optional_font_warning`: Minor optional font warnings are acceptable only if text still renders and the missing font is documented with path evidence.
        - `visual_timing_variance`: Visual differences caused by live media timing are acceptable only if required scene structure and assets render.
        - `file_protocol_failure`: If static HTTP passes but `file://` fails, record that explicitly and ask whether true double-click support is required before expanding scope.
    </risk_budget>

    <promotion_or_completion_gates>
        - `export_gate`: `POST http://localhost:3000/api/export?project=codecaine` returns HTTP 200 and a zip file with the expected top-level runtime/data directories.
        - `static_host_gate`: extracted files are served from a local static server rooted at the extracted export directory, not from the Next app.
        - `entry_render_gate`: exported root `index.html` renders the `title` scene with a populated `#stage` and visible non-background content.
        - `menu_render_gate`: exported `menu/index.html` renders the `menu` scene with visible content.
        - `clean_runtime_gate`: Chromium console and network capture contain no fatal boot errors and no failed required JSON, JS, CSS, asset, module, or font requests.
    </promotion_or_completion_gates>
</constraints>
