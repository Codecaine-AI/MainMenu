<problem>
    <objective_question>
        - How should Scene Engine model shared assets, project-local scene choices, and export dependencies so projects can reuse a global asset library while exported bundles include only what the selected project actively uses?
    </objective_question>

    <current_baseline>
        - Dashboard root in `apps/scene-engine/app/page.tsx` lists projects and links to a standalone upload page. There is no first-class Asset Library page.
        - `apps/scene-engine/app/upload/page.tsx` uploads a file and type, then writes a new registry entry through `/api/upload`.
        - `apps/scene-engine/app/editor/_components/AssetSwapDropdown.tsx` lists files by type and PATCHes `/api/registry/[id]`, changing the global registry entry's `file`.
        - Codecaine menu background currently uses `asset: "main-menu-bg-purple"` on the `main-menu-background` object in `apps/scene-engine/projects/codecaine/scenes/menu/scene.json`.
        - `apps/scene-engine/app/api/export/route.ts` writes full registries and copies every registered asset, every module directory, and all fonts into the exported zip.
        - Quick 2026-05-21 baseline estimate: all registered asset files are about `112.0 MB`; actively referenced Codecaine asset/literal files are about `35.4 MB`; unused main-menu background videos account for about `64 MB` by themselves.
    </current_baseline>

    <why_current_state_is_insufficient>
        - The asset registry acts as both a shared library and the mutable selection target for a scene object. This makes project-local artistic choices leak globally.
        - Users expect the main menu background layer to remain the same scene view while choosing a video asset from a library. Current swap behavior mutates the library record instead.
        - Export size scales with the whole app-level asset/module/font library, not the project's active dependency graph.
        - Module dependencies are partly hidden inside component JS. For example, `main-menu-system` dynamically loads submodules and CSS without declaring them in its manifest, so an active-only export cannot be complete by looking only at scene JSON and top-level module registry entries.
        - Dashboard navigation does not communicate the distinction between Projects, Asset Library, upload/import, and project usage.
    </why_current_state_is_insufficient>

    <failure_modes>
        - `global_swap_leak`: changing one project's background changes the shared registry entry and can affect other scenes/projects that reference the same id.
        - `bloated_export`: exported zip includes inactive videos, unused assets, unused modules, and potentially unused fonts.
        - `missing_dynamic_dependency`: a pruned export omits files loaded by component internals because those dependencies are not manifest-declared.
        - `ui_model_mismatch`: dashboard/editor pages look cleaner but still expose file-level registry mutation instead of scene-local asset selection.
        - `migration_breakage`: existing scenes using `asset` ids fail if the new model drops legacy support too aggressively.
    </failure_modes>

    <prior_evidence>
        - `objectives/run-exported-codecaine-build/`: prior objective proved the exported Codecaine zip can be made standalone and run with static HTTP.
        - `apps/scene-engine/app/editor/_components/AssetSwapDropdown.tsx`: current swap path PATCHes the global registry id supplied by the active object.
        - `apps/scene-engine/app/api/export/route.ts`: current export copies all registry entries and all fonts/modules.
        - `apps/scene-engine/public/assets/registry.json`: current registry has five main-menu background videos even though Codecaine menu actively selects one.
        - `apps/scene-engine/public/modules/components/main-menu-system/main-menu-system.js`: current component imports submodules and CSS via hardcoded paths.
    </prior_evidence>

    <expected_value>
        - The Scene Engine becomes easier to reason about: projects own scenes and selections, the Asset Library owns reusable files, and export owns a precise dependency graph.
        - Codecaine export size drops materially while exported runtime behavior remains correct.
        - The dashboard gives users obvious places to manage Projects and Assets without needing to understand registry internals.
    </expected_value>
</problem>
