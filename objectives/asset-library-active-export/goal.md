<goal>
    - Implement the Scene Engine asset-library and active-only export restructure.
    - Separate reusable assets from scene/project bindings. Scene objects like `main-menu-background` stay stable while selected assets live in project/scene data, not global registry mutation.
    - Add clear Projects, Asset Library, project page, and editor picker flows.
    - Make export graph-driven: include only active scenes, selected assets, declared module deps, literal public files, and needed fonts.
</goal>

<context_refresh>
    <required_files>
        - objectives/asset-library-active-export/goal.md
        - objectives/asset-library-active-export/current_state.md
        - objectives/asset-library-active-export/context/00_problem.md
        - objectives/asset-library-active-export/context/01_constraints.md
        - objectives/asset-library-active-export/context/02_implementation_scope.md
        - objectives/asset-library-active-export/context/03_working_plan.md
        - objectives/asset-library-active-export/context/04_validation_and_handoff.md
    </required_files>

    <instruction>
        - Reread these files at start/resume and treat this bundle as authority.
    </instruction>
</context_refresh>

<working_strategy>
    - First record baseline export size, active dependency estimate, current UI routes, and dirty worktree risks.
    - Preserve standalone export behavior from `objectives/run-exported-codecaine-build/`: `make run` and no dev-origin dependency.
    - Change the asset/reference model before UI polish; back UI with library records, scene selections, and dependency metadata.
    - Implement export pruning with a deterministic reachability collector and pruned registries.
    - Keep existing project, scene, asset registry, and module registry data backwards compatible until migration is proven.
</working_strategy>

<success_metrics>
    - Dashboard exposes Projects and Asset Library; project pages show scenes, export, and asset usage/availability.
    - Asset Library lists registered/uploaded assets with type, file, label, scope/gating, and usage when available.
    - Editor asset selection updates scene/project bindings, not global asset file paths.
    - Codecaine export excludes unused main-menu background videos and other unreachable registered assets while still rendering `title` and `menu`.
    - Exported zip contains pruned asset/module/font registries plus `Makefile` and `server.mjs`; fresh browser validation has no fatal console errors or failed required requests.
</success_metrics>

<non_goals>
    - Do not redesign Codecaine visuals, menu content, animations, or scene composition except where needed to migrate references.
    - Do not replace the Scene Engine renderer, Next app, or static export runtime wholesale.
    - Do not add cloud storage, auth, payments, remote hosting, or multi-user permissions beyond simple project asset availability.
    - Do not accept copying every asset/module/font or preserving global registry mutation for project-local choices.
    - Do not run `npm run build` for routine scene-engine verification unless production compilation is the specific validation target.
</non_goals>

<completion_criteria>
    - Asset-library model, APIs, dashboard pages, editor selection flow, and export reachability are implemented with Codecaine migration support.
    - Fresh `POST /api/export?project=codecaine` output is active-only, smaller than baseline, and runs through `make run`.
    - Exported `title` and `menu` render/navigate with clean browser console/network summaries saved under artifacts.
    - Docs or objective context record the new asset/reference model, module dependency rules, validation commands, changed paths, and risks.
    - `objectives/asset-library-active-export/current_state.md` is updated with final status, commands run, artifact paths, size comparison, UI validation notes, and any follow-up work.
</completion_criteria>
