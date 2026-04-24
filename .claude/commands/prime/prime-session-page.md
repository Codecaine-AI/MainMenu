---
description: Gain deep understanding of the frontend session page — React Query state layer, SSE → cache bridge, vertical phase slices, durable-ask widgets
---

# Prime Session Page (Frontend)

Build understanding of `/sessions/[sessionSlug]` — the core user surface. One URL, one chat, phase-driven layout (intake → link_priors → spec → plan → build → docs). DB is source of truth; SSE invalidates React Query cache; snapshot rehydrates on reload.

## Read (Core)

- docs/20-implementation/20-frontend/00-overview.md — file tree, React Query layer, SSE bridge, phase slices, session creation flow
- docs/20-implementation/20-frontend/20-durable-ask-widgets.md — widget contract, hydration, BottomPane mounting
- docs/20-implementation/20-frontend/30-plan.md — PlanPhase composition, query/mutation surface, timeline rendering
- apps/frontend/src/app/(dashboard)/sessions/[sessionSlug]/page.tsx — thin shell; header, tabs, PhaseRouter, debug column
- apps/frontend/src/app/(dashboard)/sessions/[sessionSlug]/_components/PhaseRouter.tsx — switch(activePhase) → matching `*Phase`
- apps/frontend/src/app/(dashboard)/sessions/[sessionSlug]/_components/ChatShell.tsx — generic frame: messages list + footer slot
- apps/frontend/src/app/(dashboard)/sessions/[sessionSlug]/_components/BottomPane.tsx — mounts ask widget keyed by `pendingAsk.kind`
- apps/frontend/src/app/(dashboard)/sessions/[sessionSlug]/_hooks/useSessionLive.ts — SSE → cache invalidation + pendingAsk state
- apps/frontend/src/app/(dashboard)/sessions/[sessionSlug]/_queries/keys.ts — `sessionKeys` factory (row | state | plan | spec | messages | plan-status)
- apps/frontend/src/types/session.ts — `Session`, `SessionPhase`, `getPhaseStatus`
- apps/frontend/src/types/ask-event.ts — `PendingAsk`, `AskQuestion`

## Be Aware Of (Reference — read only if relevant)

### React Query layer
All server reads under `_queries/`, one hook per backend GET. All writes under `_mutations/`, wrapping `_lib/chat-api.ts` POST functions. Cache dedup via `sessionKeys.<kind>(slug)`. Polling cadences: state/plan/spec 5s, messages/plan-status 2s, row never (SSE-only).

`QueryProvider` (`src/components/providers/QueryProvider.tsx`) wraps `AppShell` in the root layout.

### SSE → cache bridge
`useSessionLive` runs one `EventSource` per session. SSE frames are sent on the default `message` channel — no `event:` field — so `onmessage` receives every event. Each event invalidates matching keys:
- `user_message` / `assistant_message` → `messages`
- `agent_run_start/end` → `state` + `messages` + `plan-status`
- `phase_start/end` → `row` + `state` + `plan`
- `ui_ask_requested` → `setPendingAsk(...)` (held in hook state, not cache)
- `ui_ask_answered` → `setPendingAsk(null)`

`pendingAsk` and `submitAnswer` flow page → PhaseRouter → `*Phase` → `BottomPane`.

### Phase slices (`_phases/<phase>/`)
Each phase is a self-contained vertical slice:
- `*Slice` hook owns slice-local state, returns named render slots + actions
- `*Phase` component composes slots into the layout (single-pane for intake/link_priors, two-pane for spec/plan/docs), wires durable-ask plumbing

Phase contents:
- `intake/` — `IntakePhase`, `IntakeSlice`, `IntakeTypePicker`. Pre-submit form; post-submit ChatShell + BottomPane (clarifier `ask` widgets).
- `link-priors/` — `LinkPriorsPhase`, `LinkPriorsSlice`. Inline `AskLinkPrior` → `useSubmitLinkPriors`.
- `spec/` — `SpecPhase`, `SpecSlice`, `SpecViewer`, `SpecChatInput`. Footer: `BottomPane` if `pendingAsk` else free-text input.
- `plan/` — `PlanPhase`, `PlanSlice`, `PlanViewer`, `PlanTimeline`, `PlanControls`, `CheckpointCard`, `AgentActivityEntry`. ChatShell with `body=PlanTimeline`, `footer=PlanControls`.
- `build/` — stub.
- `docs/` — `DocsPhase`, `DocsSlice`, `DocsViewer` (reads `useSessionState`).

### Phase routing
`page.tsx` derives `renderedPhase`:
- `intake` / `link_priors`: forced from `session.current_phase` regardless of manual tab
- otherwise: manual `activeTab` (auto-follows `current_phase` via state-comparison pattern, no useEffect)

Phase tabs hidden during intake/link_priors.

### Session title lifecycle
- Created via `POST /sessions/draft` with `title=null`
- Header renders `session.title || "New session"` (also `AppShell`, `SessionLane`, `DeleteSessionDialog`)
- `start-intake` does NOT write a draft title from the goal text
- Intake agent's `set_topic` tool → `SessionStateManager.setTopic` → next state save writes `state.topic` to row title
- Header switches to agent-distilled topic at that point

### Durable-ask contract
`BottomPane` mounts widget by `pendingAsk.kind`:
- `ask` → `AskFreeform` / `AskSingle` / `AskMulti` / `AskTabs` (chosen by question type / count)
- `confirm` → `FinalizeConfirm`
- `link_prior` → `AskLinkPrior`

Submission via `submitAnswer` → `POST /spec/answer { tool_use_id, answers }`. Optimistically clears `pendingAsk`; restores on error. After success, invalidates `messages` + `state`.

Components: `_components/ask/`. Widget catalog + contract: `docs/20-implementation/20-frontend/20-durable-ask-widgets.md`.

### Generic chat frame
`ChatShell` provides scrollable container, default message rendering (`historyToMessages` + `groupMessages` from `_lib/messages.ts`, `MessageBubble`, `ToolGroup`), banner + footer slots. Slices that need a custom body (plan timeline) pass `body=<...>` to bypass default rendering. Auto-scrolls to end on new message chunks.

### Lib + types
- Page-local: `_lib/{chat-api, plan-status, messages, buildTimelineTree}.ts`
- Global: `src/lib/sessions-api.ts` — HTTP client used by `useSessionLive` snapshot + `useStartIntake` etc
- Types: `src/types/{session, session-state, plan, trace-event, ask-event}.ts`

### Side surfaces
- Traces route: `/traces`
- Debug column: `_components/debug/DebugToolbar.tsx` reads from `useSessionState`/`useSessionSpec`/`useSessionPlan` (same cache as phase slices, no duplicate polling)
- Terminal primitives: `src/components/terminal/` (TerminalPane, InlineEditor)

### Session creation
No `/sessions/new`. Project page "New Session" → `POST /sessions/draft` → worktree + row (`current_phase="intake"`, `title=null`, `started_at=null`) → `router.push(/sessions/:slug)`.

### Related backend
- `apps/backend/src/api/sessions/` — state, events-stream, start-intake, link-priors, draft endpoints
- `apps/backend/src/agent-catalog/agents/intake/` — intake agent + `set_topic` / `dispatch_to_link_priors` tools
- Durable-ask transport: `docs/20-implementation/10-backend/00-overview.md#durable-ask-transport`

## Report

Summarize your understanding of the session page.
