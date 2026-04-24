---
description: Gain deep understanding of the Pi coding agent harness — extensions, SDK, TUI, multi-agent patterns, and real-world production examples
---

# Prime Pi Agent

Build comprehensive understanding of the Pi coding agent platform, with emphasis on extensions as the primary customization mechanism, and multi-agent orchestration patterns.

## Read

### Core Documentation (Required)

Read these files first to understand the platform:

- `ai_docs/pi-agent/INDEX.md` — Full documentation index and build notes
- `ai_docs/pi-agent/extensions.md` — **MOST IMPORTANT** — full extension API, hooks, events, tools, UI widgets
- `ai_docs/pi-agent/sdk.md` — Programmatic SDK for embedding/controlling pi from TypeScript
- `ai_docs/pi-agent/tui.md` — Terminal UI API — overlays, panels, widgets, rendering
- `ai_docs/pi-agent/settings.md` — All configuration options
- `ai_docs/pi-agent/themes.md` — Theme customization (pure JSON)
- `ai_docs/pi-agent/skills.md` — Skills system (reusable prompt modules)
- `ai_docs/pi-agent/session.md` — Session lifecycle, turns, context management

### Extension Examples (Study These)

Read the examples README and key extension files to understand real patterns:

- `ai_docs/pi-agent/examples-extensions/README.md` — Overview of all extension examples
- `ai_docs/pi-agent/examples-extensions/hello.ts` — Minimal extension boilerplate
- `ai_docs/pi-agent/examples-extensions/tools.ts` — Custom tools
- `ai_docs/pi-agent/examples-extensions/commands.ts` — Custom slash commands
- `ai_docs/pi-agent/examples-extensions/system-prompt-header.ts` — Injecting content into system prompt
- `ai_docs/pi-agent/examples-extensions/input-transform.ts` — Transform user input before sending
- `ai_docs/pi-agent/examples-extensions/permission-gate.ts` — Permission/approval gates
- `ai_docs/pi-agent/examples-extensions/tool-override.ts` — Override built-in tools
- `ai_docs/pi-agent/examples-extensions/dynamic-tools.ts` — Runtime tool registration
- `ai_docs/pi-agent/examples-extensions/event-bus.ts` — Inter-extension communication
- `ai_docs/pi-agent/examples-extensions/custom-compaction.ts` — Custom context compaction
- `ai_docs/pi-agent/examples-extensions/status-line.ts` — Status line customization

### SDK Examples (Skim)

- `ai_docs/pi-agent/examples-sdk/README.md` — SDK usage overview
- `ai_docs/pi-agent/examples-sdk/01-minimal.ts` — Minimal headless agent
- `ai_docs/pi-agent/examples-sdk/06-extensions.ts` — Loading extensions via SDK
- `ai_docs/pi-agent/examples-sdk/12-full-control.ts` — Full programmatic control

### Multi-Agent Patterns (Production Examples)

Read the pi-vs-cc real-world orchestration extensions:

- `ai_docs/pi-agent/pi-vs-cc/extensions/agent-chain.ts` — Sequential agent chaining
- `ai_docs/pi-agent/pi-vs-cc/extensions/agent-team.ts` — Parallel multi-agent team with routing
- `ai_docs/pi-agent/pi-vs-cc/extensions/pi-pi.ts` — Meta-orchestrator spawning expert subagents
- `ai_docs/pi-agent/pi-vs-cc/extensions/subagent-widget.ts` — TUI widget for subagent status
- `ai_docs/pi-agent/pi-vs-cc/extensions/damage-control.ts` — Safety rules enforcement
- `ai_docs/pi-agent/pi-vs-cc/specs/pi-pi.md` — Pi-Pi orchestration spec
- `ai_docs/pi-agent/pi-vs-cc/specs/agent-workflow.md` — Multi-agent workflow patterns

### Agent System Prompts (Reference)

- `ai_docs/pi-agent/pi-vs-cc/.pi/agents/pi-pi/pi-orchestrator.md` — Orchestrator prompt
- `ai_docs/pi-agent/pi-vs-cc/.pi/agents/pi-pi/ext-expert.md` — Extension expert prompt
- `ai_docs/pi-agent/pi-vs-cc/.pi/agents/builder.md` — Builder agent prompt
- `ai_docs/pi-agent/pi-vs-cc/.pi/agents/teams.yaml` — Team composition config

### Our Current Pi Setup (Context)

- `.pi/SYSTEM.md` — Our project's Pi system prompt
- `.pi/settings.json` — Our Pi settings
- `.pi/lib/` — Our custom Pi extensions
- `.claude/agents/meta-pi-agent.md` — Our meta-agent definition for building Pi agents

## Be Aware Of

### Additional Reference Docs
Located at `ai_docs/pi-agent/`:
- `compaction.md` — Context compaction strategies
- `keybindings.md` — Keyboard shortcuts
- `models.md` — Model configuration and providers
- `custom-provider.md` — Building custom model providers
- `rpc.md` — RPC protocol for external control
- `prompt-templates.md` — Prompt template system

### Comparison Docs
Located at `ai_docs/pi-agent/pi-vs-cc/`:
- `COMPARISON.md` — Pi vs Claude Code feature comparison
- `PI_VS_OPEN_CODE.md` — Pi vs Open Code deep dive
- `TOOLS.md` — Available tools reference

## Report

After reading, provide a structured summary covering:

1. **Extension API** — The `ExtensionAPI` interface, hook system (`pi.on()`), and lifecycle events
2. **Custom Tools** — How to register tools (`pi.registerTool()`), parameter schemas (TypeBox), state persistence via details
3. **Commands & UI** — Custom commands (`pi.registerCommand()`), TUI widgets (`ctx.ui.*`), status lines, overlays
4. **System Prompt Control** — `systemPromptAppend`, input transforms, context injection
5. **Multi-Agent Patterns** — The three patterns: agent-chain (sequential), agent-team (parallel/routed), pi-pi (meta-orchestrator)
6. **SDK vs Extensions** — When to use each: extensions for UI/behavior, SDK for headless/programmatic
7. **Our Setup** — What we have in `.pi/` and how it relates to the broader platform
8. **Key Gotchas** — StringEnum for Google compatibility, state persistence via details, `bun` over `npm`
