<implementation_scope>
    <owned_surfaces>
        - `apps/scene-engine/app/editor/**`: Add the left-sidebar PI/object workspace and integrate it with current editor layout.
        - `apps/scene-engine/app/editor/_components/HierarchyPanel.tsx`: Coordinate object selection and insertion targets with the new workspace.
        - `apps/scene-engine/app/_engine/store/editor-store.ts`: Extend store actions/selectors only as needed for active object context, insertion targets, or create/apply results.
        - `apps/scene-engine/app/_engine/types/**` or existing type files: Add object-workspace request/result types when needed.
        - `apps/scene-engine/desktop/types/main-menu.ts`: Extend the typed preload bridge contract for object/project update operations.
        - `apps/scene-engine/desktop/preload/index.ts`: Expose only narrow typed methods under `window.mainMenu`.
        - `apps/scene-engine/desktop/main/**`: Own native service handlers, file/project update application, and optional PI session orchestration.
        - `apps/scene-engine/app/api/**`: Adjust only when server-side routes are the better boundary for scene/project update operations.
        - `apps/scene-engine/projects/**`: Use for fixtures/validation changes only with before/after artifacts.
        - `objectives/main-menu-pi-object-sidebar/artifacts/**`: Store screenshots, command summaries, contract notes, diffs, and validation evidence.
    </owned_surfaces>

    <read_only_references>
        - `objectives/main-menu-desktop-app/report.md`
        - `objectives/main-menu-desktop-app/current_state.md`
        - `objectives/main-menu-desktop-app/artifacts/desktop_runtime_strategy.md`
        - `ai_docs/pi-agent/docs/sdk.md`
        - `ai_docs/pi-agent/docs/rpc.md`
        - `apps/pi-asset-loop/src/agent/orchestrator.ts`
        - `apps/scene-engine/app/_engine/types/scene.ts` or equivalent scene type definitions
    </read_only_references>

    <generated_outputs>
        - `objectives/main-menu-pi-object-sidebar/artifacts/baseline_inventory.json`: Current editor selection/create/save surfaces, bridge contract, PI reference paths, and dirty worktree summary.
        - `objectives/main-menu-pi-object-sidebar/artifacts/object_workspace_contract.md`: Typed request/result contract for active object context, create object, and code-backed update application.
        - `objectives/main-menu-pi-object-sidebar/artifacts/code_update_evidence.md`: Before/after scene and code-file evidence from the validated create/update flow.
        - `objectives/main-menu-pi-object-sidebar/artifacts/screenshots/`: Dev and packaged screenshots of the sidebar/workspace.
        - `objectives/main-menu-pi-object-sidebar/artifacts/run_summary.json`: Commands, exit codes, screenshots, changed paths, and validation verdicts.
        - `objectives/main-menu-pi-object-sidebar/report.md`: Final report.
    </generated_outputs>

    <commands_and_entrypoints>
        - `curl -fS -I http://localhost:3000/`: Light dev-server health check per repo guidance.
        - `cd apps/scene-engine && npm run desktop:dev`: Desktop development validation.
        - `cd apps/scene-engine && npm run desktop:compile`: Electron main/preload type validation.
        - `cd apps/scene-engine && npx tsc --noEmit`: Renderer/app type validation.
        - `cd apps/scene-engine && npm run desktop:pack:mac`: Packaged runtime validation when feature behavior is ready.
    </commands_and_entrypoints>

    <out_of_scope>
        - Rebuilding the editor from scratch.
        - General-purpose chat UX unrelated to selected object creation/update.
        - Terminal emulator UI or arbitrary shell command execution from the renderer.
        - Windows/Linux packaging, notarization, auto-update, cloud sync, auth, or release publishing.
        - Broad helper app relocation unless separately validated.
    </out_of_scope>
</implementation_scope>
