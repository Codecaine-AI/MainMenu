<working_plan>
    <phase id="1" name="remove_misread_object_workspace">
        - Remove `PI Object` UI and component scaffold bridge from the editor path.
        - Restore unrelated store/registry changes that only supported the mistaken object workflow.
    </phase>

    <phase id="2" name="chat_ui">
        - Convert the left sidebar into a flex column.
        - Keep hierarchy in the scrollable upper area.
        - Add a bottom `Pi Agent` panel with transcript, textarea, send, stop, and clear controls.
    </phase>

    <phase id="3" name="pi_sdk_bridge">
        - Add typed `window.mainMenu.agent` methods.
        - Lazily create a Pi SDK session in Electron main using the editable workspace as `cwd`.
        - Include current project, scene, selected path, selected name, and selected type in each prompt.
        - Stream agent state back to the renderer over IPC events.
    </phase>

    <phase id="4" name="validation">
        - Run desktop compile and renderer typecheck.
        - Verify the SDK package imports under Electron's runtime.
        - Smoke-test the dev Electron UI and capture a screenshot.
        - Package the mac app and verify it launches with the chat panel.
    </phase>
</working_plan>
