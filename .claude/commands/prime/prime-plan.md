---
description: Gain deep understanding of the plan phase — pipeline execution, data model, design principles, backend state, and frontend integration
---

# Prime Plan Phase

Read all plan phase documentation to understand the 3-tier hierarchical pipeline that designs implementation from a spec.

## Read

# Plan phase documentation (system design)
docs/10-system-design/10-session-flow/core-session-phases/30-plan/10-overview.md
docs/10-system-design/10-session-flow/core-session-phases/30-plan/15-plan-json.md
docs/10-system-design/10-session-flow/core-session-phases/30-plan/16-plan-design.md
docs/10-system-design/10-session-flow/core-session-phases/30-plan/18-pipeline-execution.md

# Plan data models (source of truth for plan.json structure)
apps/backend/app/src/phases/plan/state/models.py

# Plan skill reference (IDK instruction set + templates)
.claude/skills/session/plan/OVERVIEW.md

## Be Aware Of

### Plan backend implementation
Located at `apps/backend/app/src/phases/plan/`:
- `service.py` — PlanAgentService orchestrator (run_pipeline, advance, review gates)
- `pipeline.py` — Pipeline state machine, advance_pipeline() with seed-driven advancement
- `review.py` — Review gate logic, event persistence
- `types.py` — OversightMode, PipelineLevel, PipelineState
- `agents/` — Sub-agent packages (each with agent.py, prompt.md, and optional context.py):
  - `outline/` — Outline agent (checkpoint decomposition)
  - `task_groups/` — TG agent (task groups + seeds + testing strategy)
  - `tasks/` — Task agent (seed → full task with file_context + actions)
- `mcp/` — MCP tools for plan.json CRUD:
  - `tools/plan_set_outline.py`, `plan_set_task_groups.py`, `plan_set_task.py`, `plan_set_task_actions.py`
  - `tools/plan_get_outline.py`, `plan_get_checkpoint.py`, `plan_get_task_group.py`, `plan_get_task.py`
  - `server.py` — MCP server with per-agent tool scoping
- `state/` — PlanStateManager (`manager.py`) and Pydantic models (`models.py`)
- `api/routes/` — API routes (start, approve, send, stop, resume, status, review, exit_to_auto)

Read these when you need implementation details beyond what the docs cover.

### Plan frontend implementation
Located at `apps/frontend/src/app/projects/[slug]/sessions/[sessionSlug]/`:
- `_components/phases/PlanView.tsx` — Structured plan.json rendering
- `_components/phases/PlanTimeline.tsx` — Event + agent activity timeline
- `_components/phases/PlanControls.tsx` — Context-sensitive bottom bar
- `_hooks/usePlanActivity.ts` — Agent activity polling
- `_hooks/usePlanStatus.ts` — Plan status derivation
- `_lib/plan-status.ts` — Seed-based progress computation
- `_types/plan.ts` — Frontend plan types (TaskSeed, file_context on tasks)

### IDK vocabulary (action instruction set)
Located at `.claude/skills/session/plan/idk/`:
- crud.md, actions.md, language.md, location.md, refactoring.md, testing.md, documentation.md

## Report

Summarize your understanding of the plan system