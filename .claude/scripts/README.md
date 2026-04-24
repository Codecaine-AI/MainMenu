# Session Runner Scripts

Automated runners that loop `claude -p` with streaming output so you don't have to re-invoke session skills manually between checkpoints.

## plan-runner.sh

Runs `/session:plan-stepped` in a loop until all checkpoints are filled and the plan is finalized.

```bash
# Basic usage
.claude/scripts/plan-runner.sh <session-id>

# With options
.claude/scripts/plan-runner.sh <session-id> --delay 10 --verbose

# Dry run (preview without invoking claude)
.claude/scripts/plan-runner.sh <session-id> --dry-run
```

**Prerequisites:** The outline must already be approved interactively (run `/session:plan-stepped <id>` once first to approve the outline).

## build-runner.sh

Runs `/session:build-background` in a loop until all checkpoints are built.

```bash
# Basic usage
.claude/scripts/build-runner.sh <session-id>

# With options
.claude/scripts/build-runner.sh <session-id> --delay 15 --verbose

# Dry run
.claude/scripts/build-runner.sh <session-id> --dry-run
```

**Prerequisites:** The plan must be finalized first.

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--delay N` | 5 (plan) / 10 (build) | Seconds to wait between invocations |
| `--verbose` | off | Show tool result snippets under each tool call |
| `--dry-run` | off | Preview what would run without invoking claude |

## What you see

Live streaming output, color-coded by tool type:

- **Blue** — `Read`, `Glob`, `Grep` (file reads)
- **Yellow** — `Edit`, `Write` (file mutations)
- **Magenta** — `Bash` (shell commands)
- **Cyan** — everything else

Each invocation ends with a summary: tool count, duration, and cost.

## Logs

Raw JSONL logs are written to `.spectre/sessions/<id>/logs/` with one file per checkpoint invocation:

```
.spectre/sessions/<id>/logs/
├── plan-cp2-20260423-170500.jsonl
├── plan-cp3-20260423-170830.jsonl
├── build-cp1-20260423-171200.jsonl
└── ...
```

These contain the full `stream-json` output from each `claude -p` call for replay or debugging.

## Typical workflow

```bash
# 1. Create session and approve outline interactively
#    (inside claude) /session:plan-stepped <session-id>

# 2. Let the plan runner fill all remaining checkpoints
.claude/scripts/plan-runner.sh <session-id>

# 3. Let the build runner execute all checkpoints
.claude/scripts/build-runner.sh <session-id>
```
