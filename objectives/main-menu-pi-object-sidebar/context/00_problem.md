<problem>
    <objective_question>
        - How should Main Menu expose a left-sidebar object workspace that lets the user choose the scene object they are working on, create a new one, and route code/project updates safely through the desktop app?
        - What typed contract connects editor selection, scene object metadata, PI/service requests, and resulting file/scene changes without turning React into a local backend?
    </objective_question>

    <current_baseline>
        - `objectives/main-menu-desktop-app/report.md` records the completed Electron conversion: `apps/scene-engine` is the Main Menu mac app, with Electron main/preload under `apps/scene-engine/desktop/`.
        - `apps/scene-engine/app/editor/page.tsx` renders the current editor shell with hierarchy, canvas, and inspector.
        - `apps/scene-engine/app/editor/_components/HierarchyPanel.tsx` and `HierarchyRow.tsx` already own layer selection and hierarchy interaction.
        - `apps/scene-engine/app/_engine/store/editor-store.ts` stores `selectedPath`, scene mutation actions, add/move/remove object actions, and dirty state.
        - `apps/scene-engine/app/editor/_components/SceneSection.tsx` saves scene JSON through the current scene API route.
        - `apps/scene-engine/desktop/preload/index.ts` currently exposes a minimal typed `window.mainMenu.app.getInfo()` bridge.
        - `ai_docs/pi-agent/docs/sdk.md` and `apps/pi-asset-loop/src/agent/orchestrator.ts` are references for PI SDK/session behavior, not yet integrated into Main Menu.
    </current_baseline>

    <why_current_state_is_insufficient>
        - The editor can select and edit objects manually, but there is no object-aware PI/action surface that turns the selected layer into an authoring target.
        - Creating a new object still requires existing editor controls and manual schema knowledge; there is no guided create flow that can also update component/project code.
        - The current preload bridge only exposes app info. It does not yet define safe typed operations for object context, code-backed creation, or applying generated changes.
        - A PI-driven workflow needs an auditable boundary: requested change, selected object context, produced file/scene patch, apply result, and refresh behavior.
    </why_current_state_is_insufficient>

    <terminology_assumption>
        - The user said "pie menu"; given the preceding conversation, this objective treats that as a PI/object authoring menu in the left sidebar.
        - If implementation discovery shows the user meant a literal circular/radial pie menu, resolve that UI requirement in phase 1 before coding the component.
    </terminology_assumption>

    <failure_modes>
        - `unsafe_renderer_backend`: React imports `fs`, shell, Electron main modules, or PI SDK directly.
        - `selection_desync`: The workspace says one object is active while the hierarchy/store/canvas selection points elsewhere.
        - `silent_code_mutation`: The agent/service changes project files without a visible request/result trail or before/after evidence.
        - `invalid_scene_object`: New-object creation writes malformed scene JSON or creates an object that cannot be selected, edited, saved, or rendered.
        - `desktop_only_regression`: The feature works in browser dev but fails in Electron because IPC/runtime paths are not validated.
        - `scope_sprawl`: The objective expands into a full chat app, terminal, release system, or broad autonomous workflow instead of object-focused authoring.
    </failure_modes>

    <expected_value>
        - Main Menu gains its first object-aware desktop authoring workflow: a user can select or create a scene object from the left sidebar and have safe service-backed code/project changes applied with evidence.
        - The resulting contract becomes the foundation for richer PI workflows later without compromising renderer security or existing editor ergonomics.
    </expected_value>
</problem>
