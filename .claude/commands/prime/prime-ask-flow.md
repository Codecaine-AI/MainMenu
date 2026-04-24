---
description: Gain deep understanding of the durable-ask flow — phase-agnostic question/answer handshake across backend (ask tool, pending_asks, /asks/answer, resume via spawnAgent) and frontend (BottomPane, QuestionWidget, AskTabs review)
---

# Prime Ask Flow (Backend ↔ Frontend Handshake)

Durable ask/answer pipeline. Agent calls `ask` → `pending_asks` row + `UI_ASK_REQUESTED` → frontend renders widget → user answers → `POST /asks/answer` → row marked answered + `UI_ASK_ANSWERED` → `resumePendingAsk` re-spawns the same agent with the toolResult appended → LLM continues.

DB is source of truth. SSE is push-only invalidation. Reload rehydrates via snapshot.

## Read (Core)

### Backend
- apps/backend/src/agent-kernel/run/shared-tools/ask/tool.ts — Pi tool: insert row, flip status, abort
- apps/backend/src/agent-kernel/run/shared-tools/ask/resume.ts — wrapper over `spawnAgent` with `resumeFromToolResult`
- apps/backend/src/agent-kernel/run-context.ts — `RunContext` carries `agentName`
- apps/backend/src/agent-kernel/agent-spawning/agent-builder.ts — `spawnAgent`, `triggerRun`, `appendResumeToolResult`, `buildSessionManager` (≤25 LOC body cap)
- apps/backend/src/api/asks/answer.ts — `POST /asks/answer` (CAS, event, fire-and-forget resume)
- apps/database/src/schema/pending-asks.ts — schema (`tool_use_id` PK, `agent_name`, `kind`, `payload`, `status`)
- apps/database/src/actions/pending-asks.ts — `insertPendingAsk`, `markPendingAskAnswered` (CAS)
- apps/database/src/events/factories.ts — `createUIAskRequestedEvent`, `createUIAskAnsweredEvent`

### Frontend
- apps/frontend/src/types/ask-event.ts — `PendingAsk`, `AskQuestion`, `AskAnswer`
- apps/frontend/src/app/(dashboard)/sessions/[sessionSlug]/_hooks/useSessionLive.ts — SSE → `pendingAsk` + `submitAnswer`
- apps/frontend/src/app/(dashboard)/sessions/[sessionSlug]/_components/BottomPane.tsx — dispatch by `pendingAsk.kind`
- apps/frontend/src/app/(dashboard)/sessions/[sessionSlug]/_components/ask/QuestionWidget.tsx — switch on `question.type`
- apps/frontend/src/app/(dashboard)/sessions/[sessionSlug]/_components/ask/AskTabs.tsx — multi-Q + review mode
- apps/frontend/src/app/(dashboard)/sessions/[sessionSlug]/_components/ask/AskReview.tsx — summary + edit + submit
- apps/frontend/src/lib/sessions-api.ts — `submitAskAnswer(slug, body)` → `POST /asks/answer`

### Docs
- docs/10-system-design/10-system-flow/15-durable-ask.md
- docs/20-implementation/20-frontend/20-durable-ask-widgets.md

## Be Aware Of (Reference)

### Suspend (`ask` tool)
Reads `agentName`/`sessionUuid`/`traceWriter` from `getRunContext()`, inserts `pending_asks` row, flips session status to `awaiting_user_input`, emits `UI_ASK_REQUESTED`, `ctx.abort()`. JSONL retains the assistant message with the pending `toolCall`; no matching `toolResult` yet.

### `pending_asks` row
- `tool_use_id` PK (Pi-generated). `agent_name` REQUIRED — drives which JSONL the resume opens.
- `payload`: `{ questions: AskQuestion[] }`. `status` ∈ `awaiting`/`answered`. CAS via `markPendingAskAnswered`.
- Reboot-safe: state in DB, not in-memory promises.

### Resume (`/asks/answer` → `resumePendingAsk` → `spawnAgent`)
1. Validate session + row, CAS mark answered, emit `UI_ASK_ANSWERED`, status → `running`.
2. Fire-and-forget `resumePendingAsk({ ..., agentName, toolResultContent })`.
3. `spawnAgent(agentName, "", null, { resumeFromToolResult })`:
   - `buildSessionManager` opens existing JSONL at `{piSessionsDir}/{slug}/{agentName}/`, then `appendResumeToolResult` writes the synthetic `toolResult` (matched by `toolCallId`) **before** `createPiSession` reads the file.
   - Original tools/extensions/system-prompt re-registered via the normal spawn path.
   - `triggerRun` calls `sendCustomMessage({customType:"spectre-ask-resume", display:false}, {triggerTurn:true})` instead of `session.prompt(prompt)`.
4. LLM sees the toolResult and continues — calls next tool (`set_topic`, etc.) which exists because the agent was properly re-spawned.

**Why**: prior bug used `createCodingTools(cwd)` only — agent-specific tools missing, LLM stalled silently after resume.

### `SpawnOptions.resumeFromToolResult`
`{ toolUseId, toolName, content }`. When set, `buildSessionManager` appends + `triggerRun` swaps the trigger. `prompt` arg ignored on the resume path; callers pass `""`.

### LOC cap
`spawnAgent` body ≤25 logical lines, enforced by `apps/backend/src/agent-kernel/agent-spawning/__tests__/spawn-loc-cap.test.ts`. Resume hooks live in helpers, not inline.

### Frontend state
`useSessionLive(slug)` owns SSE + `pendingAsk`:
- Mount → `GET /sessions/:slug/state` → `setPendingAsk(snap.pending_ask)`.
- `ui_ask_requested` → `setPendingAsk(...)`. `ui_ask_answered` → `setPendingAsk(null)`.
- `submitAnswer` POSTs `/asks/answer`, optimistically clears, restores on error, invalidates `messages` + `state`.

### Widget dispatch (`BottomPane`)
- `kind="confirm"` → `FinalizeConfirm`
- `kind="link_prior"` → `AskLinkPrior`
- `kind="ask"` + `questions.length > 1` → `AskTabs`
- `kind="ask"` + N=1 → `QuestionWidget` (switch on `q.type`: `freeform`/`single`/`multi`)

### Multi-Q review (`AskTabs`)
After last tab answered → `mode='review'` (no auto-submit). `AskReview` lists Q+A pairs, per-row `[edit]` jumps back, ⌘↵ submits. Single-Q + `confirm`/`link_prior` skip review.

### File tree (frontend)
```
_components/ask/
  QuestionWidget.tsx     dispatch on q.type
  AskTabs.tsx            multi-Q + review
  AskReview.tsx          summary + edit + submit
  types/{AskFreeform,AskSingle,AskMulti}.tsx
  special/{AskLinkPrior,FinalizeConfirm}.tsx
```

## Report

Trace one ask end-to-end: which agent emits, what lands in `pending_asks`, what SSE event the frontend receives, which widget mounts, what payload POSTs back, how the agent picks up. Call out the role of `agent_name` in the phase-agnostic resume.
