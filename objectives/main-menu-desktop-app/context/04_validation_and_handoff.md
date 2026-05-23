<validation_and_handoff>
    <validation_ladder>
        - `git status --short`: Record dirty worktree before and after; do not revert unrelated user changes.
        - `curl -fS -I http://localhost:3000/`: Confirm whether the existing dev server is available before desktop dev validation.
        - `cd apps/scene-engine && npm run desktop:dev`: Must open an Electron window titled `Main Menu` and load the editor through the current dev server or documented dev orchestration.
        - `bridge smoke test`: Renderer must successfully call the preload API under `window.mainMenu` and must not require renderer Node integration.
        - `cd apps/scene-engine && npx tsc --noEmit` or narrower equivalent: Type validation must pass for edited TypeScript surfaces unless the report documents a known unrelated blocker.
        - `cd apps/scene-engine && npm run desktop:pack:mac`: Must produce a macOS package artifact using product name `Main Menu`.
        - `packaged app launch`: Must launch without an external Next dev server and load the editor UI.
        - `scene persistence smoke test`: Must save a scene or validate the chosen writable workspace strategy without writing only to read-only packaged resources.
    </validation_ladder>

    <artifact_contract>
        - `objectives/main-menu-desktop-app/artifacts/baseline_inventory.json`: JSON summary of current scripts, package manager, helper app paths, API filesystem surfaces, dev-server health, and dirty worktree.
        - `objectives/main-menu-desktop-app/artifacts/desktop_runtime_strategy.md`: Decision record covering dev strategy, packaged runtime strategy, writable data location, selected packaging tool, rejected alternatives, and remaining risks.
        - `objectives/main-menu-desktop-app/artifacts/mac_package_manifest.txt`: Manifest or summary of generated package output and included runtime resources.
        - `objectives/main-menu-desktop-app/artifacts/screenshots/`: At least one dev Electron screenshot and one packaged app screenshot when packaging succeeds.
        - `objectives/main-menu-desktop-app/artifacts/run_summary.json`: Commands run, exit status, important stdout/stderr summaries, package paths, screenshot paths, and validation verdicts.
        - `objectives/main-menu-desktop-app/report.md`: Final report with changed paths, architecture, validation, and follow-up plan.
    </artifact_contract>

    <acceptance_gates>
        - `Main Menu naming`: Product name, window title, app menu/package metadata, and preload namespace use `Main Menu`/`mainMenu` where user-facing.
        - `desktop development`: Desktop dev command opens the current editor in Electron.
        - `desktop package`: Mac package artifact launches without `http://localhost:3000` already running.
        - `safe bridge`: Renderer uses preload IPC for native capabilities with `contextIsolation` on and `nodeIntegration` off.
        - `editor continuity`: Current project/editor load and selected-layer editing still work in dev; packaged runtime validates editor load and scene save/writable strategy.
        - `helper layout`: Helper app move is completed and validated, or explicitly deferred with a reason and no broken half-move.
    </acceptance_gates>

    <report_contract>
        - `report.md` must summarize baseline, architecture, package/runtime strategy, helper app layout, validation commands, generated artifacts, rejected routes, residual risks, and recommended next objective.
        - The report must explicitly state whether the full PI chat agent is still pending and which process boundary is ready for it.
    </report_contract>

    <current_state_update>
        - Before handoff, update `current_state.md` with completed work, package output path, commands run, helper app status, important paths, risks, and next actions.
        - If blocked, set status to blocked/rejected in plain language and record the narrowest next step.
    </current_state_update>

    <blocked_or_failed_handoff>
        - If packaged runtime fails, preserve Electron/Next logs and state whether the next route should be embedded server fixes, IPC migration, or writable workspace redesign.
        - If mac packaging fails because of signing/notarization, distinguish that from launchable local packaging; notarization is not required for this objective.
    </blocked_or_failed_handoff>
</validation_and_handoff>
