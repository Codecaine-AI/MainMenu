<current_state>
<last_updated>2026-05-23</last_updated>

<status>
    - Objective definition created for converting `apps/scene-engine` into the macOS Electron desktop app named `Main Menu`.
    - No implementation work has started yet.
    - The objective intentionally scopes the full PI chat agent sidebar as follow-up; this objective prepares the desktop process boundary and package.
</status>

<completed>
    - Created `objectives/main-menu-desktop-app/`.
    - Wrote the objective goal and context files with phase-gated implementation, validation, and handoff requirements.
    - Established naming decision: user-facing app name is `Main Menu`; preload namespace should prefer `window.mainMenu`.
    - Established layout decision: `apps/scene-engine` remains the main app; Electron-native code should live under a clear `desktop/` boundary inside that app; helper workflows should move toward `apps/helpers/*` only with validation.
</completed>

<in_progress>
    - Ready for implementation kickoff.
</in_progress>

<next_actions>
    - Reread `goal.md` and all `context/*.md` files.
    - Run phase 1 baseline inventory: `git status --short`, package/script inspection, helper path inventory, and dev-server health check.
    - Decide package tooling and packaged runtime route after documenting current filesystem-backed API constraints.
</next_actions>

<risks_or_open_questions>
    - Current scene API routes read/write local files; packaged runtime must choose an embedded server or IPC migration plus a writable workspace strategy.
    - Helper app relocation may cause avoidable churn; move helpers only if entrypoints and docs can be updated cleanly.
    - mac package signing/notarization is not required, but local launchability is required.
</risks_or_open_questions>

<important_paths>
    - `objectives/main-menu-desktop-app/goal.md`
    - `objectives/main-menu-desktop-app/current_state.md`
    - `objectives/main-menu-desktop-app/context/00_problem.md`
    - `objectives/main-menu-desktop-app/context/01_constraints.md`
    - `objectives/main-menu-desktop-app/context/02_implementation_scope.md`
    - `objectives/main-menu-desktop-app/context/03_working_plan.md`
    - `objectives/main-menu-desktop-app/context/04_validation_and_handoff.md`
    - `objectives/main-menu-desktop-app/artifacts/`
    - `apps/scene-engine/`
    - `apps/pi-asset-loop/`
    - `apps/asset-extraction-pipeline/`
</important_paths>
</current_state>
