<working_plan>
    <overview>
        1. baseline_and_inventory - Record current app scripts, runtime assumptions, helper app paths, dirty worktree, and dev-server health.
        2. desktop_layout_and_dependencies - Add the desktop process layout, choose packaging tools, and preserve the monorepo/helper structure.
        3. electron_dev_shell - Launch the existing Next editor inside an Electron window named Main Menu with a safe preload bridge.
        4. packaged_runtime_and_mac_bundle - Make a packaged mac artifact launch without an external dev server and handle writable scene/project data deliberately.
        5. validation_and_handoff - Validate dev and packaged flows, write artifacts/report, and update objective state.
    </overview>

    <operating_principles>
        - Preserve the current editor as the renderer. Add native desktop capability around it rather than rewriting it.
        - Prefer explicit process boundaries: Electron main owns native power, preload exposes a narrow bridge, React renders UI.
        - Treat packaging and writable data together. A mac app that launches but cannot safely save scene files is not a complete desktop authoring tool.
        - Keep the helper app move mechanical and validated. If moving helpers threatens the packaging milestone, defer the move with a clear state note.
    </operating_principles>

    <phase id="1" name="baseline_and_inventory">
        <objective>
            - Establish the current source layout, commands, runtime dependencies, helper app entrypoints, and dirty worktree before changing files.
        </objective>
        <inputs>
            - `apps/scene-engine/package.json`
            - `apps/scene-engine/next.config.ts`
            - `apps/scene-engine/tsconfig.json`
            - `apps/scene-engine/app/editor/page.tsx`
            - `apps/scene-engine/app/api/scenes/[id]/route.ts`
            - `apps/pi-asset-loop/package.json`
            - `apps/asset-extraction-pipeline/package.json`
            - `AGENTS.md`
        </inputs>
        <process>
            - Run `git status --short` and record unrelated dirty paths in `current_state.md`.
            - Run a light health check against `http://localhost:3000/`. Start the dev server only if the health check fails and the objective needs it.
            - Inventory scene-engine scripts, dependencies, API routes, filesystem reads/writes, and current app title/metadata.
            - Inventory helper app scripts and any references to their current `apps/pi-asset-loop` or `apps/asset-extraction-pipeline` paths.
            - Identify package manager constraints and whether a root workspace configuration already exists.
        </process>
        <outputs>
            - `objectives/main-menu-desktop-app/artifacts/baseline_inventory.json`: current scripts, dependency manager, helper paths, API routes, filesystem-write points, health-check result, and dirty worktree summary.
            - `current_state.md`: updated with baseline findings and first implementation route.
        </outputs>
        <gate>
            - Baseline inventory exists and identifies the runtime strategy risk created by filesystem-backed scene APIs.
        </gate>
        <failure_handling>
            - If helper app metadata is missing or commands cannot be inferred, defer moving that helper and record the blocker.
            - If the dev server is unavailable, use source inspection for baseline and start it only when visual/runtime validation is required.
        </failure_handling>
    </phase>

    <phase id="2" name="desktop_layout_and_dependencies">
        <objective>
            - Add a maintainable Electron desktop structure inside `apps/scene-engine` and choose tooling for mac packaging.
        </objective>
        <inputs>
            - Output from phase 1.
            - Electron packaging documentation as needed.
            - Current `apps/scene-engine` package and TypeScript setup.
        </inputs>
        <process>
            - Add `apps/scene-engine/desktop/main` and `apps/scene-engine/desktop/preload` or an equivalent clearly named native-process layout.
            - Add Electron dependencies and build tooling with scripts named clearly for dev and mac packaging.
            - Configure user-facing product metadata as `Main Menu`.
            - Define TypeScript types for the preload bridge, starting with a minimal app-info API under `window.mainMenu`.
            - Decide whether to move helper apps now. If moving, relocate to `apps/helpers/pi-asset-loop` and `apps/helpers/asset-extraction-pipeline`, then update scripts/docs/import paths and validate their entrypoints.
        </process>
        <outputs>
            - Updated `apps/scene-engine/package.json` and lockfile.
            - New desktop source folders and bridge types.
            - Optional helper app move with updated paths, or `current_state.md` note deferring the move.
            - `objectives/main-menu-desktop-app/artifacts/desktop_runtime_strategy.md`: initial tooling and runtime decisions.
        </outputs>
        <gate>
            - Source layout and scripts are coherent, and no renderer file imports Electron main-process modules directly.
        </gate>
        <failure_handling>
            - If dependency/tooling conflicts with the existing Next app, document the rejected route and switch to a simpler Electron build path before continuing.
            - If helper relocation causes broad churn, revert only the helper move edits made in this objective and record it as follow-up.
        </failure_handling>
    </phase>

    <phase id="3" name="electron_dev_shell">
        <objective>
            - Make the existing editor run in an Electron window during development with safe defaults and Main Menu branding.
        </objective>
        <inputs>
            - Outputs from phases 1 and 2.
            - Current running Next dev server or command to launch it.
        </inputs>
        <process>
            - Implement Electron main window creation, app lifecycle, mac app menu basics, and dev URL loading.
            - Implement preload bridge with context isolation and no renderer Node integration.
            - Expose a minimal `window.mainMenu.app.getInfo()` or equivalent bridge method and consume it only where useful for validation.
            - Set window title and visible app labels to `Main Menu`.
            - Run the desktop dev command and capture console output plus a screenshot of the editor window.
        </process>
        <outputs>
            - Working desktop dev command.
            - `objectives/main-menu-desktop-app/artifacts/screenshots/desktop_dev_editor.png` or an equivalent screenshot path.
            - Updated `current_state.md` with dev launch status.
        </outputs>
        <gate>
            - Electron dev window titled `Main Menu` loads the editor and the bridge API works.
        </gate>
        <failure_handling>
            - If the dev server port is occupied or missing, use the AGENTS.md health-check/start guidance and document the chosen port.
            - If preload typing fails, keep the API minimal rather than expanding to untyped global access.
        </failure_handling>
    </phase>

    <phase id="4" name="packaged_runtime_and_mac_bundle">
        <objective>
            - Produce a macOS package that launches Main Menu without relying on an external Next dev server.
        </objective>
        <inputs>
            - Dev shell from phase 3.
            - Current Next API routes and project filesystem requirements.
            - `apps/scene-engine/projects/codecaine/**`
            - `apps/scene-engine/public/**`
        </inputs>
        <process>
            - Choose and document the packaged runtime strategy. Preferred first route: package a local Next production server or standalone server if it preserves current API behavior. Alternative route: migrate required scene APIs to Electron IPC if packaging a server is brittle.
            - Define where writable project data lives in packaged mode: user-selected workspace, app userData copy, or another explicit writable path.
            - Ensure the app does not silently write to read-only packaged resources.
            - Configure mac packaging with product name `Main Menu` and a stable bundle identifier.
            - Run the mac package command and launch the produced app.
            - Validate loading the editor and saving a scene or equivalent writable-scene smoke test.
        </process>
        <outputs>
            - Launchable mac artifact path.
            - `objectives/main-menu-desktop-app/artifacts/mac_package_manifest.txt`
            - `objectives/main-menu-desktop-app/artifacts/screenshots/mac_packaged_editor.png` or equivalent.
            - Updated `desktop_runtime_strategy.md` with final runtime/writable-data decision.
        </outputs>
        <gate>
            - A fresh mac package launches without `localhost:3000` and validates the editor load plus scene persistence strategy.
        </gate>
        <failure_handling>
            - If packaged Next server startup fails, inspect logs and decide whether a smaller IPC migration is safer than forcing the server route.
            - If saving fails because resources are read-only, stop and implement or document the writable workspace migration before claiming completion.
        </failure_handling>
    </phase>

    <phase id="5" name="validation_and_handoff">
        <objective>
            - Validate the desktop app, document decisions, and leave a durable handoff.
        </objective>
        <inputs>
            - Outputs from phases 1 through 4.
        </inputs>
        <process>
            - Run the validation ladder from `context/04_validation_and_handoff.md`.
            - Verify user-facing `Main Menu` naming in package metadata, window title, app menu, and any bridge/global examples.
            - Verify renderer security settings and preload API boundaries.
            - Compare helper app paths and commands before/after any move.
            - Write report sections explaining architecture, runtime strategy, packaging path, helper layout, security posture, rejected routes, risks, and next actions.
            - Update `current_state.md` with decisions, commands, paths, artifacts, risks, and next actions.
        </process>
        <outputs>
            - `report.md`: final objective report.
            - `current_state.md`: updated handoff state.
            - `objectives/main-menu-desktop-app/artifacts/run_summary.json`: commands, outcomes, package artifact paths, screenshots, and risk index.
        </outputs>
        <gate>
            - Completion criteria in `goal.md` and validation gates in `context/04_validation_and_handoff.md` are satisfied or the report clearly marks the objective as blocked/rejected.
        </gate>
        <failure_handling>
            - If validation fails, preserve logs/screenshots, explain the failure, and identify the smallest next fix or rollback path.
        </failure_handling>
    </phase>
</working_plan>
