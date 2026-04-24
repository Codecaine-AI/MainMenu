#!/usr/bin/env bash
set -euo pipefail

# ── build-runner.sh ─────────────────────────────────────────────────
# Runs /session:build-background in a loop until all checkpoints are
# executed and the build is complete. Each iteration spawns a fresh
# `claude -p` in --dangerously-skip-permissions mode with streaming
# JSON output for real-time progress visibility.
#
# Usage:
#   ./scripts/build-runner.sh <session-id> [--dry-run] [--delay SECS] [--verbose]
#
# Options:
#   --dry-run   Print what would run without invoking claude
#   --delay N   Seconds to wait between invocations (default: 10)
#   --verbose   Show tool result snippets (not just tool calls)
# ────────────────────────────────────────────────────────────────────

SESSIONS_DIR=".spectre/sessions"
DELAY=10
DRY_RUN=false
VERBOSE=false
LOG_DIR=""

# ── Colors ──────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  C_RESET='\033[0m'
  C_DIM='\033[2m'
  C_BOLD='\033[1m'
  C_CYAN='\033[36m'
  C_GREEN='\033[32m'
  C_YELLOW='\033[33m'
  C_RED='\033[31m'
  C_MAGENTA='\033[35m'
  C_BLUE='\033[34m'
else
  C_RESET='' C_DIM='' C_BOLD='' C_CYAN='' C_GREEN=''
  C_YELLOW='' C_RED='' C_MAGENTA='' C_BLUE=''
fi

# ── Parse args ──────────────────────────────────────────────────────
SESSION_ID=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)   DRY_RUN=true; shift ;;
    --delay)     DELAY="$2"; shift 2 ;;
    --verbose)   VERBOSE=true; shift ;;
    -h|--help)
      echo "Usage: $0 <session-id> [--dry-run] [--delay SECS] [--verbose]"
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2; exit 1 ;;
    *)
      if [[ -z "$SESSION_ID" ]]; then
        SESSION_ID="$1"
      else
        echo "Unexpected argument: $1" >&2; exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$SESSION_ID" ]]; then
  echo "Error: session-id is required" >&2
  echo "Usage: $0 <session-id> [--dry-run] [--delay SECS] [--verbose]" >&2
  exit 1
fi

STATE_FILE="$SESSIONS_DIR/$SESSION_ID/state.json"
PLAN_FILE="$SESSIONS_DIR/$SESSION_ID/plan.json"

if [[ ! -f "$STATE_FILE" ]]; then
  echo "Error: state file not found: $STATE_FILE" >&2
  exit 1
fi

# Set up log directory
LOG_DIR="$SESSIONS_DIR/$SESSION_ID/logs"
mkdir -p "$LOG_DIR"

# ── Helpers ─────────────────────────────────────────────────────────
read_state() {
  jq -r "$1" "$STATE_FILE" 2>/dev/null
}

read_plan() {
  jq -r "$1" "$PLAN_FILE" 2>/dev/null
}

timestamp() {
  date "+%H:%M:%S"
}

divider() {
  echo -e "${C_DIM}$(printf '%.0s─' {1..60})${C_RESET}"
}

# ── Status display ──────────────────────────────────────────────────
show_status() {
  local current_phase build_status cp_total cp_completed cp_current

  current_phase=$(read_state '.current_phase // "unknown"')
  build_status=$(read_state '.build.status // "pending"')
  cp_total=$(read_state '.plan_state.checkpoints_total // 0')
  cp_completed=$(read_state '.build.data.checkpoints_completed | length // 0' 2>/dev/null || echo "0")
  cp_current=$(read_state '.build.data.current_checkpoint // .plan_state.current_checkpoint // "?"')

  divider
  echo -e "  ${C_BOLD}Session:${C_RESET}      $SESSION_ID"
  echo -e "  ${C_BOLD}Phase:${C_RESET}        $current_phase"
  echo -e "  ${C_BOLD}Build status:${C_RESET} $build_status"
  echo -e "  ${C_BOLD}Progress:${C_RESET}     $cp_completed / $cp_total checkpoints built"
  echo -e "  ${C_BOLD}Next CP:${C_RESET}      $cp_current"
  divider
}

# ── Stream parser ──────────────────────────────────────────────────
parse_stream() {
  local log_file="$1"
  local tool_count=0
  local edit_count=0
  local bash_count=0

  while IFS= read -r line; do
    # Write raw line to log
    echo "$line" >> "$log_file"

    local msg_type
    msg_type=$(echo "$line" | jq -r '.type // empty' 2>/dev/null) || continue

    case "$msg_type" in
      assistant)
        # Extract tool_use blocks
        local tools
        tools=$(echo "$line" | jq -r '
          .message.content[]? |
          select(.type == "tool_use") |
          "\(.name)\t\(.input | tostring | .[0:200])"
        ' 2>/dev/null) || true

        if [[ -n "$tools" ]]; then
          while IFS=$'\t' read -r tool_name tool_input; do
            tool_count=$((tool_count + 1))

            # Color-code by tool type
            local tool_color="$C_CYAN"
            case "$tool_name" in
              Edit|Write|MultiEdit)
                tool_color="$C_YELLOW"
                edit_count=$((edit_count + 1))
                ;;
              Bash)
                tool_color="$C_MAGENTA"
                bash_count=$((bash_count + 1))
                ;;
              Read|Glob|Grep) tool_color="$C_BLUE" ;;
            esac

            # Format the input for display
            local display_input
            case "$tool_name" in
              Read)
                display_input=$(echo "$tool_input" | jq -r '.file_path // empty' 2>/dev/null)
                ;;
              Edit)
                local edit_file
                edit_file=$(echo "$tool_input" | jq -r '.file_path // empty' 2>/dev/null)
                display_input="$edit_file"
                ;;
              Write)
                display_input=$(echo "$tool_input" | jq -r '.file_path // empty' 2>/dev/null)
                ;;
              Bash)
                display_input=$(echo "$tool_input" | jq -r '.command // empty' 2>/dev/null | head -c 80)
                ;;
              Grep)
                local pattern path
                pattern=$(echo "$tool_input" | jq -r '.pattern // empty' 2>/dev/null)
                path=$(echo "$tool_input" | jq -r '.path // empty' 2>/dev/null)
                display_input="$pattern in $path"
                ;;
              Glob)
                display_input=$(echo "$tool_input" | jq -r '.pattern // empty' 2>/dev/null)
                ;;
              Task)
                display_input=$(echo "$tool_input" | jq -r '.description // .prompt // empty' 2>/dev/null | head -c 80)
                ;;
              *)
                display_input=$(echo "$tool_input" | head -c 80)
                ;;
            esac

            echo -e "  ${C_DIM}│${C_RESET} ${tool_color}${tool_name}${C_RESET} ${C_DIM}${display_input}${C_RESET}"
          done <<< "$tools"
        fi

        # Extract text blocks — show progress-relevant lines
        local text
        text=$(echo "$line" | jq -r '
          .message.content[]? |
          select(.type == "text") |
          .text
        ' 2>/dev/null) || true

        if [[ -n "$text" ]]; then
          while IFS= read -r text_line; do
            if [[ -n "$text_line" ]]; then
              # Show build status lines, checkpoint progress, task completions, git commits
              if echo "$text_line" | grep -qiE '(CP[0-9]|checkpoint|task.*complete|commit|verification|devnote|error|fail|blocked|Build Phase|Build Complete)'; then
                echo -e "  ${C_DIM}│${C_RESET} ${C_GREEN}${text_line}${C_RESET}"
              fi
            fi
          done <<< "$text"
        fi
        ;;

      user)
        if $VERBOSE; then
          local result_snippet
          result_snippet=$(echo "$line" | jq -r '
            .message.content[]? |
            select(.type == "tool_result") |
            .content // "" |
            if type == "string" then .[0:120] else tostring[0:120] end
          ' 2>/dev/null) || true

          if [[ -n "$result_snippet" ]]; then
            echo -e "  ${C_DIM}│  -> ${result_snippet}${C_RESET}"
          fi
        fi
        ;;

      result)
        local cost duration subtype
        cost=$(echo "$line" | jq -r '.total_cost_usd // "?"' 2>/dev/null)
        duration=$(echo "$line" | jq -r '.duration_ms // 0' 2>/dev/null)
        subtype=$(echo "$line" | jq -r '.subtype // "unknown"' 2>/dev/null)
        local duration_s
        duration_s=$(echo "scale=1; ${duration:-0} / 1000" | bc 2>/dev/null || echo "?")

        echo -e "  ${C_DIM}│${C_RESET}"
        if [[ "$subtype" == "success" ]]; then
          echo -e "  ${C_DIM}│${C_RESET} ${C_GREEN}Done${C_RESET} — ${tool_count} tools (${edit_count} edits, ${bash_count} bash), ${duration_s}s, \$${cost}"
        else
          echo -e "  ${C_DIM}│${C_RESET} ${C_RED}Finished (${subtype})${C_RESET} — ${tool_count} tools, ${duration_s}s, \$${cost}"
        fi
        ;;
    esac
  done
}

# ── Completion check ────────────────────────────────────────────────
is_done() {
  local build_status current_phase
  build_status=$(read_state '.build.status')
  current_phase=$(read_state '.current_phase')

  [[ "$build_status" == "completed" ]] || \
  [[ "$current_phase" == "docs" ]] || \
  [[ "$current_phase" == "complete" ]]
}

is_plan_finalized() {
  local plan_status
  plan_status=$(read_state '.plan.status')
  [[ "$plan_status" == "finalized" ]]
}

is_paused_or_failed() {
  local build_status
  build_status=$(read_state '.build.status')
  [[ "$build_status" == "paused" ]] || [[ "$build_status" == "failed" ]]
}

# ── Main loop ───────────────────────────────────────────────────────
echo ""
echo -e "  ${C_BOLD}build-runner${C_RESET}: automated build-background executor"
echo -e "  ${C_DIM}logs: $LOG_DIR/${C_RESET}"
echo ""
show_status

if ! is_plan_finalized; then
  echo ""
  echo -e "  ${C_RED}[!]${C_RESET} Plan is not finalized."
  echo "      Run '/session:plan-stepped $SESSION_ID' or '/session:plan-auto $SESSION_ID'"
  echo "      to finalize the plan first."
  echo ""
  exit 1
fi

if is_done; then
  echo ""
  echo -e "  ${C_GREEN}[OK]${C_RESET} Build is already complete. Nothing to do."
  echo ""
  exit 0
fi

if is_paused_or_failed; then
  BUILD_STATUS=$(read_state '.build.status')
  echo ""
  echo -e "  ${C_YELLOW}[!]${C_RESET} Build is $BUILD_STATUS."
  echo "      Use '/session:build-interactive $SESSION_ID' to investigate,"
  echo "      then re-run this script to continue."
  echo ""
  echo "  Proceeding anyway in 5s... (Ctrl-C to cancel)"
  sleep 5
fi

ITERATION=0

while true; do
  ITERATION=$((ITERATION + 1))

  if is_done; then
    echo ""
    show_status
    echo -e "  ${C_GREEN}[OK]${C_RESET} Build complete after $ITERATION iteration(s)."
    echo -e "  ${C_DIM}Full logs: $LOG_DIR/${C_RESET}"
    echo ""
    exit 0
  fi

  CP_CURRENT=$(read_state '.build.data.current_checkpoint // .plan_state.current_checkpoint // "?"')
  CP_TOTAL=$(read_state '.plan_state.checkpoints_total // "?"')
  CP_COMPLETED=$(read_state '.build.data.checkpoints_completed | length // 0' 2>/dev/null || echo "0")

  # Get checkpoint title from plan.json
  CP_TITLE=""
  if [[ -f "$PLAN_FILE" ]] && [[ "$CP_CURRENT" != "?" ]]; then
    CP_IDX=$((CP_CURRENT - 1))
    CP_TITLE=$(read_plan ".checkpoints[$CP_IDX].title // \"\"")
  fi

  echo ""
  echo -e "  ${C_CYAN}[$(timestamp)]${C_RESET} Iteration $ITERATION — building CP${CP_CURRENT} of ${CP_TOTAL} (${CP_COMPLETED} done)"
  if [[ -n "$CP_TITLE" ]]; then
    echo -e "  ${C_CYAN}[$(timestamp)]${C_RESET} ${C_BOLD}CP${CP_CURRENT}:${C_RESET} $CP_TITLE"
  fi

  PROMPT="/session:build-background $SESSION_ID"

  if $DRY_RUN; then
    echo -e "  ${C_YELLOW}[dry-run]${C_RESET} Would run: claude -p --output-format stream-json \"$PROMPT\""
    exit 0
  fi

  LOG_FILE="$LOG_DIR/build-cp${CP_CURRENT}-$(date +%Y%m%d-%H%M%S).jsonl"
  echo -e "  ${C_CYAN}[$(timestamp)]${C_RESET} Logging to: ${C_DIM}${LOG_FILE}${C_RESET}"
  divider

  if claude -p \
    --dangerously-skip-permissions \
    --model opus \
    --output-format stream-json \
    "$PROMPT" 2>/dev/null | parse_stream "$LOG_FILE"; then
    echo ""
    echo -e "  ${C_CYAN}[$(timestamp)]${C_RESET} Invocation completed successfully"
  else
    EXIT_CODE=$?
    echo ""
    echo -e "  ${C_RED}[$(timestamp)]${C_RESET} claude exited with code $EXIT_CODE"
    echo -e "  Pausing — check ${C_DIM}${LOG_FILE}${C_RESET} and re-run if needed."
    show_status
    exit $EXIT_CODE
  fi

  show_status

  if ! is_done; then
    echo -e "  ${C_DIM}[$(timestamp)] Waiting ${DELAY}s before next checkpoint...${C_RESET}"
    sleep "$DELAY"
  fi
done
