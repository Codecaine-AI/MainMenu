---
description: Gain deep understanding of the agent kernel — boot-time registry, spawn pipeline, per-agent context resolvers, six-kind loader catalog, and multi-agent coordination
---

# Prime Agent Kernel

Build understanding of `agent-kernel/` — the engine that declares, validates, loads, and spawns every agent (phase agents + shared subagents). Static system prompt frozen at session creation; dynamic context assembled per-spawn and injected as a `CustomMessageEntry`.

## Read

### Docs (Required)

- docs/20-implementation/10-backend/10-agent-kernel/00-overview.md — file tree + key decisions
- docs/20-implementation/10-backend/10-agent-kernel/10-pipeline.md — six-phase spawn sequence

### Kernel Source (Required)

Public surface + ALS scope:
- apps/backend/src/agent-kernel/index.ts
- apps/backend/src/agent-kernel/run-context.ts

Spawn orchestrator (the builder — ≤50 LOC body):
- apps/backend/src/agent-kernel/agent-spawning/agent-builder.ts

Boot registry + parser:
- apps/backend/src/agent-catalog/registry/registry.ts
- apps/backend/src/agent-catalog/parsing/frontmatter-parser.ts

Build sub-modules (one file per phase):
- apps/backend/src/agent-kernel/agent-spawning/agent-factory/artifact-builder.ts
- apps/backend/src/agent-kernel/agent-spawning/pi-session-factory/create-session.ts
- apps/backend/src/agent-kernel/agent-spawning/context/context-assembler.ts
- apps/backend/src/agent-kernel/agent-spawning/context/accumulation-guard.ts
- apps/backend/src/agent-kernel/agent-spawning/context/loaders/index.ts

Runtime coordination + hooks:
- apps/backend/src/agent-kernel/run/subagents/manager.ts
- apps/backend/src/agent-kernel/run/hooks/domain-guard.ts

### Example Agent

- apps/backend/src/agent-catalog/agents/spec/agent.md
- apps/backend/src/agent-catalog/agents/spec/context.ts
- apps/backend/src/agent-catalog/agents/spec/index.ts

## Be Aware Of

### Deeper-dive docs (read only if relevant)
- `10-agent-kernel/20-registry.md` — AggregateError shape, name collisions, CI enforcement
- `10-agent-kernel/30-adapters.md` — pi-SDK seam, tool scoping rules, model fuzzy-resolve
- `10-agent-kernel/40-per-agent-loaders.md` — resolver contract, six loader kinds in detail
- `10-agent-kernel/50-load-helpers.md` — frontmatter schema + variable substitution
- `10-agent-kernel/60-domain-guard.md` — operation mapping, path-prefix semantics
- `40-services/10-state.md` — `SessionStateManager`, phase transitions
- `10-agent-kernel/70-subagents/10-execution.md` — `AgentManager` concurrency + link entries

### Loader catalog
`agent-spawning/context/loaders/` — six kinds: `file`, `directory`, `skill`, `checkpoint-slice`, `command`, `text`. Each returns `LoaderResult { status, content, bytes, hash, error? }`. New kinds register via `createDefaultCatalog()` without touching existing agents.

### Agent folder layout
`apps/backend/src/agent-catalog/agents/{name}/` contains `agent.md` (frontmatter + `{{var}}` body), optional `context.ts` (`AgentContextResolver = { loaders, assemble }`), optional `index.ts` (private-tool `register()`). Lightweight agents (e.g. `scout`, `shared/research`) ship only `agent.md` — context phase skipped when `contextModulePath` is null.

### RunContext
`run-context.ts` uses `AsyncLocalStorage<RunContext>` to bind `{ sessionUuid, sessionSlug, traceWriter, sessionDir?, workingDir?, stateManager? }` to the spawn. Kernel tools call `getRunContext()` (hard-throws outside spawn).

### Accumulation guard
Context injected as `CustomMessageEntry` (not `CustomEntry`) with `customType === "agent-context"` + `details.agentName`. Only `CustomMessageEntry` replays into LLM transcript. `hasAgentContext` scans session entries and skips re-injection on reload.

### Domain guard
Dynamic-only (never from frontmatter). `opts.domain` → per-spawn `tool_call` listener via `extensionFactories`. Path-prefix first-match, default-deny when any rule present. Concurrent spawns never cross-enforce.

### Path invariant
Registry stores absolute paths for `agentFile`, `contextModulePath`, `indexModulePath`. Agents root is module-anchored via `import.meta.dir` — independent of `process.cwd()`. `workingDir` is linked-project tool cwd; never used to resolve agent defs.

### Tests
- apps/backend/src/agent-kernel/agent-spawning/__tests__/ — spawn LOC cap, factory, pi-session
- apps/backend/src/agent-kernel/agent-spawning/context/__tests__/ — assembler, guard, loaders
- apps/backend/src/agent-catalog/registry/__tests__/ — boot validation
- apps/backend/src/agent-kernel/run/subagents/__tests__/ — manager lifecycle

## Report

Summarize your understanding
