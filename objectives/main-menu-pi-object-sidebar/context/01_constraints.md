<constraints>
    <hard_rules>
        - Keep `apps/scene-engine` as the main app and preserve the existing Next editor.
        - Build the new surface in the editor left sidebar/hierarchy area; do not replace the canvas or inspector layout wholesale.
        - Maintain Electron security defaults: `contextIsolation: true`, `nodeIntegration: false`.
        - Renderer code may call only typed preload APIs under `window.mainMenu` or validated HTTP/API routes. No direct renderer `fs`, shell, Electron main-process import, or PI SDK use.
        - Native process/session/file mutation authority belongs in Electron main, a desktop-owned service module, or server-side route with validated inputs.
        - Every object-workspace action must carry enough context to identify project id, scene id, object path or insertion target, and intended operation.
        - Do not silently write code/project changes. The UI must show at least status plus a result summary; higher-risk code changes need a diff or before/after artifact.
        - Main Menu naming and `window.mainMenu` bridge naming remain the user-facing/default desktop naming.
    </hard_rules>

    <data_and_contract_rules>
        - Existing `selectedPath` in `editor-store.ts` is the source of truth for selected scene object unless implementation explicitly replaces it with an equivalent store contract.
        - Object creation must use existing scene types/schema patterns where possible and must round-trip through scene save/load.
        - Code-backed object updates must identify touched files and whether the change came from a deterministic local scaffold, PI SDK session, or another service path.
        - File writes in packaged runtime must target the writable Main Menu workspace, not read-only app resources.
        - Secrets, API keys, session credentials, and model configuration must not be committed and must not be exposed to React/browser globals.
    </data_and_contract_rules>

    <design_rules>
        - This is an authoring tool surface, not a marketing page. Keep it dense, scannable, and consistent with the current editor.
        - The workspace must not break hierarchy selection, drag/drop, layer locking, add-layer dialog behavior, canvas selection overlays, or inspector editing.
        - Avoid putting a card inside another card. The left sidebar can use compact sections, rows, segmented controls, icon buttons, and status rows.
        - If a literal radial/pie menu is required, it must have a keyboard/mouse-accessible fallback and must not obscure the hierarchy or inspector state incoherently.
    </design_rules>

    <risk_budget>
        - `bridge_contract`: A minimal typed API is required before PI/service integration expands.
        - `scene_integrity`: New objects must be valid, selectable, editable, saved, and reloadable.
        - `code_integrity`: Code/project mutations require clear touched-file evidence and a rollback or manual review path.
        - `desktop_validation`: Development and packaged Main Menu runtime must both be validated for the core flow.
    </risk_budget>

    <non_negotiable_rejections>
        - Reject any implementation that only mocks the sidebar without wiring real selection/create behavior.
        - Reject any implementation that requires users to manually run an external PI/helper process for the validated flow unless explicitly documented as a temporary blocked state.
        - Reject a packaged validation that only works because `localhost:3000` is already running outside the app.
    </non_negotiable_rejections>
</constraints>
