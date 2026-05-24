<working_plan>
    <overview>
        1. baseline_and_disambiguation - Confirm "pie menu" vs PI/object workspace, inventory editor/store/bridge surfaces, and record current behavior.
        2. object_workspace_contract - Define typed active-object, create-object, and code-update contracts before implementation.
        3. sidebar_ui_and_selection - Add the left-sidebar workspace and bind it to existing hierarchy selection.
        4. create_object_flow - Implement object creation, persistence, and reload/select validation.
        5. code_update_service_flow - Add the desktop-owned service path for project code/file updates and validate a concrete update.
        6. desktop_packaged_validation_and_handoff - Validate dev/package runtime and write artifacts/report.
    </overview>

    <phase id="1" name="baseline_and_disambiguation">
        <objective>
            - Establish the exact UI intent and current technical baseline before coding.
        </objective>
        <inputs>
            - User phrase: "pie menu in the left sidebar of the editor"
            - Completed Main Menu Electron objective report/state
            - Editor hierarchy/store/save files
            - PI SDK docs and helper app references
        </inputs>
        <process>
            - Inspect current worktree with `git status --short`; record unrelated dirty paths.
            - Verify whether "pie menu" means a PI/object workspace or a literal radial pie control. If uncertain after source review, preserve both in design notes and implement the safest explicit sidebar panel first.
            - Inventory selection state, hierarchy row metadata, add-layer dialog, scene save route, and preload bridge.
            - Identify object-to-code mappings available today: component ids, module registry entries, asset references, scene object paths, and project files.
        </process>
        <outputs>
            - `artifacts/baseline_inventory.json`
            - Updated `current_state.md`
        </outputs>
        <gate>
            - A future implementer can name the selected UI shape, active-object data model, and first code-update target type.
        </gate>
    </phase>

    <phase id="2" name="object_workspace_contract">
        <objective>
            - Define the typed contract before adding UI/service code.
        </objective>
        <process>
            - Define `ActiveObjectContext`: project id, scene id, object path, object id/name/type, parent/insertion info, component/module references when known.
            - Define `CreateObjectRequest` and `CreateObjectResult`.
            - Define `ApplyObjectCodeUpdateRequest` and `ApplyObjectCodeUpdateResult`, including touched files, diff/summary, errors, and refresh instructions.
            - Decide which operations belong in `window.mainMenu` IPC vs existing Next API routes.
        </process>
        <outputs>
            - `artifacts/object_workspace_contract.md`
            - Typed definitions in app/desktop source as needed.
        </outputs>
        <gate>
            - Contract covers selection, new object creation, and at least one code-backed update path without renderer native access.
        </gate>
    </phase>

    <phase id="3" name="sidebar_ui_and_selection">
        <objective>
            - Add the left-sidebar workspace and bind it to existing editor selection.
        </objective>
        <process>
            - Extend the current hierarchy sidebar with a compact PI/object workspace section.
            - Show active object state from `selectedPath` and scene data.
            - Provide controls for selecting current object context and choosing insertion target for new object creation.
            - Preserve existing hierarchy row click/drag/lock/add behavior.
        </process>
        <outputs>
            - Sidebar/workspace component(s)
            - Selection smoke evidence
            - Dev screenshot
        </outputs>
        <gate>
            - Clicking hierarchy objects updates both existing selection and workspace active-object display.
        </gate>
    </phase>

    <phase id="4" name="create_object_flow">
        <objective>
            - Implement and validate creating a new scene object from the workspace.
        </objective>
        <process>
            - Start with a deterministic local create flow before expanding to PI generation.
            - Create valid scene objects from existing schema/component patterns.
            - Insert at selected target, mark dirty, save scene, reload scene, and reselect the new object.
            - Add focused tests or Playwright smoke coverage for creation and persistence.
        </process>
        <outputs>
            - Valid scene object creation flow
            - Before/after scene evidence
        </outputs>
        <gate>
            - New object appears in hierarchy/canvas as applicable, survives save/reload, and remains editable.
        </gate>
    </phase>

    <phase id="5" name="code_update_service_flow">
        <objective>
            - Add the project-code update path owned by desktop/server services.
        </objective>
        <process>
            - Choose the smallest meaningful code-backed target, such as a component module/scaffold tied to a new object.
            - Implement service handler with validation, touched-file reporting, and result summary.
            - If using PI SDK, keep session credentials/config in native/service scope and stream only safe status/results to renderer.
            - If PI SDK cannot be safely validated in this pass, implement a service scaffold that applies one concrete deterministic code/project file update and records PI as follow-up.
        </process>
        <outputs>
            - Service/IPC/API implementation
            - `artifacts/code_update_evidence.md`
        </outputs>
        <gate>
            - A concrete code/project file update is applied through the service path and reflected in the editor/project runtime.
        </gate>
    </phase>

    <phase id="6" name="desktop_packaged_validation_and_handoff">
        <objective>
            - Validate development and packaged Main Menu runtime, then document the result.
        </objective>
        <process>
            - Run typechecks and desktop compile.
            - Validate `npm run desktop:dev` with screenshots and bridge/security checks.
            - Run `npm run desktop:pack:mac` and validate packaged object selection, object creation, save/reload, and code-update service path.
            - Write final report and update `current_state.md`.
        </process>
        <outputs>
            - Screenshots, `run_summary.json`, final `report.md`, updated `current_state.md`
        </outputs>
        <gate>
            - All `goal.md` completion criteria are proven by current evidence.
        </gate>
    </phase>
</working_plan>
