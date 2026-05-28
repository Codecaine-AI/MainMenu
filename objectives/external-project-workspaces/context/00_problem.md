<problem>
    <objective_question>
        - How should the Scene Engine be rewritten so it behaves like an editor/runtime application that opens external project workspaces, instead of a repo where projects and project assets live inside the engine app?
    </objective_question>

    <current_baseline>
        - `apps/scene-engine/projects/codecaine/` contains the Codecaine project manifest and scenes.
        - `apps/scene-engine/public/assets`, `apps/scene-engine/public/modules`, and `apps/scene-engine/public/fonts` contain the media, registries, modules, effects, and fonts that Codecaine depends on.
        - Scene discovery starts from `process.cwd()/projects`; upload, registry, asset listing, font discovery, renderer registry loading, desktop seed preparation, and export still assume app-local project/public paths in several places.
        - The docs already state the current split is incomplete: projects are folder-driven, but assets/modules/fonts remain app-level shared libraries.
    </current_baseline>

    <why_current_state_is_insufficient>
        - Codecaine cannot be tracked and deployed as a clean standalone project repo because its source assets and modules are mixed into the scene-engine application repo.
        - Open-sourcing the scene engine in this state would either ship project-specific content with the engine or require an unclear extraction process.
        - The current `public/` layout makes "shared engine assets" the default even when the immediate product need is project-local ownership.
        - A future desktop/editor workflow needs to open a catalog of project roots, not assume every project lives under the engine source tree.
    </why_current_state_is_insufficient>

    <failure_modes>
        - `[engine_project_coupling]`: Codecaine files live under engine-owned folders, so commits, releases, and open-source boundaries mix application logic with project content.
        - `[hidden_global_assets]`: Scenes reference ids whose files are resolved from app-level registries, making it hard to know what a project actually owns.
        - `[shared_library_prematureness]`: Treating CRT/menu modules as shared engine modules creates a false abstraction before there is a real built-in package model.
        - `[unsafe_external_paths]`: Adding arbitrary external roots without a strict path adapter can create path traversal risks or inconsistent URL behavior.
        - `[export_regression]`: Rewriting file roots can break the standalone zip if registry paths, module paths, fonts, or renderer URL rewriting are not migrated together.
    </failure_modes>

    <prior_evidence>
        - `docs/scene-engine/10-system-design/05-project-model.md`: documents `projects/<id>` as project-owned while explicitly keeping assets/modules/fonts app-level "for now".
        - `docs/scene-engine/10-system-design/50-build-output.md`: export currently reads project scenes and app-local registries/assets/modules/fonts into a static bundle.
        - `apps/scene-engine/app/_engine/lib/scenes.ts`: discovers projects from `process.cwd()/projects` with a legacy root fallback.
        - `apps/scene-engine/app/api/upload/route.ts`: writes uploads into `process.cwd()/public/assets`.
        - `apps/scene-engine/app/api/export/route.ts`: reads registries and files from app-local `public/` while reading scenes from the selected project root.
        - `apps/scene-engine/app/_engine/renderer/asset-registry.js`: fetches `/assets/registry.json`, `/modules/registry.json`, and font manifests from root URLs.
    </prior_evidence>

    <expected_value>
        - The scene engine becomes a reusable application that can open project workspaces from a catalog.
        - Codecaine becomes a project-local body of data that can be moved into its own repository and deployed independently.
        - Future built-ins remain possible, but the first working model is simpler: project content belongs to the project, engine code belongs to the engine.
    </expected_value>
</problem>
