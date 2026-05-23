<constraints>
    <hard_rules>
        - The main app remains `apps/scene-engine`; do not create a separate `apps/desktop` as the primary product unless this objective records a blocking reason.
        - Use user-facing product name `Main Menu` for app menus, window title, package product name, and mac bundle display.
        - Keep Electron native code outside Next `app/`; use a dedicated `desktop/` or equivalently clear native-process folder under `apps/scene-engine`.
        - Renderer code must run with `contextIsolation: true` and `nodeIntegration: false`.
        - The renderer may access local capabilities only through a typed preload bridge. Prefer a `window.mainMenu` namespace over `window.melee`.
        - macOS is the only required packaging target for this objective.
        - Follow the repo instruction to avoid `npm run build` for routine scene edits; packaging validation is the exception because it must prove the desktop bundle works.
    </hard_rules>

    <forbidden_shortcuts>
        - `Browser wrapper only`: Opening `http://localhost:3000` in Electron is acceptable for development mode but not sufficient for packaged completion.
        - `Renderer filesystem access`: Direct `fs`, PI SDK, shell, or terminal access in React components is invalid because the renderer must stay a UI.
        - `Static export assumption`: Treating the current app as static-only is invalid because scene APIs and local project writes are part of the current editor.
        - `Cosmetic rename only`: Changing visible labels to `Main Menu` without fixing package/window/menu/preload naming is incomplete.
        - `Blind helper move`: Moving `apps/pi-asset-loop` or `apps/asset-extraction-pipeline` without updating scripts/docs and validating entrypoints is invalid.
    </forbidden_shortcuts>

    <data_and_feature_boundaries>
        - Deployable runtime data must live in a writable workspace, user data directory, or user-selected project root, not only inside packaged app resources.
        - Bundled Codecaine sample data may be copied or seeded, but scene saves must not silently mutate read-only packaged templates.
        - PI SDK integration is allowed as a service scaffold if it helps the process boundary, but full chat UX and autonomous scene editing belong to a follow-up objective.
        - Helper apps can remain executable workflows after moving under `apps/helpers`; they do not need to be fully integrated into the desktop UI during this objective.
    </data_and_feature_boundaries>

    <risk_budget>
        - `desktop_launch`: Development and packaged launch must both work, or the objective cannot complete.
        - `scene_persistence`: At least one validated save path must exist in desktop runtime. If packaged persistence is blocked by workspace design, stop and document the smallest safe data-location fix.
        - `security_posture`: No known direct Node exposure in renderer is acceptable.
        - `scope_creep`: Do not exceed the objective by implementing the full PI chat panel. Add a stub/service boundary only.
    </risk_budget>

    <promotion_or_completion_gates>
        - `dev_gate`: Running the chosen desktop dev command opens an Electron window titled `Main Menu` and loads the current editor.
        - `package_gate`: Running the chosen mac package command produces a launchable `.app`, `.dmg`, or documented mac package artifact under an objective artifact path or build output path.
        - `runtime_gate`: The packaged app launches without an external Next dev server and can load the editor UI.
        - `bridge_gate`: Renderer can call a typed `window.mainMenu` preload API and no React component imports Electron main-process modules directly.
        - `handoff_gate`: `current_state.md`, `report.md`, and objective artifacts record commands, paths, packaging outputs, screenshots, and residual risks.
    </promotion_or_completion_gates>
</constraints>
