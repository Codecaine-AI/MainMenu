<current_state>
<last_updated>2026-05-23</last_updated>

<status>
    - Main Menu desktop objective is implemented and validated for the requested macOS milestone.
    - `apps/scene-engine` remains the main app and now owns Electron main/preload code under `apps/scene-engine/desktop/`.
    - Development launch, packaged mac launch, safe preload bridge, and packaged scene persistence smoke tests passed.
    - Helper app relocation is explicitly deferred with no files moved and no broken half-move.
</status>

<completed>
    - Created `objectives/main-menu-desktop-app/`.
    - Wrote the objective goal and context files with phase-gated implementation, validation, and handoff requirements.
    - Established naming decision: user-facing app name is `Main Menu`; preload namespace should prefer `window.mainMenu`.
    - Established layout decision: `apps/scene-engine` remains the main app; Electron-native code should live under a clear `desktop/` boundary inside that app; helper workflows should move toward `apps/helpers/*` only with validation.
    - Captured `objectives/main-menu-desktop-app/artifacts/baseline_inventory.json`.
    - Confirmed package manager baseline: `apps/scene-engine` uses npm with `package-lock.json` lockfileVersion 3 and no root workspace package.
    - Confirmed filesystem packaging risk: scene/project and asset writes currently flow through `process.cwd()/projects` and `process.cwd()/public/assets`.
    - Added Electron dependencies and scripts: `desktop:compile`, `desktop:dev`, `desktop:build:next`, and `desktop:pack:mac`.
    - Added `desktop/main/index.ts`, `desktop/preload/index.ts`, typed bridge definitions, and desktop scripts for dev launch, compatible Node routing, and Next standalone staging.
    - Configured `next.config.ts` with `output: 'standalone'` for packaged runtime.
    - Added hidden renderer bridge probe using `window.mainMenu` and changed app metadata/dashboard product label to `Main Menu`.
    - Packaged mac artifact produced at `apps/scene-engine/dist/desktop/mac-arm64/Main Menu.app`.
    - Packaged app launched with bridge-reported renderer URL `http://127.0.0.1:59500/editor?project=codecaine&scene=title`, not external `localhost:3000`.
    - Packaged layer selection smoke passed by clicking hierarchy row `data-path=0` (`Base Barber Cylinder [component]`) and observing selected styling change from false to true.
    - Packaged scene persistence smoke passed: scene GET returned `200`; scene PUT returned `204`; writable file path was `/Users/Ford/Library/Application Support/Main Menu/workspace/projects/codecaine/scenes/title/scene.json`.
    - Wrote `objectives/main-menu-desktop-app/report.md`.
    - Wrote artifacts: `desktop_runtime_strategy.md`, `mac_package_manifest.txt`, `run_summary.json`, and screenshots under `artifacts/screenshots/`.
</completed>

<in_progress>
    - No implementation work remains for the requested milestone.
</in_progress>

<next_actions>
    - Add a custom Main Menu app icon.
    - Define user workspace update/migration behavior for future app versions.
    - Move helper apps to `apps/helpers/*` only in a separate validated mechanical pass.
</next_actions>

<risks_or_open_questions>
    - The package currently uses the default Electron icon.
    - The local mac artifact is unsigned and unnotarized by design for this objective.
    - The staged Next runtime is large because standalone dependencies and media assets are bundled.
    - Future app updates need a workspace migration/versioning policy beyond first-launch seeding.
    - The pre-existing `localhost:3000` dev server returned `500` for `/` during validation after source changes; `desktop:dev` now handles this by starting a private free-port dev server when the default health check fails.
</risks_or_open_questions>

<important_paths>
    - `objectives/main-menu-desktop-app/goal.md`
    - `objectives/main-menu-desktop-app/current_state.md`
    - `objectives/main-menu-desktop-app/context/00_problem.md`
    - `objectives/main-menu-desktop-app/context/01_constraints.md`
    - `objectives/main-menu-desktop-app/context/02_implementation_scope.md`
    - `objectives/main-menu-desktop-app/context/03_working_plan.md`
    - `objectives/main-menu-desktop-app/context/04_validation_and_handoff.md`
    - `objectives/main-menu-desktop-app/report.md`
    - `objectives/main-menu-desktop-app/artifacts/baseline_inventory.json`
    - `objectives/main-menu-desktop-app/artifacts/desktop_runtime_strategy.md`
    - `objectives/main-menu-desktop-app/artifacts/mac_package_manifest.txt`
    - `objectives/main-menu-desktop-app/artifacts/run_summary.json`
    - `objectives/main-menu-desktop-app/artifacts/screenshots/desktop_dev_editor.png`
    - `objectives/main-menu-desktop-app/artifacts/screenshots/desktop_dev_playwright_editor.png`
    - `objectives/main-menu-desktop-app/artifacts/screenshots/mac_packaged_editor.png`
    - `apps/scene-engine/dist/desktop/mac-arm64/Main Menu.app`
    - `objectives/main-menu-desktop-app/artifacts/`
    - `apps/scene-engine/`
    - `apps/pi-asset-loop/`
    - `apps/asset-extraction-pipeline/`
</important_paths>
</current_state>
