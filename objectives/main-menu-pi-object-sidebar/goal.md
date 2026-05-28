<goal>
    - Correct the previous misunderstanding: this objective is a classical **Pi agent chat panel**, not a "Pi object" workspace.
    - Add a compact chat panel pinned to the bottom of the editor left sidebar in `apps/scene-engine`.
    - Use the Pi agent SDK from Electron main so chat requests can edit the current Main Menu project through agent tools.
    - Keep React/browser code on a typed `window.mainMenu.agent` bridge; no renderer filesystem, shell, Electron main, or Pi SDK access.
</goal>

<context_refresh>
    <required_files>
        - objectives/main-menu-pi-object-sidebar/goal.md
        - objectives/main-menu-pi-object-sidebar/current_state.md
        - objectives/main-menu-pi-object-sidebar/context/00_problem.md
        - objectives/main-menu-pi-object-sidebar/context/01_constraints.md
        - objectives/main-menu-pi-object-sidebar/context/02_implementation_scope.md
        - objectives/main-menu-pi-object-sidebar/context/03_working_plan.md
        - objectives/main-menu-pi-object-sidebar/context/04_validation_and_handoff.md
    </required_files>
</context_refresh>

<working_strategy>
    - Replace the old object-workspace UI with a normal chat transcript/input docked at the bottom of the hierarchy sidebar.
    - Preserve the hierarchy as the upper scrollable area and keep selection, drag/drop, add-layer, save, canvas, and inspector behavior intact.
    - Pass current project, scene, and selected layer context with each chat request.
    - Run Pi SDK sessions in Electron main with `cwd` set to the editable Main Menu workspace; stream status/messages back through preload IPC.
    - Use the Pi SDK package version compatible with the current Electron Node runtime.
</working_strategy>

<success_metrics>
    - The left sidebar shows `Pi Agent` at the bottom with a transcript, message input, send, stop, and clear controls.
    - The old `PI Object` panel and component scaffold bridge are absent.
    - `window.mainMenu.agent` exposes typed `getState`, `sendMessage`, `abort`, `reset`, and event subscription methods.
    - Electron main imports and owns the Pi SDK session; renderer Node access remains unavailable.
    - Dev and packaged validation pass.
</success_metrics>

<non_goals>
    - Do not build an object creation/scaffold menu for this objective.
    - Do not give React direct native access or Pi SDK access.
    - Do not redo the Electron conversion or packaging baseline except for targeted validation.
    - Do not implement a literal radial pie menu.
</non_goals>

<completion_criteria>
    - Chat panel is visually pinned to the bottom of the left sidebar and does not obscure or replace the hierarchy.
    - Chat requests include current project/scene/selection context.
    - Main-process Pi SDK integration compiles and can be loaded under Electron's runtime.
    - Renderer security remains intact: context isolation on, renderer Node integration off, typed preload bridge only.
    - Objective docs/artifacts are corrected so they no longer describe the misunderstood PI Object workflow.
</completion_criteria>
