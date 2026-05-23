<problem>
    <objective_question>
        - Can the current `apps/scene-engine` Next editor become the macOS desktop app **Main Menu** without throwing away the working browser-based editor?
        - What file/process layout lets the desktop app later host PI agent sessions, asset extraction, and helper workflows without turning the renderer into an unsafe local backend?
    </objective_question>

    <current_baseline>
        - `apps/scene-engine` is a Next 15 React app with the editor in `app/editor`, scene state in Zustand, scene API routes under `app/api`, and local project files under `projects/`.
        - `AGENTS.md` says to assume the scene engine dev server is usually running at `http://localhost:3000` and to verify routine scene-engine changes through the running browser/server instead of production builds.
        - `apps/pi-asset-loop` already uses the PI SDK for an asset reconstruction loop, but it is currently a helper app rather than part of the main authoring surface.
        - `apps/asset-extraction-pipeline` is another helper workflow that may later be launched from the desktop app.
    </current_baseline>

    <why_current_state_is_insufficient>
        - A browser-only editor is awkward for a filesystem-writing authoring workflow. PI sessions, terminal processes, file watching, packaging, and project-root permissions need a local native process.
        - Next API routes can support local development, but they are not a durable place for long-lived agent sessions or native desktop orchestration.
        - A future chat agent should understand selected scene objects and edit files safely through typed local services, not through an embedded terminal masquerading as product UX.
    </why_current_state_is_insufficient>

    <failure_modes>
        - `dev_server_dependency`: The mac app opens only when `npm run dev` is already running. This is not an acceptable package.
        - `unsafe_renderer_power`: Electron enables Node integration or unrestricted filesystem access in the renderer. This makes the UI an unsafe backend.
        - `read_only_bundle_writes`: Packaged code tries to write scene/project files inside the macOS app bundle instead of a writable workspace.
        - `brand_drift`: Some UI, package metadata, bridge names, or app menus still call the product `MELEE` when this objective requires user-facing `Main Menu`.
        - `helper_path_breakage`: Moving helper apps breaks scripts, imports, lockfiles, or docs without a validation pass.
    </failure_modes>

    <prior_evidence>
        - `apps/scene-engine/app/editor/page.tsx`: Current editor is already a renderer UI with hierarchy, canvas, and inspector panels.
        - `apps/scene-engine/app/_engine/store/editor-store.ts`: Selection and scene mutation already have a clear state/action surface that future agent tools can target.
        - `apps/scene-engine/app/api/scenes/[id]/route.ts`: Scene loading/saving currently uses filesystem-backed API routes, so packaged writable data strategy must be deliberate.
        - `apps/pi-asset-loop/src/agent/orchestrator.ts`: The repo already has working PI SDK usage and event subscription patterns.
        - `ai_docs/pi-agent/docs/sdk.md`: PI supports custom UI embedding through `createAgentSession()`, streaming events, custom tools, and session control.
    </prior_evidence>

    <expected_value>
        - A working macOS desktop app gives the project a native host for local authoring and sets up the process boundary required for the later scene-aware PI chat panel.
        - The user can keep building the current editor while gradually moving helper workflows into the desktop app instead of freezing work for a full rewrite.
    </expected_value>
</problem>
