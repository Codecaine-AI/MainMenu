<validation_and_handoff>
    <validation_ladder>
        - `git status --short`: Record dirty worktree before and after; do not revert unrelated user changes.
        - `cd apps/scene-engine && npm run desktop:compile`: Electron/preload type validation.
        - `cd apps/scene-engine && npx tsc --noEmit`: Renderer/app type validation.
        - `cd apps/scene-engine && npm run desktop:dev`: Validate left-sidebar workspace in Electron development.
        - `selection smoke`: Click hierarchy objects and confirm active workspace context updates with project id, scene id, object path, and object label/type.
        - `create-object smoke`: Create a new object from the workspace, save, reload, and confirm it is selectable/editable.
        - `code-update smoke`: Apply one concrete project code/file update through the desktop-owned service path and record touched files plus result summary.
        - `security smoke`: Confirm renderer Node access remains unavailable and Electron imports remain outside React UI.
        - `cd apps/scene-engine && npm run desktop:pack:mac`: Produce a fresh mac app when feature behavior is ready.
        - `packaged smoke`: Launch packaged Main Menu and repeat selection, create-object, save/reload, and code-update validation without relying on external `localhost:3000`.
    </validation_ladder>

    <artifact_contract>
        - `objectives/main-menu-pi-object-sidebar/artifacts/baseline_inventory.json`
        - `objectives/main-menu-pi-object-sidebar/artifacts/object_workspace_contract.md`
        - `objectives/main-menu-pi-object-sidebar/artifacts/code_update_evidence.md`
        - `objectives/main-menu-pi-object-sidebar/artifacts/screenshots/desktop_dev_object_workspace.png`
        - `objectives/main-menu-pi-object-sidebar/artifacts/screenshots/mac_packaged_object_workspace.png`
        - `objectives/main-menu-pi-object-sidebar/artifacts/run_summary.json`
        - `objectives/main-menu-pi-object-sidebar/report.md`
    </artifact_contract>

    <acceptance_gates>
        - `UI gate`: The left-sidebar workspace is visible, compact, and does not break existing hierarchy/editor behavior.
        - `selection gate`: Workspace active context stays synchronized with selected scene object.
        - `creation gate`: New object creation writes valid scene data and survives save/reload.
        - `code update gate`: At least one code/project file update is applied through the service path with touched-file evidence.
        - `security gate`: No renderer native power is introduced; bridge/API contracts remain typed and narrow.
        - `runtime gate`: Feature works in development and packaged Main Menu.
    </acceptance_gates>

    <report_contract>
        - Final report must summarize UI behavior, object context contract, service/IPC/API contract, code-update strategy, validation commands, screenshots, package status, rejected routes, residual risks, and recommended next objective.
        - Report must state whether PI SDK was actually used or whether a deterministic service scaffold was implemented with PI integration deferred.
    </report_contract>

    <current_state_update>
        - Before handoff, update `current_state.md` with completed work, commands run, screenshots/artifacts, changed paths, validation status, risks, and next actions.
    </current_state_update>
</validation_and_handoff>
