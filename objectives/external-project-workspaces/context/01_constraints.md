<constraints>
    <workspace_catalog_contract>
        - Implement a file-backed workspace catalog before adding any heavier persistence. Treat this as the local "project database" for v1.
        - The catalog must support at least: `version`, `activeProjectId`, and `projects[]` with `id`, `name`, `root`, and optional `enabled`/`description` fields.
        - The catalog location must be configurable by environment variable, with a local gitignored default and a committed example file. Do not commit machine-specific absolute paths as the default catalog.
        - Relative roots in the catalog must resolve relative to the catalog file location, not `process.cwd()`.
        - Invalid, disabled, missing, or duplicate projects must be reported clearly in the dashboard/API without crashing unrelated valid projects.
    </workspace_catalog_contract>

    <project_folder_contract>
        - Use a Unity-inspired external workspace shape with stable required folders:
          - `<ProjectRoot>/ProjectSettings/project.json` for the project manifest.
          - `<ProjectRoot>/Assets/Scenes/<scene-id>/scene.json` for scene sources.
          - `<ProjectRoot>/Assets/Media/{audio,image,video,glyph}/...` for media assets.
          - `<ProjectRoot>/Assets/Modules/{components,effects}/...` for authored project modules/effects.
          - `<ProjectRoot>/Assets/Fonts/...` for project fonts.
          - `<ProjectRoot>/ProjectSettings/registries/assets.json` for asset registry records.
          - `<ProjectRoot>/ProjectSettings/registries/modules.json` for module registry records.
          - `<ProjectRoot>/Library/` for generated caches and migration scratch data.
          - `<ProjectRoot>/Builds/` for local export output when exporting to disk.
        - Keep the exported bundle shape web-friendly (`assets/`, `modules/`, `fonts/`, `scenes/`) even if the authoring workspace uses `Assets/` and `ProjectSettings/`.
        - Once phase 1 finalizes the folder names, do not rename them casually. Any rename must update the objective files and migration scripts together.
    </project_folder_contract>

    <ownership_model>
        - For v1, Codecaine owns every non-engine asset/module it uses. That includes CRT overlay, main-menu system, menu items, keycap, shield, side menu, project media, and project fonts.
        - Engine-owned built-ins are limited to renderer/editor primitives and code required to interpret scene JSON: object types, positioning, event runtime, registry loader, editor UI, route handlers, and export runtime.
        - General layer types such as video/image/glyph/group are engine primitives, not files in a shared engine module registry.
        - Do not keep a shared `apps/scene-engine/public/modules` dependency for normal Codecaine authoring/export.
    </ownership_model>

    <path_safety>
        - All external project filesystem reads/writes must go through a project path adapter that normalizes paths and prevents escaping the selected project root.
        - API routes that serve project assets must reject traversal, absolute user-supplied child paths, hidden control files unless explicitly allowed, and unknown project ids.
        - URL paths used by the renderer should be logical project URLs resolved by routes or export rewriting, not raw local filesystem paths.
    </path_safety>

    <compatibility_constraints>
        - Preserve legacy embedded loading long enough to migrate current Codecaine data and compare behavior.
        - Existing scene JSON should be migrated deterministically; do not hand-edit large JSON by guessing.
        - Preserve standalone export behavior: no dependency on the Next dev server, relative paths in the bundle, page-mode navigation, and direct static hosting support.
        - Do not run `npm run build` as routine verification; use the running dev server and targeted type/export/browser checks unless production compilation is explicitly in scope.
    </compatibility_constraints>
</constraints>
