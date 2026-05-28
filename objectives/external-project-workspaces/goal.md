<goal>
    - Rewrite Scene Engine project discovery and file access so projects load from a file-backed workspace catalog, not embedded `apps/scene-engine/projects` plus app-level `public/` assets.
    - Implement a Unity-inspired external project layout where Codecaine owns scenes, media, fonts, registries, and authored modules/effects inside its own project folder/repo.
    - Migrate current Codecaine data while preserving preview, edit/save, upload/selection, and standalone export behavior.
    - For v1, engine built-ins are renderer/editor primitives only. Do not keep CRT, main-menu modules, project components, or media in a shared engine asset/module library.
</goal>

<context_refresh>
    - Reread this `goal.md`, `current_state.md`, and `context/*.md` at objective start and after resume. Treat this bundle as authority.
</context_refresh>

<working_strategy>
    - Formalize the catalog schema and project folder contract first, then route APIs, editor flows, renderer dev loading, and export through one project path adapter.
    - Keep legacy embedded loading only as a migration fallback until external Codecaine is proven.
    - Move Codecaine scenes, registries, media, fonts, modules, effects, and settings into the Codecaine workspace.
    - Preserve the static export contract: no Next runtime, relative bundle paths, page navigation, `Makefile`, and `server.mjs`.
    - Save migration inventories and validation artifacts so Codecaine can later become its own repo without guessing.
</working_strategy>

<success_metrics>
    - The dashboard loads projects from a workspace catalog listing one or more project roots.
    - Codecaine opens, previews, edits, saves, uploads, selects assets, and exports from an external root outside `apps/scene-engine/`.
    - Active Codecaine assets/modules/fonts come from the Codecaine workspace, not `apps/scene-engine/public`.
    - Scene, asset, upload, font, asset-library, and export code all use the same project path abstraction.
    - The final export renders title/menu, navigates correctly, and has no required requests to the dev server or engine-local project/public folders.
</success_metrics>

<non_goals>
    - Do not build a remote DB, cloud project service, auth, marketplace, or multi-user collaboration layer.
    - Do not introduce a shared engine asset/module library in v1; future built-ins can be designed after project-local ownership is stable.
    - Do not redesign Codecaine visuals, menu behavior, animation timing, or scene composition except where path/schema migration requires it.
    - Do not replace the plain-JS renderer, Next editor shell, or static export runtime.
    - Do not run `npm run build` for routine verification unless explicitly validating production compilation.
</non_goals>

<completion_criteria>
    - Catalog schema, project folder contract, path adapter, migration code, editor/API updates, and export updates are implemented.
    - Codecaine has a validated project-local workspace and no longer depends on engine-local `projects/` or `public/` content for normal authoring/export.
    - Legacy embedded loading is either a documented fallback or removed with a migration note.
    - Type checks and browser/export validation pass, with artifacts saved under `objectives/external-project-workspaces/artifacts/`.
    - Docs and `current_state.md` record final layout, commands, artifacts, unresolved risks, and handoff notes.
</completion_criteria>
