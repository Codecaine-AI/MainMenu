<current_state>
<last_updated>2026-05-24</last_updated>

<status>
    - Follow-up objective created for the Main Menu PI/object workspace in the editor left sidebar.
    - No implementation work has started for this objective.
    - The prior Main Menu Electron conversion is treated as completed baseline, not part of this objective's implementation.
</status>

<completed>
    - Created `objectives/main-menu-pi-object-sidebar/`.
    - Defined the intended scope: object selection, new-object creation, and safe project-code update flow from the editor sidebar.
    - Recorded terminology assumption: "pie menu" is treated as PI/object authoring menu unless phase 1 confirms a literal radial pie menu is intended.
</completed>

<in_progress>
    - Ready for implementation planning and baseline inspection.
</in_progress>

<next_actions>
    - Reread this objective bundle and the completed `objectives/main-menu-desktop-app/` report/current state.
    - Inspect current editor sidebar, hierarchy selection, scene store, save flow, and Electron preload/main bridge.
    - Clarify during phase 1 whether the intended "pie menu" is a literal radial menu or a PI/object workspace panel.
    - Design the typed object-workspace contract before adding PI/service code.
</next_actions>

<risks_or_open_questions>
    - The phrase "pie menu" may mean a literal radial UI or a PI agent/object menu; implementation must confirm the UI shape before coding.
    - PI SDK integration may require service credentials/session lifecycle decisions; keep secrets out of renderer code and repo files.
    - Mapping selected scene objects to code-backed component/module files may be incomplete for existing object types.
    - Automated project code changes need diff/preview/error handling to avoid silent destructive edits.
</risks_or_open_questions>

<important_paths>
    - `objectives/main-menu-pi-object-sidebar/goal.md`
    - `objectives/main-menu-pi-object-sidebar/current_state.md`
    - `objectives/main-menu-pi-object-sidebar/context/00_problem.md`
    - `objectives/main-menu-pi-object-sidebar/context/01_constraints.md`
    - `objectives/main-menu-pi-object-sidebar/context/02_implementation_scope.md`
    - `objectives/main-menu-pi-object-sidebar/context/03_working_plan.md`
    - `objectives/main-menu-pi-object-sidebar/context/04_validation_and_handoff.md`
    - `objectives/main-menu-desktop-app/report.md`
    - `objectives/main-menu-desktop-app/current_state.md`
    - `apps/scene-engine/app/editor/`
    - `apps/scene-engine/app/_engine/store/editor-store.ts`
    - `apps/scene-engine/desktop/main/index.ts`
    - `apps/scene-engine/desktop/preload/index.ts`
    - `apps/scene-engine/desktop/types/main-menu.ts`
    - `ai_docs/pi-agent/docs/sdk.md`
</important_paths>
</current_state>
