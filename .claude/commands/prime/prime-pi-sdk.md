---
description: Gain focused understanding of the Pi SDK — programmatic control, all SDK examples, with minimal general Pi context
---

# Prime Pi SDK

Build deep understanding of the Pi SDK for embedding/controlling Pi from TypeScript. Focus on SDK usage patterns via exhaustive example walkthrough. Only minimal general Pi context — skip TUI/theme/keybinding depth.

## Read

### Minimal Pi Context (Required, Skim)

Enough general Pi to make SDK sensible — no more.

- `ai_docs/pi-agent/INDEX.md` — doc map, orient only
- `ai_docs/pi-agent/README.md` — what Pi is
- `ai_docs/pi-agent/session.md` — session lifecycle, turns, context (SDK drives these)
- `ai_docs/pi-agent/extensions.md` — skim extension API (SDK can load extensions)
- `ai_docs/pi-agent/skills.md` — skim (SDK can register skills)
- `ai_docs/pi-agent/settings.md` — skim config surface (SDK overrides settings)
- `ai_docs/pi-agent/models.md` — model/provider config (SDK picks model)

### SDK Core (Required, Deep)

- `ai_docs/pi-agent/sdk.md` — **PRIMARY** — full SDK API surface, types, entry points

### SDK Examples (Required, All)

Read every example. These are the canonical usage patterns.

- `ai_docs/pi-agent/examples-sdk/README.md` — example index + running notes
- `ai_docs/pi-agent/examples-sdk/01-minimal.ts` — smallest headless agent
- `ai_docs/pi-agent/examples-sdk/02-custom-model.ts` — custom model/provider selection
- `ai_docs/pi-agent/examples-sdk/03-custom-prompt.ts` — custom system prompt
- `ai_docs/pi-agent/examples-sdk/04-skills.ts` — registering/using skills
- `ai_docs/pi-agent/examples-sdk/05-tools.ts` — custom tools via SDK
- `ai_docs/pi-agent/examples-sdk/06-extensions.ts` — loading extensions programmatically
- `ai_docs/pi-agent/examples-sdk/07-context-files.ts` — injecting context files
- `ai_docs/pi-agent/examples-sdk/08-prompt-templates.ts` — prompt templates
- `ai_docs/pi-agent/examples-sdk/09-api-keys-and-oauth.ts` — auth: API keys + OAuth
- `ai_docs/pi-agent/examples-sdk/10-settings.ts` — settings overrides
- `ai_docs/pi-agent/examples-sdk/11-sessions.ts` — session management / persistence
- `ai_docs/pi-agent/examples-sdk/12-full-control.ts` — full programmatic control — orchestration surface

### Adjacent Reference (Be Aware)

Pull only if SDK example references them.

- `ai_docs/pi-agent/custom-provider.md` — building custom model providers
- `ai_docs/pi-agent/prompt-templates.md` — template system
- `ai_docs/pi-agent/rpc.md` — RPC protocol (external control alternative to SDK)
- `ai_docs/pi-agent/compaction.md` — context compaction (SDK exposes hooks)

### Our Usage (Context)

- `.pi/settings.json` — our Pi config
- `.pi/lib/` — our extensions (loadable via SDK)

## Skip

Do NOT read unless referenced by an SDK example:
- `tui.md`, `themes.md`, `keybindings.md`, `terminal-setup.md`, `tmux.md`, `termux.md`
- `examples-extensions/**` (extension-authoring focus, not SDK)
- `pi-vs-cc/**` (orchestration case studies, separate concern)
- `examples-advanced/**` (agent system prompts, not SDK mechanics)

## Report

After reading, produce a structured summary:

1. **SDK Entry Points** — main exported factory/class, instantiation shape, lifecycle (start/turn/stop)
2. **Configuration Surface** — model, provider, settings, API keys/OAuth, system prompt, context files
3. **Capability Injection** — how SDK registers tools, skills, extensions, prompt templates
4. **Session Control** — creating, resuming, persisting, introspecting sessions; turn loop
5. **Full Control Pattern** — what `12-full-control.ts` exposes beyond simple usage (streaming, interrupts, state access)
6. **Auth Flow** — API key vs OAuth paths, where creds live, how to swap providers
7. **SDK vs Extensions vs RPC** — pick matrix: when each fits
8. **Gotchas** — runtime requirements (bun), type schemas (TypeBox/StringEnum), async patterns, state persistence rules surfaced in examples
