<problem>
    <objective_question>
        - Why does the exported Codecaine build fail to load after export, and what export/runtime changes are required so a freshly generated standalone zip renders from a static host?
    </objective_question>

    <current_baseline>
        - User report: export creation succeeds, but opening the exported build does not load anything.
        - Scene-engine dev server is normally assumed to already be running at `http://localhost:3000`.
        - The export endpoint is `apps/scene-engine/app/api/export/route.ts` and is invoked as `POST /api/export?project=codecaine`.
        - Codecaine project data lives under `apps/scene-engine/projects/codecaine/`; entry scene is `title`, second scene is `menu`.
        - Exported runtime entry is `apps/scene-engine/app/_engine/export/boot.js`; it imports `./renderer/scene-renderer.js` and `./renderer/asset-registry.js`, fetches `project.json`, fetches scene JSON, loads registries, and renders into `#stage`.
    </current_baseline>

    <why_current_state_is_insufficient>
        - The current export may package files correctly enough to create a zip, but there is no objective-local proof that the zip can run independently of the Next app.
        - The phrase "does not load" needs browser evidence: console errors, network failures, DOM state, and screenshots from the extracted artifact.
    </why_current_state_is_insufficient>

    <failure_modes>
        - `file_protocol_fetch_blocked`: double-clicking `index.html` may fail because module scripts and `fetch()` from `file://` are browser-restricted. Diagnose separately from static HTTP failures.
        - `missing_exported_file`: zip omits a renderer dependency, project file, scene file, asset, module directory, font file, CSS file, or registry required at runtime.
        - `wrong_relative_path`: export rewrites root-relative `/assets`, `/modules`, or `/fonts` paths incorrectly for root pages, nested scene pages, dynamic imports, CSS URLs, or registry entries.
        - `module_runtime_mismatch`: copied renderer files contain imports that resolve in the Next app but not in the standalone zip.
        - `registry_mismatch`: `assets/registry.json`, `modules/registry.json`, or `fonts/registry.json` points at paths unavailable from the extracted bundle root.
        - `navigation_mismatch`: exported navigation calculates URLs that work for the entry page but fail for nested scene pages or browser back/forward flows.
        - `silent_blank_stage`: boot catches or logs errors but leaves a black page; use console/network evidence and DOM inspection, not visual absence alone.
    </failure_modes>

    <prior_evidence>
        - `apps/scene-engine/app/api/export/route.ts`: creates a JSZip archive, writes project and scene JSON, copies renderer files with root-path rewriting, writes `boot.js`, emits root and per-scene HTML, copies assets, module directories, and fonts.
        - `apps/scene-engine/app/_engine/export/boot.js`: computes `BUNDLE_ROOT` from `import.meta.url`, fetches JSON relative to that root, loads the renderer registry, and navigates to `${sceneId}/index.html` in page mode.
        - `apps/scene-engine/projects/codecaine/project.json`: project id `codecaine`, entry `title`, scenes `title` and `menu`.
    </prior_evidence>

    <expected_value>
        - The Codecaine project can be handed off as a standalone rendered export instead of requiring the scene-engine dev server.
        - Future export regressions have a reproducible validation ladder and artifacts under this objective.
    </expected_value>
</problem>
