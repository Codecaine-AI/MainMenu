<goal>
    - Add a left-sidebar **PI/object workspace** to the Main Menu editor in `apps/scene-engine`.
    - Let the user select the scene object/layer they are working on, inspect active-object context, and create a new object in the current project/scene.
    - Route object creation and code-backed edits through safe typed desktop/service boundaries, not direct renderer filesystem access.
    - Build on the completed Electron app; do not redo desktop conversion except for targeted validation/fixes.
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

    <instruction>
        - At objective start and after compaction/resume, reread the required
          files and treat this bundle as the authority for this objective.
    </instruction>
</context_refresh>

<working_strategy>
    - Preserve the current editor/store and extend the hierarchy sidebar rather than replacing it.
    - Keep selected object context concrete: project id, scene id, object path, object type/name, and component/module file when known.
    - Keep native/project-writing authority in Electron main or validated server routes; renderer sends typed requests and displays status/diffs/results.
    - Integrate PI/service behavior only for object-focused create/update flows; avoid a general chat terminal.
    - Treat "pie menu" as PI/object workspace unless phase 1 confirms a literal radial menu is intended.
</working_strategy>

<success_metrics>
    - A left-sidebar workspace binds to the selected hierarchy object and shows stable active-object context.
    - The workspace creates a new object under a selected parent/top-level target and persists it.
    - A code-backed object/component update can be applied through the desktop-owned service path with visible result/diff evidence.
    - Renderer uses `window.mainMenu` or validated APIs only; no direct Node/Electron/PI SDK access is introduced.
    - Dev and packaged Main Menu validation both pass.
</success_metrics>

<non_goals>
    - Do not redo Electron conversion, app naming, packaging baseline, or writable-workspace strategy except for targeted fixes.
    - Do not build a general PI chat app, terminal emulator, release system, cloud sync, auth, or multi-project collaboration.
    - Do not give React direct `fs`, shell, Electron main, or PI SDK access.
    - Do not silently mutate project code without a visible request/result trail.
    - Do not move helper apps unless the move is separately validated.
</non_goals>

<completion_criteria>
    - Left-sidebar workspace appears without breaking hierarchy selection, inspector editing, canvas interaction, or scene saving.
    - Existing-object selection syncs editor selection and workspace context.
    - New-object creation writes valid scene/project data and the object is selectable/editable after save/reload.
    - A code-backed update path is validated: PI-driven or documented service scaffold applying a concrete project file/code change safely.
    - Desktop security remains intact: context isolation on, renderer Node integration off, typed preload/API boundary.
    - Artifacts include command summaries, screenshots, service/API contract notes, before/after scene/code evidence, package/runtime notes, final report, and updated `current_state.md`.
</completion_criteria>
