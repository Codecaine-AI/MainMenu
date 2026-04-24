# Plan Phase

Design HOW to implement the finalized spec using checkpoint-based planning.

## Purpose

The plan phase builds the **bridge** from current state to desired state:
- Analyzes existing codebase
- Designs checkpoint sequence (vertical slices)
- Creates detailed tasks with IDK-formatted actions
- Establishes testing strategy per checkpoint

## Prerequisites

- Finalized spec (`phases.spec.status: "finalized"` in state.json)
- Session in plan phase (`current_phase: "plan"`)

## Workflow

### 3-Tier Pipeline

A pure Python orchestrator sequences 3 sub-agent tiers through a hierarchical pipeline, pausing at configurable review gates for user approval.

```
┌─────────────────────────────────────────────────────────────────┐
│  PLAN PHASE — 3-Tier Pipeline                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TIER 1: Outline Agent                                          │
│  ─────────────────────                                          │
│  1. Read finalized spec, explore full codebase                  │
│  2. Decompose into tracer-bullet checkpoints                    │
│  3. Write checkpoints via plan_set_outline                      │
│  4. ─► Review gate: outline                                     │
│                                                                 │
│  TIER 2: Task Group Agent (per checkpoint)                      │
│  ──────────────────────────────────────────                     │
│  5. For Checkpoint N:                                           │
│     a. Break checkpoint into task groups (title, objective)     │
│     b. Produce task seeds per group (title + intent)            │
│     c. Define testing strategy for checkpoint                   │
│     d. Write via plan_set_task_groups                           │
│     e. ─► Review gate: checkpoint                               │
│                                                                 │
│  TIER 3: Task Agent (per seed)                                  │
│  ──────────────────────────────                                 │
│  6. For each unprocessed seed in a task group:                  │
│     a. Explore codebase, understand seed's scope                │
│     b. Write full task (description, context, file_context)     │
│        via plan_set_task                                        │
│     c. Research implementation specifics                        │
│     d. Write IDK-formatted actions via plan_set_task_actions    │
│     e. Seed marked processed automatically                     │
│  7. ─► Review gate: task_group (full_flow only)                 │
│                                                                 │
│  8. Repeat Tiers 2-3 for remaining checkpoints                  │
│                                                                 │
│  9. Pipeline complete → transition to build                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Principle**: Each tier only decides things it has the context to decide well. The outline agent handles strategic decomposition, the TG agent handles tactical decomposition and ordering, the task agent handles implementation planning with actual codebase exploration.

### Oversight Modes

```
                      outline  checkpoint  task_group
no_oversight          -        -           -           fully autonomous
outline_only          Y        -           -           review outline only
outline_checkpoint    Y        Y           -           review outline + each checkpoint
full_flow             Y        Y           Y           review everything
```

User flow:
- **Start**: Binary choice — "Review" (`outline_only`) or "Auto-generate" (`no_oversight`)
- **At outline approval**: Pick ongoing review level (`outline_checkpoint` or `full_flow`)
- **At any gate**: Approve, send feedback, or exit to auto (`no_oversight`)

### State Tracking

The `plan_state` in state.json tracks progress for resumability:

```json
{
  "plan_state": {
    "status": "in_progress",
    "current_checkpoint": 2,
    "current_task_group": 1,
    "current_task": 3,
    "checkpoints_completed": [1],
    "last_updated": "2026-01-01T12:00:00Z",
    "summary": "Processing checkpoint 2, task group 1, seed 3"
  }
}
```

## Key Concepts

### Checkpoints — Stacked PRs

Vertical slices (tracer bullet), not horizontal layers. Each checkpoint is a stability boundary — the codebase should compile and run.

```json
{
  "id": 1,
  "title": "Foundation — thin end-to-end slice",
  "goal": "Minimal working path through the entire stack",
  "prerequisites": [],
  "status": "pending",
  "testing_strategy": null,
  "task_groups": []
}
```

`testing_strategy` and `task_groups` are written later by the TG agent — they default to `null` / `[]` at outline time.

### Task Groups — Commits

Objective-based grouping of tasks within a checkpoint. Carry task seeds — lightweight outlines that establish the flow before detail work begins.

```json
{
  "id": 1,
  "title": "Database layer",
  "objective": "Set up models and migrations",
  "status": "pending",
  "task_seeds": [
    { "title": "Create User model", "intent": "Define User with id, name, email fields", "processed": false, "task_id": null },
    { "title": "Create migration", "intent": "Alembic migration for users table", "processed": true, "task_id": 1 }
  ],
  "tasks": [...]
}
```

### Task Seeds

Minimal outlines produced by the TG agent. Two fields only — `title` and `intent`. The task agent enriches each seed into a full task.

Pipeline advancement uses the `processed` flag to find the next unprocessed seed. After the task agent completes, the orchestrator marks `processed: true` and sets `task_id` to link seed → task.

### Tasks — Verifiable Work Units

Multi-file logical work units. No `file_path` — file scoping lives on individual actions.

Each task carries:
- **`context`** — files to read before executing (`read_before` with line ranges and purpose), plus `related_files`
- **`file_context`** — beginning/ending file snapshots grounded in actual codebase exploration
- **`actions[]`** — IDK-formatted atomic steps, each scoped to a specific file

```json
{
  "id": 1,
  "title": "Create User model",
  "description": "Define SQLAlchemy User model with id, name, email, created_at",
  "depends_on": [],
  "context": {
    "read_before": [
      { "file": "src/database/base.py", "lines": "1-20", "purpose": "Understand Base class" }
    ],
    "related_files": ["src/models/__init__.py"]
  },
  "file_context": {
    "beginning": {
      "files": [{ "path": "src/models/__init__.py", "status": "exists", "description": "No User import" }]
    },
    "ending": {
      "files": [
        { "path": "src/models/user.py", "status": "new", "description": "User model" },
        { "path": "src/models/__init__.py", "status": "modified", "description": "User import added" }
      ]
    }
  },
  "actions": [
    { "id": 1, "command": "CREATE src/models/user.py", "file": "src/models/user.py", "status": "pending" },
    { "id": 2, "command": "ADD CLASS User(Base) with fields id, name, email, created_at", "file": "src/models/user.py", "status": "pending" }
  ]
}
```

**file_context on tasks (not checkpoints)**: The task agent writes it after exploring actual files — grounded, verifiable, and actionable. The `ending` state is a floor, not a ceiling.

### Actions — The IDK Instruction Set

Atomic steps within a task using Information Dense Keywords. Each action is: `VERB [target] [description]`, scoped to a file.

```
CREATE src/auth/validators.py:
    CREATE FUNCTION validate_user(user: User) -> bool

UPDATE src/middleware/index.ts:
    ADD rate limiting BEFORE authentication
    WRAP fetch calls with retry logic

REFACTOR src/utils/helpers.ts:
    SPLIT into src/utils/string.ts and src/utils/date.ts
```

### Self-Contained Task Design

> **Core Principle**: Every task must be executable by an agent in a completely new session with zero prior context.

The task object contains everything needed: file references, context, actions, dependencies. If execution breaks at any point, load the task directly and continue — no re-reading history.

### Prior-Task Context

Each task agent receives all completed task definitions from the same task group — title, description, file_context.ending, and actions. This enables natural flow without duplicating work.

## Pipeline Advancement

Depth-first walk of plan.json:

1. No checkpoints → `outline` (run outline agent)
2. Checkpoint with no task groups → `checkpoint` (run TG agent)
3. Task group with unprocessed seed → `task` (run task agent for that seed)
4. Everything processed → `None` (pipeline complete)

When the last seed in a checkpoint's last task group completes, advancement returns the next checkpoint's `task_groups` level — seamless cross-checkpoint transitions.

## MCP Tools — Per-Agent Scoping

Each agent gets only the tools relevant to its scope:

| Agent | Write Tools | Read Tools |
|-------|------------|------------|
| Outline | `plan_set_outline` | `plan_get_outline` |
| Task Group | `plan_set_task_groups` | `plan_get_outline`, `plan_get_checkpoint` |
| Task | `plan_set_task`, `plan_set_task_actions` | `plan_get_checkpoint`, `plan_get_task_group`, `plan_get_task` |

## IDK Reference

Information-Dense Keywords for precise task definitions:

| Category | Keywords | File |
|----------|----------|------|
| **CRUD** | CREATE, UPDATE, DELETE | [idk/crud.md](idk/crud.md) |
| **Actions** | ADD, REMOVE, MOVE, REPLACE, MIRROR, MAKE, USE, APPEND | [idk/actions.md](idk/actions.md) |
| **Language** | VAR, FUNCTION, CLASS, TYPE, FILE, DEFAULT | [idk/language.md](idk/language.md) |
| **Location** | BEFORE, AFTER | [idk/location.md](idk/location.md) |
| **Refactoring** | REFACTOR, RENAME, SPLIT, MERGE, EXTRACT, INLINE, INSERT, WRAP | [idk/refactoring.md](idk/refactoring.md) |
| **Testing** | TEST, ASSERT, MOCK, VERIFY, CHECK | [idk/testing.md](idk/testing.md) |
| **Documentation** | COMMENT, DOCSTRING, ANNOTATE | [idk/documentation.md](idk/documentation.md) |

## Commands

| Command | Description |
|---------|-------------|
| `/session:plan [session-id]` | Start/resume planning |
| `/session:plan [session-id] finalize` | Finalize plan for build |

## Outputs

- `plan.json` — Structured plan (source of truth)
- `plan.md` — Human-readable plan (generated from plan.json)
- `state.json` — Session tracking (managed by MCP tools)

## Templates

- [plan.json](templates/plan.json) — Plan structure template

## Reference

- [models.py](reference/models.py) — Pydantic models for type-safe plan structure

## Scripts

- [sync-plan-md.py](scripts/sync-plan-md.py) — Auto-generates plan.md from plan.json (triggered via PostToolUse hook)
