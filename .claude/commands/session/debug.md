---
description: Load completed session context for post-build debugging
argument-hint: <session-id>
allowed-tools: Read, Glob, Grep, Bash, Edit, Write, AskUserQuestion
model: opus
---

<purpose>
    - Load completed session context for post-build debugging
    - Provide full understanding of what was built before debugging
    - Capture debug findings in dev-notes.md for traceability
</purpose>

<key_knowledge>
    - Session artifacts: state.json, spec.md, plan.json, dev-notes.json
    - Completed checkpoints and their commits
    - Git history and file changes per checkpoint
</key_knowledge>

<goal>
    - Give agent full context of completed session
    - Debug issues collaboratively with user
    - Document findings in dev-notes.md
</goal>

<workflow>
    <overview>
        1. Load session context (spec, plan, state, commits)
        2. Summarize what was built
        3. Ask what to debug
        4. Investigate and document findings
    </overview>

    <inputs>
        <input name="session_id" type="string" required="true">
            Session identifier (e.g., 2026-01-15_my-feature_abc123)
        </input>
    </inputs>

    <variables>
        SESSIONS_DIR = .spectre/sessions
    </variables>

    <phase id="1" name="Load Session Context">
        <action>Read `SESSIONS_DIR/{session_id}/state.json`</action>
        <action>Read `SESSIONS_DIR/{session_id}/spec.md`</action>
        <action>Read `SESSIONS_DIR/{session_id}/plan.json`</action>
        <action>Read `SESSIONS_DIR/{session_id}/dev-notes.json` (if exists)</action>
        <action>Read `SESSIONS_DIR/{session_id}/dev-notes.md` (if exists)</action>
        <action>Run `git log --oneline` to get checkpoint commits from state.json</action>
    </phase>

    <phase id="2" name="Display Session Summary">
        <action>
            Display comprehensive context:
            ```
            ## Debug Session

            **Session**: {session_id}
            **Phase**: {current_phase} (Build {complete|in-progress})

            ---

            ### What Was Built

            **Goals** (from spec):
            {high-level goals summarized}

            **Checkpoints Completed**:
            {foreach checkpoint in build_progress.checkpoints_completed}
            - CP{N}: {checkpoint title} ({commit sha})
            {/foreach}

            **Key Files Changed**:
            {list major files touched across all checkpoints}

            ---

            ### Dev Notes (if any)
            {summary of existing dev-notes.json entries}

            ---

            **What needs debugging?**
            ```
        </action>
        <action>Await user response describing what to debug</action>
    </phase>

    <phase id="3" name="Debug Investigation">
        <principles>
            - Interactive - confirm before major actions
            - Share findings as you go
            - Follow user's lead on what to investigate
        </principles>

        <actions>
            <action name="investigate">
                - Use Read, Grep, Glob to explore the issue
                - Reference checkpoint context (what was changed and why)
                - Check git diff for specific checkpoints if relevant
                - Run tests or repro steps as needed
            </action>
            <action name="document">
                - Write findings to `dev-notes.md` as you discover them
                - Use clear sections: Problem, Investigation, Findings, Resolution
            </action>
        </actions>
    </phase>

    <phase id="4" name="Document Findings">
        <action>
            Ensure `dev-notes.md` contains investigation results:
            ```markdown
            # Dev Notes

            ## {Date} - {Issue Summary}

            ### Problem
            {What was reported/observed}

            ### Investigation
            {Steps taken, what was checked}

            ### Findings
            {Root cause or relevant discoveries}

            ### Resolution
            {Fix applied or next steps}
            ```
        </action>
    </phase>

    <global_constraints>
        - WAIT for user to describe what to debug before investigating
        - Document findings in dev-notes.md as you work
        - Reference plan.json checkpoints for context on what was changed where
    </global_constraints>
</workflow>

<dev_notes_format>
dev-notes.md is human-readable markdown that accumulates debug entries:

```markdown
# Dev Notes

## 2026-04-21 - TreeView not expanding on click

### Problem
User clicks node, nothing happens. Expected: children expand.

### Investigation
- Checked TreeView.tsx click handler
- Verified event propagation not blocked
- Found state update but no re-render

### Findings
Root cause: useState closure capturing stale tree data.

### Resolution
Added key prop to force re-render on data change.

---

## 2026-04-20 - SSE events not arriving

### Problem
...
```
</dev_notes_format>

<important_rules>
    1. Always load full session context before investigating
    2. Wait for user to describe the problem - don't assume
    3. Document findings in dev-notes.md as investigation progresses
    4. Reference checkpoint context when explaining what code does
</important_rules>
