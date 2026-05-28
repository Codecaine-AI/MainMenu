<problem>
    <objective_question>
        - How should Main Menu expose a bottom-left-sidebar chat panel that talks to the Pi agent SDK and can edit the current project safely?
        - What preload/Electron boundary lets the renderer send chat prompts and receive streamed status without native access?
    </objective_question>

    <current_baseline>
        - `objectives/main-menu-desktop-app/report.md` records the completed Electron app baseline.
        - `apps/scene-engine/app/editor/page.tsx` renders the editor shell with left hierarchy, canvas, and inspector.
        - `apps/scene-engine/app/editor/_components/HierarchyPanel.tsx` owns the left sidebar.
        - `apps/scene-engine/desktop/preload/index.ts` exposes `window.mainMenu`.
        - `ai_docs/pi-agent/docs/sdk.md` documents `createAgentSession()` and event streaming.
    </current_baseline>

    <correction>
        - The earlier "PI Object" implementation was a misunderstanding and has been removed from the visible editor bridge/UI.
        - The desired feature is a normal chat panel titled `Pi Agent`, docked at the bottom of the left sidebar.
    </correction>

    <failure_modes>
        - `object_workspace_regression`: UI or docs still present this as a PI Object workflow.
        - `unsafe_renderer_backend`: React imports `fs`, shell, Electron main modules, or Pi SDK directly.
        - `chat_without_agent`: The panel is only a mock and does not route through a Pi SDK-backed main-process service.
        - `selection_context_loss`: Chat requests omit current project, scene, or selected layer context.
        - `runtime_mismatch`: The SDK package cannot load under the Electron Node runtime.
    </failure_modes>
</problem>
