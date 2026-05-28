<constraints>
    <hard_rules>
        - Keep the chat panel in the editor left sidebar, pinned below the hierarchy.
        - Preserve hierarchy selection, drag/drop, add-layer, scene save, canvas, and inspector behavior.
        - Maintain Electron security defaults: `contextIsolation: true`, `nodeIntegration: false`.
        - Renderer code may call only typed preload APIs under `window.mainMenu.agent`.
        - Pi SDK session creation, prompt execution, tool access, and file/project edits belong in Electron main.
        - Do not expose credentials, API keys, auth files, or SDK internals to React/browser globals.
    </hard_rules>

    <runtime_rules>
        - The current app uses Electron 30, whose embedded Node runtime is Node 20.16.0 in validation.
        - `@earendil-works/pi-coding-agent@0.75.5` currently declares Node `>=22.19.0`, so it is not compatible with this Electron baseline.
        - Use `@mariozechner/pi-coding-agent@0.73.1` for this pass because it is the Pi SDK package scope used by the checked-in examples and loads under Electron Node 20.
    </runtime_rules>

    <design_rules>
        - This is a work tool panel, not a marketing surface.
        - Keep the chat compact, classical, and consistent with the current dark editor.
        - Do not use a radial pie menu or object creation form in this correction.
    </design_rules>
</constraints>
