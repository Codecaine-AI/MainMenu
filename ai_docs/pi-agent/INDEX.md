# Pi Coding Agent Documentation Index

> Scraped from https://pi.dev and https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent
> Real-world examples from https://github.com/disler/pi-vs-claude-code
> Last updated: 2026-03-17

## Core Concept

Pi is a fully customizable terminal-based AI coding agent. Customization is done via **extensions** (TypeScript plugins that hook into every aspect of the agent). The pi agent is built on top of a `@mariozechner/pi-coding-agent` npm package with a rich SDK and RPC API.

---

## Key Docs (Start Here)

| File | What it covers |
|------|---------------|
| [extensions.md](extensions.md) | **MOST IMPORTANT** — full extension API, all hooks, events, tools, UI widgets |
| [sdk.md](sdk.md) | Programmatic API to embed/control pi from TypeScript |
| [rpc.md](rpc.md) | RPC protocol — control pi from external processes (any language) |
| [tui.md](tui.md) | Terminal UI API — overlays, panels, widgets, rendering |
| [session.md](session.md) | Session lifecycle, turns, context management |
| [settings.md](settings.md) | All configuration options |
| [models.md](models.md) | Model configuration, provider setup |
| [providers.md](providers.md) | Built-in model providers (Anthropic, OpenAI, etc.) |
| [custom-provider.md](custom-provider.md) | Building custom model providers |
| [compaction.md](compaction.md) | Context compaction / summarization |
| [skills.md](skills.md) | Skills system (reusable prompt modules) |
| [packages.md](packages.md) | Package ecosystem overview |
| [keybindings.md](keybindings.md) | Keyboard shortcut customization |
| [themes.md](themes.md) | Theme customization |
| [tree.md](tree.md) | File tree integration |
| [json.md](json.md) | JSON tool / structured output |
| [widget-ordering.md](widget-ordering.md) | Widget render ordering (Map insertion order) |
| [prompt-templates.md](prompt-templates.md) | Prompt template system |
| [terminal-setup.md](terminal-setup.md) | Terminal setup requirements |
| [development.md](development.md) | Dev setup for contributing |
| [shell-aliases.md](shell-aliases.md) | Shell alias shortcuts |
| [tmux.md](tmux.md) | Tmux integration |
| [termux.md](termux.md) | Android/Termux support |
| [windows.md](windows.md) | Windows support |

---

## Extension Examples (Most Relevant for CEO Agents)

Located in `examples-extensions/`

| File | What it demonstrates |
|------|---------------------|
| [README.md](examples-extensions/README.md) | How to write and load extensions |
| [hello.ts](examples-extensions/hello.ts) | Minimal extension boilerplate |
| [preset.ts](examples-extensions/preset.ts) | Combining multiple extensions into a preset |
| [commands.ts](examples-extensions/commands.ts) | Adding custom slash commands |
| [tools.ts](examples-extensions/tools.ts) | Adding custom tools to the agent |
| [dynamic-tools.ts](examples-extensions/dynamic-tools.ts) | Tools that change at runtime |
| [tool-override.ts](examples-extensions/tool-override.ts) | Overriding/replacing built-in tools |
| [truncated-tool.ts](examples-extensions/truncated-tool.ts) | Tool output truncation |
| [system-prompt-header.ts](examples-extensions/system-prompt-header.ts) | Injecting content into system prompt |
| [input-transform.ts](examples-extensions/input-transform.ts) | Transform user input before sending |
| [message-renderer.ts](examples-extensions/message-renderer.ts) | Custom message rendering |
| [built-in-tool-renderer.ts](examples-extensions/built-in-tool-renderer.ts) | Custom rendering for built-in tools |
| [custom-header.ts](examples-extensions/custom-header.ts) | Custom TUI header |
| [custom-footer.ts](examples-extensions/custom-footer.ts) | Custom TUI footer |
| [status-line.ts](examples-extensions/status-line.ts) | Status line customization |
| [send-user-message.ts](examples-extensions/send-user-message.ts) | Programmatically send messages |
| [auto-commit-on-exit.ts](examples-extensions/auto-commit-on-exit.ts) | Hook into session exit |
| [bash-spawn-hook.ts](examples-extensions/bash-spawn-hook.ts) | Hook into bash tool execution |
| [confirm-destructive.ts](examples-extensions/confirm-destructive.ts) | Intercept and confirm destructive ops |
| [permission-gate.ts](examples-extensions/permission-gate.ts) | Permission/approval gates |
| [protected-paths.ts](examples-extensions/protected-paths.ts) | Protect file paths from modification |
| [dirty-repo-guard.ts](examples-extensions/dirty-repo-guard.ts) | Guard against dirty git state |
| [git-checkpoint.ts](examples-extensions/git-checkpoint.ts) | Auto git checkpoints |
| [handoff.ts](examples-extensions/handoff.ts) | Hand off to another agent/session |
| [subagent/](examples-extensions/subagent/) | **Multi-agent orchestration** — spawn and coordinate subagents |
| [plan-mode/](examples-extensions/plan-mode/) | Plan mode implementation |
| [sandbox/](examples-extensions/sandbox/) | Sandboxed execution environment |
| [session-name.ts](examples-extensions/session-name.ts) | Custom session naming |
| [shutdown-command.ts](examples-extensions/shutdown-command.ts) | Custom shutdown behavior |
| [qna.ts](examples-extensions/qna.ts) | Q&A interaction patterns |
| [question.ts](examples-extensions/question.ts) | Interactive question prompts |
| [questionnaire.ts](examples-extensions/questionnaire.ts) | Multi-step questionnaire UI |
| [modal-editor.ts](examples-extensions/modal-editor.ts) | Modal editor overlay |
| [minimal-mode.ts](examples-extensions/minimal-mode.ts) | Minimal/headless mode |
| [notify.ts](examples-extensions/notify.ts) | System notifications |
| [event-bus.ts](examples-extensions/event-bus.ts) | Extension event bus |
| [file-trigger.ts](examples-extensions/file-trigger.ts) | File-based triggers |
| [claude-rules.ts](examples-extensions/claude-rules.ts) | Inject rules into agent context |
| [custom-compaction.ts](examples-extensions/custom-compaction.ts) | Custom context compaction strategy |
| [provider-payload.ts](examples-extensions/provider-payload.ts) | Modify provider request payload |
| [inline-bash.ts](examples-extensions/inline-bash.ts) | Inline bash execution |
| [interactive-shell.ts](examples-extensions/interactive-shell.ts) | Interactive shell integration |
| [ssh.ts](examples-extensions/ssh.ts) | SSH remote execution |
| [todo.ts](examples-extensions/todo.ts) | Todo list extension |
| [summarize.ts](examples-extensions/summarize.ts) | Summarization extension |
| [reload-runtime.ts](examples-extensions/reload-runtime.ts) | Hot reload extensions |
| [model-status.ts](examples-extensions/model-status.ts) | Model usage status display |
| [timed-confirm.ts](examples-extensions/timed-confirm.ts) | Auto-confirming prompts with timeout |
| [rpc-demo.ts](examples-extensions/rpc-demo.ts) | RPC integration demo |
| [rpc-extension-ui.ts](examples-extensions/rpc-extension-ui.ts) | RPC + UI extension |

---

## SDK Examples

Located in `examples-sdk/`

| File | What it demonstrates |
|------|---------------------|
| [README.md](examples-sdk/README.md) | SDK usage overview |
| [01-minimal.ts](examples-sdk/01-minimal.ts) | Minimal SDK usage |
| [02-custom-model.ts](examples-sdk/02-custom-model.ts) | Custom model configuration |
| [03-custom-prompt.ts](examples-sdk/03-custom-prompt.ts) | Custom system prompt |
| [04-skills.ts](examples-sdk/04-skills.ts) | Skills via SDK |
| [05-tools.ts](examples-sdk/05-tools.ts) | Tools via SDK |
| [06-extensions.ts](examples-sdk/06-extensions.ts) | Extensions via SDK |
| [07-context-files.ts](examples-sdk/07-context-files.ts) | Context file injection |
| [08-prompt-templates.ts](examples-sdk/08-prompt-templates.ts) | Prompt templates |
| [09-api-keys-and-oauth.ts](examples-sdk/09-api-keys-and-oauth.ts) | Auth configuration |
| [10-settings.ts](examples-sdk/10-settings.ts) | Settings management |
| [11-sessions.ts](examples-sdk/11-sessions.ts) | Session management |
| [12-full-control.ts](examples-sdk/12-full-control.ts) | Full SDK control example |

---

## pi.dev Website Pages

| File | URL |
|------|-----|
| [pi-dev-home.md](pi-dev-home.md) | https://pi.dev/ |
| [pi-dev-packages.md](pi-dev-packages.md) | https://pi.dev/packages |

---

## Real-World Examples: `pi-vs-cc/` (github.com/disler/pi-vs-claude-code)

A full incremental project showing pi coding agent built out in production. **Study these before building the CEO agents** — they demonstrate all the patterns you need.

### Extensions (`pi-vs-cc/extensions/`)

| File | What it demonstrates |
|------|---------------------|
| [agent-chain.ts](pi-vs-cc/extensions/agent-chain.ts) | **Sequential agent chaining** — one agent's output feeds the next |
| [agent-team.ts](pi-vs-cc/extensions/agent-team.ts) | **Multi-agent team** — coordinate a named team of specialized agents |
| [pi-pi.ts](pi-vs-cc/extensions/pi-pi.ts) | **Pi orchestrating Pi** — meta-agent that spawns and routes to expert subagents |
| [subagent-widget.ts](pi-vs-cc/extensions/subagent-widget.ts) | TUI widget showing active subagent status |
| [cross-agent.ts](pi-vs-cc/extensions/cross-agent.ts) | Cross-agent communication patterns |
| [tilldone.ts](pi-vs-cc/extensions/tilldone.ts) | Run agent until task is complete (loop control) |
| [damage-control.ts](pi-vs-cc/extensions/damage-control.ts) | Safety rules enforcement extension |
| [purpose-gate.ts](pi-vs-cc/extensions/purpose-gate.ts) | Gate agent execution based on purpose/intent |
| [session-replay.ts](pi-vs-cc/extensions/session-replay.ts) | Replay a session from transcript |
| [system-select.ts](pi-vs-cc/extensions/system-select.ts) | Dynamic system prompt selection |
| [pure-focus.ts](pi-vs-cc/extensions/pure-focus.ts) | Minimal/distraction-free mode |
| [minimal.ts](pi-vs-cc/extensions/minimal.ts) | Barebones extension template |
| [tool-counter.ts](pi-vs-cc/extensions/tool-counter.ts) | Count and display tool usage |
| [tool-counter-widget.ts](pi-vs-cc/extensions/tool-counter-widget.ts) | TUI widget for tool counter |
| [theme-cycler.ts](pi-vs-cc/extensions/theme-cycler.ts) | Cycle through themes |
| [themeMap.ts](pi-vs-cc/extensions/themeMap.ts) | Theme mapping utility |

### Agent System Prompts (`pi-vs-cc/.pi/agents/`)

| File | Role |
|------|------|
| [pi-pi/pi-orchestrator.md](pi-vs-cc/.pi/agents/pi-pi/pi-orchestrator.md) | **Orchestrator** — routes to expert subagents |
| [pi-pi/agent-expert.md](pi-vs-cc/.pi/agents/pi-pi/agent-expert.md) | Agent architecture expert |
| [pi-pi/ext-expert.md](pi-vs-cc/.pi/agents/pi-pi/ext-expert.md) | Extension development expert |
| [pi-pi/cli-expert.md](pi-vs-cc/.pi/agents/pi-pi/cli-expert.md) | CLI usage expert |
| [pi-pi/config-expert.md](pi-vs-cc/.pi/agents/pi-pi/config-expert.md) | Configuration expert |
| [pi-pi/skill-expert.md](pi-vs-cc/.pi/agents/pi-pi/skill-expert.md) | Skills expert |
| [pi-pi/theme-expert.md](pi-vs-cc/.pi/agents/pi-pi/theme-expert.md) | Theme expert |
| [pi-pi/tui-expert.md](pi-vs-cc/.pi/agents/pi-pi/tui-expert.md) | TUI/UI expert |
| [pi-pi/prompt-expert.md](pi-vs-cc/.pi/agents/pi-pi/prompt-expert.md) | Prompt engineering expert |
| [pi-pi/keybinding-expert.md](pi-vs-cc/.pi/agents/pi-pi/keybinding-expert.md) | Keybindings expert |
| [bowser.md](pi-vs-cc/.pi/agents/bowser.md) | Browser automation agent |
| [planner.md](pi-vs-cc/.pi/agents/planner.md) | Planning agent |
| [plan-reviewer.md](pi-vs-cc/.pi/agents/plan-reviewer.md) | Plan review agent |
| [builder.md](pi-vs-cc/.pi/agents/builder.md) | Implementation agent |
| [reviewer.md](pi-vs-cc/.pi/agents/reviewer.md) | Code review agent |
| [documenter.md](pi-vs-cc/.pi/agents/documenter.md) | Documentation agent |
| [red-team.md](pi-vs-cc/.pi/agents/red-team.md) | Red-team / adversarial agent |
| [scout.md](pi-vs-cc/.pi/agents/scout.md) | Codebase exploration agent |
| [agent-chain.yaml](pi-vs-cc/.pi/agents/agent-chain.yaml) | Agent chain configuration |
| [teams.yaml](pi-vs-cc/.pi/agents/teams.yaml) | Team composition config |

### Specs & Config (`pi-vs-cc/`)

| File | What it covers |
|------|---------------|
| [README.md](pi-vs-cc/README.md) | Project overview and setup |
| [COMPARISON.md](pi-vs-cc/COMPARISON.md) | Pi vs Claude Code feature comparison |
| [PI_VS_OPEN_CODE.md](pi-vs-cc/PI_VS_OPEN_CODE.md) | Pi vs Open Code deep dive |
| [TOOLS.md](pi-vs-cc/TOOLS.md) | Available tools reference |
| [RESERVED_KEYS.md](pi-vs-cc/RESERVED_KEYS.md) | Reserved keybindings |
| [specs/agent-forge.md](pi-vs-cc/specs/agent-forge.md) | Agent creation workflow spec |
| [specs/agent-workflow.md](pi-vs-cc/specs/agent-workflow.md) | Multi-agent workflow patterns |
| [specs/pi-pi.md](pi-vs-cc/specs/pi-pi.md) | Pi-Pi orchestration spec |
| [specs/damage-control.md](pi-vs-cc/specs/damage-control.md) | Safety rules spec |
| [.pi/settings.json](pi-vs-cc/.pi/settings.json) | Pi settings configuration example |
| [.pi/damage-control-rules.yaml](pi-vs-cc/.pi/damage-control-rules.yaml) | Safety rules config |
| [.pi/skills/bowser.md](pi-vs-cc/.pi/skills/bowser.md) | Browser skill definition |
| [justfile](pi-vs-cc/justfile) | Project task runner |

---

## CEO Agent Build Notes

For the CEO & Board agent system in `specs/init.md`:

1. **Agent customization** → `extensions.md` + `examples-extensions/system-prompt-header.ts`
2. **Multi-agent orchestration** → `examples-extensions/subagent/` (spawn board members as subagents)
3. **Programmatic control / one-shot** → `sdk.md` + `examples-sdk/12-full-control.ts`
4. **Input gating (brief validation)** → `examples-extensions/file-trigger.ts` + `examples-extensions/qna.ts`
5. **Budget/time control** → `settings.md` + `examples-extensions/timed-confirm.ts`
6. **Chat UI / message rendering** → `tui.md` + `examples-extensions/message-renderer.ts`
7. **Disable user input mid-session** → `examples-extensions/minimal-mode.ts` + `rpc.md`
8. **Memo output + open in editor** → `examples-extensions/shutdown-command.ts`
9. **Domain restriction (crud: r)** → `extensions.md` (permission/domain APIs)
10. **Model per agent** → `models.md` + `examples-sdk/02-custom-model.ts`
