---
description: Outline-gated autonomous planning — approve outline, then auto-fill all tiers
argument-hint: [session-id] [finalize]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion
model: opus
---

# Plan Mode (Auto)

Outline-gated autonomous planning. One user confirmation at the outline, then generate task groups, tasks, and actions bit-by-bit without further prompts. Mirrors the backend `OUTLINE_ONLY` oversight default.

Sibling to `/session:plan` (tier-by-tier interactive) and `/session:quick-plan` (single-checkpoint autonomous). Pick a mode at start — no switching mid-flow.

## CRITICAL RULES

1. **NO SUB-AGENTS** — Execute everything directly in this conversation. Do NOT use the Task tool.
2. **ONE GATE** — Only one user confirmation: outline approval. After approval, autonomously fill task_groups → tasks → actions for every checkpoint.
3. **JSON AS SOURCE OF TRUTH** — Write `plan.json` first; `plan.md` is auto-generated.
4. **WRITE BIT-BY-BIT** — Write `plan.json` after each substep (task_groups added, tasks added, actions added) so state is restartable if interrupted.
5. **SELF-CONTAINED TASKS** — Every task must be executable by an agent in a new session with zero prior context.
6. **PROGRESS VISIBILITY** — Emit one short status line per checkpoint fill (e.g. `CP2 → task_groups done → tasks done → actions done`).

## Variables

```
$1 = session-id   (required)
$2 = action       (optional: "finalize")
SESSIONS_DIR = .spectre/sessions
SKILL_DIR = .claude/skills/session
```

## Required Reading

| File | Purpose | When to Read |
|------|---------|--------------|
| `SKILL_DIR/plan/OVERVIEW.md` | Workflow, concepts, IDK reference table | Always (first) |
| `SKILL_DIR/plan/templates/plan.json` | JSON structure template | Before creating plan.json |
| `SKILL_DIR/plan/idk/*.md` | IDK vocabulary by category | Before generating actions |

## State Detection

Read `state.json`:

| State | Condition | Action |
|-------|-----------|--------|
| **Spec completed without plan** | `phases.spec.status === "finalized_complete"` | Exit: no plan needed |
| **Spec not finalized** | `phases.spec.status !== "finalized"` | Error — finalize spec first |
| **Outline pending** | No checkpoints in plan.json | Step 2: generate outline |
| **Outline needs approval** | Checkpoints exist, `plan_state.status !== "outline_approved"` | Step 2: show outline, get confirmation |
| **Auto-fill pending** | `plan_state.status === "outline_approved"` | Step 3: autonomous fill |
| **Auto-fill in progress** | `plan_state.status === "auto_filling"` | Step 3: resume from `current_checkpoint` |
| **Ready to finalize** | All checkpoints have actions | Step 4: finalize |
| **Already finalized** | `phases.plan.status === "finalized"` | Show status, suggest build |

## Execution Flow

### Step 1: Load Session

1. Read `SESSIONS_DIR/$1/state.json`
2. Validate spec status (see state table)
3. Read `SESSIONS_DIR/$1/spec.md`
4. Read `SKILL_DIR/plan/OVERVIEW.md`
5. If `$2 === "finalize"`, jump to Step 4

### Step 2: Generate + Approve Outline (ONLY user gate)

If no checkpoints exist:

1. Analyze spec goals, requirements, success criteria
2. Explore codebase for relevant patterns
3. Design 3–7 sequential checkpoints using **tracer bullet approach**:
   - CP1: minimal end-to-end slice
   - Subsequent CPs: add depth, features, complexity
   - Each CP produces testable, working code
4. Create initial `plan.json` from `SKILL_DIR/plan/templates/plan.json`:
   - Checkpoint titles, goals, prerequisites, file_context, testing_strategy
   - `task_groups: []` (filled in Step 3)

**Tracer Bullet**: vertical slices, not horizontal layers.

Display outline and `AskUserQuestion`:
- Options: `"Approve outline"`, `"Adjust checkpoints"`, `"Cancel"`

If `"Adjust checkpoints"`: take feedback, regenerate, re-ask. Loop until approved or cancelled.

On approval, update `state.json`:
```json
{
  "plan_state": {
    "status": "outline_approved",
    "checkpoints_total": N,
    "checkpoints_detailed": 0,
    "current_checkpoint": 1,
    "last_updated": "[timestamp]"
  }
}
```

### Step 3: Autonomous Fill (NO user prompts)

Set `plan_state.status = "auto_filling"`.

Loop checkpoints depth-first from `current_checkpoint` to N. For each checkpoint:

**3a. Task Groups**
- Generate 1–3 task groups (id, title, objective, status="pending", tasks=[])
- Group by file type, feature area, or logical sequence
- Write `plan.json`
- Status line: `CP{n} → task_groups done ({count})`

**3b. Tasks** (per task group)
- Load IDK vocab from `SKILL_DIR/plan/idk/` if not already loaded
- For each task group, generate tasks:
  - `id`: `{group_id}.{n}` (e.g. `1.1.1`)
  - `title`: action verb + target
  - `file_path`: exact target file
  - `description`: WHAT + WHY (no implicit context)
  - `context.read_before`: `[{file, lines, purpose}]`
  - `context.related_files`: `[]`
  - `depends_on`: `[]` or explicit
  - `status`: `"pending"`
  - `actions`: `[]`
- **Self-containment test**: can an agent with only this task object execute it correctly? If not, add context.
- Write `plan.json`
- Status line: `CP{n} → tasks done ({count})`

**3c. Actions** (per task)
- For each task, generate IDK-formatted actions:
  - `id`: `{task_id}.{n}` (e.g. `1.1.1.1`)
  - `command`: IDK (e.g. `ADD FUNCTION validateInput()`)
  - `file`: target file
  - `status`: `"pending"`
- Use IDK vocabulary: CRUD (CREATE/UPDATE/DELETE), Actions (ADD/REMOVE/MOVE/REPLACE/MIRROR/APPEND), Language (VAR/FUNCTION/CLASS/TYPE/FILE), Refactoring (REFACTOR/RENAME/SPLIT/MERGE/EXTRACT)
- Write `plan.json`
- Status line: `CP{n} → actions done ({count})`

**3d. Advance state** after each checkpoint completes:
```json
{
  "plan_state": {
    "status": "auto_filling",
    "current_checkpoint": {n+1},
    "checkpoints_detailed": {n},
    "last_updated": "[timestamp]"
  }
}
```

No `AskUserQuestion` calls anywhere in Step 3.

### Step 4: Finalize + Review

When all checkpoints have actions (or `$2 === "finalize"`):

1. Verify every checkpoint → task_group → task has actions
2. Update `plan.json` `status: "complete"`
3. Update `state.json`:
```json
{
  "phases": {
    "plan": {
      "status": "finalized",
      "finalized_at": "[timestamp]"
    }
  },
  "plan_state": {
    "status": "finalized",
    "checkpoints_total": N,
    "checkpoints_detailed": N,
    "checkpoints_completed": []
  }
}
```

4. Display plan summary (checkpoint count, task group count, task count, action count)
5. Suggest: `/session:build $1`

## Behavior Notes

- **One gate only**: outline approval. After that, run to completion.
- **Interrupt-safe**: state.json tracks `current_checkpoint`. Re-invoking resumes from last incomplete CP.
- **Not for fine-grained control**: use `/session:plan` if you want to review each tier.
- **Not for trivial changes**: use `/session:quick-plan` for single-checkpoint chores.
- **Write-through**: every substep writes `plan.json` before advancing.
- **Terse status**: one line per substep; no verbose narration.
