<implementation_scope>
    <owned_surfaces>
        - `apps/scene-engine/package.json`: Add Electron, desktop dev, build, and mac packaging scripts plus required dependencies.
        - `apps/scene-engine/package-lock.json`: Update if npm dependencies are added or scripts require lockfile changes.
        - `apps/scene-engine/desktop/main/**`: Add Electron main-process code for windows, runtime server orchestration, menus, project/workspace handling, and later service registration.
        - `apps/scene-engine/desktop/preload/**`: Add safe typed bridge exposing `window.mainMenu`.
        - `apps/scene-engine/app/**`: Make minimal renderer changes for desktop detection, app title/name, and bridge usage. Do not redesign the editor.
        - `apps/scene-engine/next.config.ts`: Adjust only if needed for packaged Next runtime output.
        - `apps/scene-engine/tsconfig.json`: Adjust include/path settings only if needed for desktop source compilation.
        - `apps/scene-engine/projects/**`: Use only for fixture/sample migration or validating writable project strategy.
        - `apps/helpers/pi-asset-loop/**`: Target location if moving `apps/pi-asset-loop`; preserve CLI behavior.
        - `apps/helpers/asset-extraction-pipeline/**`: Target location if moving `apps/asset-extraction-pipeline`; preserve CLI behavior.
        - `objectives/main-menu-desktop-app/artifacts/**`: Store package notes, command summaries, screenshots, manifests, and validation output.
    </owned_surfaces>

    <read_only_references>
        - `ai_docs/pi-agent/docs/sdk.md`: Reference for later PI SDK service shape; do not edit vendored/local docs.
        - `ai_docs/pi-agent/docs/rpc.md`: Reference only if the objective evaluates SDK vs subprocess/RPC boundaries.
        - `apps/pi-asset-loop/src/agent/orchestrator.ts`: Read for PI SDK event/session patterns before moving or extracting shared logic.
        - `AGENTS.md`: Read for dev-server and build guidance; do not rewrite for this objective unless the desktop workflow requires a small explicit update.
        - Existing completed objectives under `objectives/asset-library-active-export/` and `objectives/run-exported-codecaine-build/`: Read for export/runtime context; do not modify their artifacts.
    </read_only_references>

    <generated_outputs>
        - `objectives/main-menu-desktop-app/artifacts/baseline_inventory.json`: Package manager, current scripts, app routes/API routes, helper app paths, and dirty worktree summary.
        - `objectives/main-menu-desktop-app/artifacts/desktop_runtime_strategy.md`: Decision record for packaged runtime: embedded Next server, IPC migration, writable workspace location, and rejected alternatives.
        - `objectives/main-menu-desktop-app/artifacts/mac_package_manifest.txt`: File or directory manifest for the generated mac artifact.
        - `objectives/main-menu-desktop-app/artifacts/screenshots/`: Dev and packaged app screenshots proving launch and editor render.
        - `objectives/main-menu-desktop-app/report.md`: Final implementation report.
        - `objectives/main-menu-desktop-app/artifacts/run_summary.json`: Commands run, exit statuses, artifact paths, and validation notes.
    </generated_outputs>

    <commands_and_entrypoints>
        - `curl -fS -I http://localhost:3000/`: Light health check before assuming the dev server is available.
        - `cd apps/scene-engine && npm run desktop:dev`: Preferred final dev command name unless implementation documents a different equivalent.
        - `cd apps/scene-engine && npm run desktop:pack:mac`: Preferred final mac packaging command name unless implementation documents a different equivalent.
        - `cd apps/scene-engine && npx tsc --noEmit`: Type validation if TypeScript config includes the edited desktop/renderer code or if no narrower typecheck exists.
        - Existing helper entrypoints such as `bun run asset-loop` must be revalidated if helper apps are moved.
    </commands_and_entrypoints>

    <adjacent_surfaces_requiring_caution>
        - `apps/scene-engine/app/api/**`: These APIs may need packaging/runtime adjustments, but broad rewrites to IPC should be deferred unless required for packaged launch/save.
        - `apps/scene-engine/public/**`: Avoid moving assets/modules/fonts as part of desktop packaging unless the runtime strategy requires explicit resource copying.
        - `apps/scene-engine/app/_engine/export/**`: Export runtime is adjacent but not the desktop runtime. Touch only if packaging reuses export boot logic deliberately.
        - Root workspace/package files: Edit only if the repo already has or needs a root workspace command. Keep monorepo churn minimal.
    </adjacent_surfaces_requiring_caution>

    <out_of_scope>
        - Full scene-aware PI chat agent implementation: this objective prepares the native process boundary only.
        - Terminal emulator UI: optional later surface, not needed to package the current editor.
        - App notarization, signing identity setup, auto-update, and release-channel publishing.
        - Windows/Linux packaging and platform-specific fixes outside macOS.
        - Large visual redesign of dashboard/editor/sidebar.
    </out_of_scope>
</implementation_scope>
