<goal>
    - Convert `apps/scene-engine` into the macOS Electron desktop authoring app named **Main Menu**, wrapping the existing Next editor instead of rewriting it.
    - Keep `apps/scene-engine` as the main app; move helper workflows toward `apps/helpers/*` only when paths/scripts can be validated cleanly.
    - Use `Main Menu` for user-facing product/bundle/window/menu naming and prefer `window.mainMenu` for the preload bridge.
    - Own the Electron main/preload layer, dev launch flow, packaged runtime strategy, mac-only packaging, and minimal typed IPC bridge.
</goal>

<context_refresh>
    <required_files>
        - objectives/main-menu-desktop-app/goal.md
        - objectives/main-menu-desktop-app/current_state.md
        - objectives/main-menu-desktop-app/context/00_problem.md
        - objectives/main-menu-desktop-app/context/01_constraints.md
        - objectives/main-menu-desktop-app/context/02_implementation_scope.md
        - objectives/main-menu-desktop-app/context/03_working_plan.md
        - objectives/main-menu-desktop-app/context/04_validation_and_handoff.md
    </required_files>

    <instruction>
        - At objective start and after compaction/resume, reread the required
          files and treat this bundle as the authority for this objective.
    </instruction>
</context_refresh>

<working_strategy>
    - Preserve the current Next editor as the renderer; add a `desktop/` boundary for Electron main/preload code.
    - Treat packaging and writable scene/project data as one design problem: the mac app must not depend on an already-running `localhost:3000` or write only inside read-only app resources.
    - Prepare for later PI-agent integration, but do not build the full chat sidebar in this objective.
    - Bundle only for macOS; defer Windows/Linux, notarization, auto-update, and release publishing.
</working_strategy>

<success_metrics>
    - A desktop dev command opens the current editor in an Electron window titled `Main Menu`.
    - A mac package artifact launches without an external dev server and loads the editor UI.
    - Renderer code uses a safe typed preload bridge such as `window.mainMenu`; no direct Node integration is required.
    - Scene/project loading and saving work in desktop runtime, or a validated writable-workspace migration is documented.
    - Helper app placement is completed or explicitly deferred with no broken half-move.
</success_metrics>

<non_goals>
    - Do not build the full PI chat agent sidebar, terminal UI, or autonomous scene-editing workflow.
    - Do not rewrite the editor, canvas renderer, asset library, export runtime, or component modules except where packaging requires it.
    - Do not rename the repo folder or erase internal historical `MELEE` references that are not product branding.
    - Do not add Windows/Linux packages, notarization, auto-update, cloud sync, auth, or distribution.
    - Do not accept a packaged app that only works because the Next dev server is already running outside the bundle.
</non_goals>

<completion_criteria>
    - Main Menu launches in development and from a fresh macOS package artifact.
    - Electron uses safe defaults: context isolation on, renderer Node integration off, typed preload bridge, and native work owned by main process.
    - Load project, open editor, select layers, and save scene are validated for the milestone runtime.
    - Artifacts include command summaries, screenshots, package path/manifest, runtime-strategy notes, helper-layout decision, and final report.
    - `current_state.md` is updated with final status, validation commands, artifacts, decisions, risks, and next actions.
</completion_criteria>
