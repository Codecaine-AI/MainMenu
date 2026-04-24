---
description: Outline-gated stepped planning — approve outline, then fill one checkpoint per invocation
argument-hint: [session-id] [finalize]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion
model: opus
---

# Plan Mode (Stepped)

Outline-gated stepped planning. One user confirmation at the outline, then each invocation autonomously fills exactly **one** checkpoint (task_groups → tasks → actions) and stops. User reviews the filled checkpoint, optionally edits `plan.json`, then re-invokes to fill the next checkpoint.

Sibling to `/session:plan` (tier-by-tier interactive), `/session:plan-auto` (fill all CPs after outline), and `/session:quick-plan` (single-checkpoint autonomous). Pick a mode at start — no switching mid-flow.

## CRITICAL RULES

1. **NO SUB-AGENTS** — Execute everything directly in this conversation. Do NOT use the Task tool.
2. **ONE OUTLINE GATE** — Only one user confirmation: outline approval. After approval, each invocation fills one checkpoint without further prompts.
3. **ONE CHECKPOINT PER INVOCATION** — Fill exactly one checkpoint (the next unfilled one) then stop. Do NOT continue into the next checkpoint.
4. **JSON AS SOURCE OF TRUTH** — Write `plan.json` first; `plan.md` is auto-generated.
5. **WRITE BIT-BY-BIT** — Write `plan.json` after each substep (task_groups added, tasks added, actions added) so state is restartable if interrupted.
6. **SELF-CONTAINED TASKS** — Every task must be executable by an agent in a new session with zero prior context.
7. **PROGRESS VISIBILITY** — Emit one short status line per substep (e.g. `CP2 → task_groups done → tasks done → actions done`).
8. **AUTO-ADVANCE** — On re-invoke, resume at first checkpoint lacking actions. No explicit CP argument needed.

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
| **Outline needs approval** | Checkpoints exist, `plan_state.status !== "outline_approved"` and not `stepped_paused` | Step 2: show outline, get confirmation |
| **Next CP pending** | `plan_state.status` in `{"outline_approved", "stepped_paused"}`, unfilled CP exists | Step 3: fill next unfilled CP, then stop |
| **Ready to finalize** | All checkpoints have actions | Step 4: finalize |
| **Already finalized** | `phases.plan.status === "finalized"` | Show status, suggest build |

A checkpoint is "unfilled" if any task in it has no actions, any task_group has no tasks, or task_groups is empty.

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

Then proceed directly into Step 3 for CP1 in the same invocation.

### Step 3: Fill ONE Checkpoint (NO user prompts)

Determine target checkpoint: scan `plan.json` checkpoints in order; target = first checkpoint that is unfilled.

Set `plan_state.status = "stepped_filling"`, `current_checkpoint = {target}`.

For the target checkpoint only:

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

**3d. Pause state** after the target checkpoint completes:

If more unfilled checkpoints remain:
```json
{
  "plan_state": {
    "status": "stepped_paused",
    "current_checkpoint": {target + 1},
    "checkpoints_detailed": {target},
    "last_updated": "[timestamp]"
  }
}
```

Emit summary for the filled CP:
- CP number + title
- Task group count, task count, action count
- Files touched
- Next command: `/session:plan-stepped $1` to fill CP{target+1}
- Reminder: review `plan.json` / `plan.md` before next invocation; edit freely

**STOP.** Do not continue into the next checkpoint. No `AskUserQuestion` calls anywhere in Step 3.

If no unfilled checkpoints remain after filling target, fall through to Step 4.

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

- **One gate only**: outline approval. After that, each invocation fills one CP and stops.
- **Auto-advance**: re-invoke with the same command; it picks up the first unfilled CP. No CP argument needed.
- **User-editable between steps**: since execution stops between checkpoints, the user can edit `plan.json` directly before re-invoking. Honor any edits on resume.
- **Interrupt-safe**: state.json tracks `current_checkpoint`. Mid-checkpoint interruption resumes by regenerating/completing the current CP on next run.
- **Not for bulk fill**: use `/session:plan-auto` to fill all CPs after outline.
- **Not for fine-grained control**: use `/session:plan` to review each tier (task_groups, tasks, actions).
- **Not for trivial changes**: use `/session:quick-plan` for single-checkpoint chores.
- **Write-through**: every substep writes `plan.json` before advancing.
- **Terse status**: one line per substep; no verbose narration.
