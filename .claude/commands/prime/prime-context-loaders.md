---
description: Gain deep understanding of the agent context-loading system — AgentContextResolver contract, six-kind loader catalog, context assembler, SpawnContext, shared section renderers, accumulation guard, and how to add new loader kinds
---

# Prime Context Loaders

Per-agent context-loading pipeline. Each agent exports a default `AgentContextResolver = { loaders, assemble }` colocated at `agent-catalog/agents/{name}/context.ts`. The kernel runs the declared loaders through a shared six-kind catalog, hands the ordered `LoadedMap` to `assemble(loaded, ctx)`, and injects the rendered string once per pi session via `CustomMessageEntry` behind an accumulation guard.

Declarative I/O (loaders) + imperative composition (assemble). Loader failures are continue-on-error; assemble bugs fail-fast. New kinds register on the catalog without touching existing agents.

## Read

### Docs (Required)

- docs/20-implementation/10-backend/10-agent-kernel/40-per-agent-loaders.md — full L3 spec (contract, six kinds, SpawnContext, assemble helpers, guard, continue-on-error)
- docs/20-implementation/10-backend/10-agent-kernel/00-overview.md — where context fits in the six-phase spawn
- docs/20-implementation/10-backend/10-agent-kernel/10-pipeline.md — spawn sequence (context phase position)
- docs/20-implementation/10-backend/10-agent-kernel/50-load-helpers.md — frontmatter `variables` schema + substitution (feeds `ctx.variables`)

### Contract + Assembler (Required)

Public surface — agents import only from this barrel:
- apps/backend/src/agent-kernel/spawn-pipeline/context/index.ts

Resolver contract + `SpawnContext` + `LoadedMap` + `inputRefOf`:
- apps/backend/src/agent-kernel/spawn-pipeline/context/types.ts

Runner (loader walk, event emission, `assemble()` call):
- apps/backend/src/agent-kernel/spawn-pipeline/context/context-assembler.ts

Per-spawn context factory + `LoaderResolveContext` projection:
- apps/backend/src/agent-kernel/spawn-pipeline/context/create-spawn-context.ts

Shared render helpers used by every assemble body:
- apps/backend/src/agent-kernel/spawn-pipeline/context/section-renderers.ts

Inject-once guard (writes `CustomMessageEntry`, scans on replay):
- apps/backend/src/agent-kernel/spawn-pipeline/context/accumulation-guard.ts

### Loader Catalog (Required)

Catalog registry + `hashContent` + `UnknownLoaderKindError`:
- apps/backend/src/agent-kernel/spawn-pipeline/context/loaders/catalog.ts

Loader declaration union + `Loader<D>` + `LoaderResult`:
- apps/backend/src/agent-kernel/spawn-pipeline/context/loaders/types.ts

Default wiring — the only place all six kinds are registered:
- apps/backend/src/agent-kernel/spawn-pipeline/context/loaders/index.ts

Six built-in loaders (read at least `file.ts` + one other):
- apps/backend/src/agent-kernel/spawn-pipeline/context/loaders/file.ts
- apps/backend/src/agent-kernel/spawn-pipeline/context/loaders/directory.ts
- apps/backend/src/agent-kernel/spawn-pipeline/context/loaders/skill.ts
- apps/backend/src/agent-kernel/spawn-pipeline/context/loaders/checkpoint-slice.ts
- apps/backend/src/agent-kernel/spawn-pipeline/context/loaders/command.ts
- apps/backend/src/agent-kernel/spawn-pipeline/context/loaders/text.ts

### Example Resolvers

Simple (declarative only, shared-helper assemble):
- apps/backend/src/agent-catalog/agents/spec/context.ts

Advanced (zero loaders, DB-driven assemble, variables parsing, custom renderer):
- apps/backend/src/agent-catalog/agents/plan/tasks/context.ts

Build agent (mixes loader + custom `renderActiveCheckpoint`):
- apps/backend/src/agent-catalog/agents/build/context.ts

## Be Aware Of

### Resolver contract
```ts
interface AgentContextResolver {
  loaders: LoaderDeclaration[];
  assemble(loaded: LoadedMap, ctx: SpawnContext): string | Promise<string>;
}
```
Both halves see the same `SpawnContext`. Missing `context.ts` → kernel skips the context phase entirely (lightweight agents like `scout`).

### Six loader kinds
| Kind | Declaration | Use |
|------|-------------|-----|
| `file` | `{ kind, path }` | Single file; path resolved against `ctx.cwd` if relative |
| `directory` | `{ kind, pattern, extensions? }` | Glob + concatenate |
| `skill` | `{ kind, name }` | Skill SKILL.md from `.claude/skills/` |
| `checkpoint-slice` | `{ kind, selector }` | Structured slice of plan/state DB row; `plan-progress` is reserved synthetic |
| `command` | `{ kind, command, args?, timeoutMs? }` | Shell stdout |
| `text` | `{ kind, content, label? }` | Inline static string |

### Adding a new loader kind
1. Define a new `…LoaderDeclaration` in `loaders/types.ts` and add it to the `LoaderDeclaration` union.
2. Extend `inputRefOf()` in `context/types.ts` (exhaustive switch — TS will complain until you do).
3. Implement `Loader<YourDecl>` in `loaders/your-kind.ts` returning `LoaderResult { status, content, bytes, hash, error? }`. Use `hashContent()` from `catalog.ts` to stay consistent.
4. Register it in `loaders/index.ts` inside `createDefaultCatalog()` (the *only* wiring site — keeps `catalog.ts` loader-free, prevents import cycles).
5. No existing agent changes needed; agents opt in by adding the declaration to their `loaders[]`.

### LoaderResolveContext vs SpawnContext
Loaders get the narrow projection (`cwd`, `activeSessionDir`, `sessionId?`) via `toLoaderResolveContext(spawnContext)`. Assemble gets the full `SpawnContext` (agentName, variables, caller, runtime, paths, optional prefetched `sessionData`). Widen `LoaderResolveContext` if a new kind truly needs more, but prefer keeping loaders dumb and letting `assemble` do conditional logic.

### Continue-on-error semantics
Loader throw → `status: "error"` entry with error message; remaining loaders still run; `assemble` runs with the partial `LoadedMap`; `renderLoadedSection` emits `<loader-error kind="…" ref="…">msg</loader-error>` so the agent sees *why* something is missing. A resolver bug inside `assemble` is NOT caught — fails loud on purpose.

### Shared render helpers
`section-renderers.ts` exports `renderSessionMeta(ctx)`, `renderPriorSessions(ctx)`, `renderLoadedSection(li)`, `composeAssembled(sections)`. Typical assemble body:
```ts
composeAssembled([
  renderSessionMeta(ctx),
  renderPriorSessions(ctx),
  ...loaded.map(renderLoadedSection),
]);
```
Custom renderers (build's `renderActiveCheckpoint`, plan's pipeline context XML) slot between the helpers.

### Accumulation guard (inject once)
Context is a `CustomMessageEntry` (NOT `CustomEntry`) with `customType = "agent-context"` + `details.agentName`. Only `CustomMessageEntry` replays into LLM transcript on every turn. `hasAgentContext(session, name)` scans session entries; match → skip the whole context-build phase on subsequent spawns in the same pi session. Prevents the "accumulation trap" (duplicate blocks on every turn).

### SpawnContext.sessionData
Production spawns leave it unset — resolvers call `getSession(db, runtime.sessionId)` themselves (see `plan/tasks/context.ts`). The testing render endpoint pre-injects `sessionData.planData` to avoid double DB reads or to bypass DB entirely (fixture mode).

### Variable substitution
`ctx.variables` is the resolved caller⊕defaults map from frontmatter. `plan/_shared/spawn-variables.ts`-style parsers (`parseTasksVariables`) turn it into typed structs. Loaders do NOT see variables directly — only `assemble` does.

### Events emitted per build
`context_build_started` (declared_inputs) → `context_input_resolved` × N (loader_kind, input_ref, status, bytes, from_cache, content_hash, error?) → `context_build_completed` (inputs, rendered_context, total_bytes). `inputRefOf(decl)` produces the stable string used in trace payloads.

### Path invariant
`cwd` passed to loaders is the worktree root (`workingDir`), not `process.cwd()`. Session files live at `{workingDir}/active_session/`. Relative loader paths resolve against `cwd`.

### Tests
- apps/backend/src/agent-kernel/spawn-pipeline/context/__tests__/ — assembler, guard, loaders, create-spawn-context
- apps/backend/src/agent-kernel/spawn-pipeline/context/loaders/__tests__/ — per-kind unit tests
- Per-agent rendered-system-prompt snapshots pin byte-parity across resolver changes

## Report

Trace one context build end-to-end for a concrete agent (pick `spec` or `build`):
1. Where the resolver is discovered and imported.
2. What `loaders[]` it declares and which kinds those hit.
3. What `SpawnContext` fields `assemble` uses.
4. How the six shared-helper sections + any custom renderer compose the final string.
5. Why the second spawn in the same pi session skips the whole phase.

Then describe what changes if you add a seventh loader kind (e.g. `url` fetch) — which files get edited, which don't.
