# Plan: 2026-04-23_asset-loop-tui-sdk_xntfvl

**Status:** complete

## CP1: End-to-end thin slice via Pi SDK

**Goal:** Replace extension orchestration with a minimal TypeScript orchestrator that runs initial-gen (one in-memory SDK session with write tools), renders once with Playwright, critiques once, and writes critique.json. Simplify systemPrompt.ts to remove loop/tool protocol. Launch via `bun run asset-loop --asset <path>` through a new bin/asset-loop.ts entry. No TUI yet, no fix loop, no iteration cap, no accepted.json — this checkpoint only proves SDK plumbing + reused modules (args, renderer, wrapper, pngSize, critic) drive one end-to-end pass.

**Testing:** Manual end-to-end: `bun run asset-loop --asset <existing asset dir>` from apps/pi-asset-loop. Expect: component.html + component.css written by the SDK agent, render.png exists, critique.json written with valid JSON matching CritiqueResult shape (verdict + issues array). Typecheck passes (`npm run typecheck`). Process exits 0 after one critique. Old extension path (`pi -e ./extensions/asset-loop.ts`) is NOT yet removed and should still work — this CP is additive.

### 1 Simplified system prompt + SDK orchestrator thin slice

_Objective:_ Strip the tool/loop protocol out of src/systemPrompt.ts (the orchestrator, not the LLM, now owns the loop) and introduce src/orchestrator.ts exporting runAssetLoop — one in-memory Pi SDK session with coding tools that writes component.html/component.css for initial gen, followed by one deterministic renderWithPlaywright call and one runCritique call, persisting critique.json at the end.

#### Task 1: Simplify buildSystemPrompt for initial-gen only

- Description: The orchestrator (not the LLM) now owns render/critique/fix/accept. The system prompt must stop describing tools, the loop protocol, iteration budgets, or how to work with the critic. Strip those sections. Keep the parts that still ground a single STUDY + IMPLEMENT pass: role, goal, context-you-receive, workspace layout, design philosophy, file contracts, asset metadata. Also drop maxIterations from SystemPromptInput so callers no longer pass it in.
- Read before:
  - `apps/pi-asset-loop/src/systemPrompt.ts` (1-183) — Current full system prompt with all loop/tool sections that must be removed.
  - `apps/pi-asset-loop/extensions/asset-loop.ts` (121-132) — Only current caller of buildSystemPrompt — shows which fields are passed. maxIterations is passed today and must be dropped.

**Actions:**
- `1` UPDATE TYPE SystemPromptInput: REMOVE FIELD maxIterations → `apps/pi-asset-loop/src/systemPrompt.ts`
- `2` REMOVE <tools> SECTION FROM buildSystemPrompt return template → `apps/pi-asset-loop/src/systemPrompt.ts`
- `3` REMOVE <loop_protocol> SECTION FROM buildSystemPrompt return template → `apps/pi-asset-loop/src/systemPrompt.ts`
- `4` REMOVE <working_with_the_critic> SECTION FROM buildSystemPrompt return template → `apps/pi-asset-loop/src/systemPrompt.ts`
- `5` REMOVE iteration-budget lines FROM <reminders> SECTION (keep only reminders still true for initial-gen, e.g. source screenshot as ground truth) → `apps/pi-asset-loop/src/systemPrompt.ts`
- `6` UPDATE <workspace> SECTION: REMOVE render.png/critique.json/accepted.json 'produced by tools' lines — agent only writes component.html + component.css now → `apps/pi-asset-loop/src/systemPrompt.ts`
- `7` REMOVE all references to ${input.maxIterations} INSIDE the template string → `apps/pi-asset-loop/src/systemPrompt.ts`
- `8` UPDATE <goal> SECTION: keep 'match the extracted reference' wording but DROP any text that implies the LLM drives an iteration loop → `apps/pi-asset-loop/src/systemPrompt.ts`
- `9` UPDATE leading DOCSTRING comment: REPLACE 'executor-orchestrator' phrasing WITH 'one-shot initial-gen agent; TypeScript orchestrator owns render/critique/fix' → `apps/pi-asset-loop/src/systemPrompt.ts`

#### Task 2: Create src/orchestrator.ts with runAssetLoop (thin slice)

- Description: New module that owns one end-to-end pass: resolve the asset, load the four context inputs, spin up a single in-memory Pi SDK session with coding tools scoped to the asset dir, prompt it with the existing kickoff shape (4 inputs), wait for idle, dispose, run Playwright render, run the critic, persist critique.json. Export a single async runAssetLoop function. No iteration, no fix loop, no accepted.json — those come in CP2.
- Read before:
  - `apps/pi-asset-loop/extensions/asset-loop.ts` (81-119) — Current session_start handler shows the exact kickoff message shape (4 inputs: text+source image+text+extracted image+extraction prompt) that the SDK session.prompt() call must reproduce.
  - `apps/pi-asset-loop/extensions/asset-loop.ts` (237-278) — Current critique tool body — the orchestrator reuses runCritique identically, passing auth via modelRegistry.getApiKeyAndHeaders, and persists { iteration, verdict, issues } to critique.json.
  - `apps/pi-asset-loop/src/args.ts` (1-108) — resolveAsset signature and ResolvedAsset fields — paths needed for inputs, wrapper, render, critique.json.
  - `apps/pi-asset-loop/src/critic.ts` (34-50) — RunCritiqueInput shape — what runCritique needs from the orchestrator.
  - `apps/pi-asset-loop/src/renderer.ts` (1-56) — renderWithPlaywright signature.
  - `apps/pi-asset-loop/src/wrapper.ts` (1-39) — buildRenderWrapper is called before Playwright screenshots; orchestrator must build the wrapper from the freshly written component.html/.css.
  - `ai_docs/pi-agent/examples-sdk/01-minimal.ts` (1-23) — Baseline SDK session shape — createAgentSession + session.subscribe + session.prompt.
  - `ai_docs/pi-agent/examples-sdk/12-full-control.ts` (1-83) — Full-control example — shows SessionManager.inMemory, custom ResourceLoader with systemPromptOverride, explicit tools via createCodingTools(cwd), AuthStorage + ModelRegistry wiring.
  - `ai_docs/pi-agent/sdk.md` (60-260) — SDK Quick Start, AgentSession surface, agent.waitForIdle, event types (agent_end carries Usage), dispose().
- Depends on: 1

**Actions:**
- `1` CREATE FILE apps/pi-asset-loop/src/orchestrator.ts → `apps/pi-asset-loop/src/orchestrator.ts`
- `2` ADD IMPORT { readFileSync, writeFileSync } FROM 'node:fs' → `apps/pi-asset-loop/src/orchestrator.ts`
- `3` ADD IMPORT { getModel } FROM '@mariozechner/pi-ai' → `apps/pi-asset-loop/src/orchestrator.ts`
- `4` ADD IMPORT { AuthStorage, ModelRegistry, SessionManager, DefaultResourceLoader, createAgentSession, createCodingTools } FROM '@mariozechner/pi-coding-agent' → `apps/pi-asset-loop/src/orchestrator.ts`
- `5` ADD IMPORT { resolveAsset, type ResolveInput } FROM './args.ts' → `apps/pi-asset-loop/src/orchestrator.ts`
- `6` ADD IMPORT { buildSystemPrompt } FROM './systemPrompt.ts' → `apps/pi-asset-loop/src/orchestrator.ts`
- `7` ADD IMPORT { buildRenderWrapper } FROM './wrapper.ts' → `apps/pi-asset-loop/src/orchestrator.ts`
- `8` ADD IMPORT { renderWithPlaywright } FROM './renderer.ts' → `apps/pi-asset-loop/src/orchestrator.ts`
- `9` ADD IMPORT { runCritique } FROM './critic.ts' → `apps/pi-asset-loop/src/orchestrator.ts`
- `10` ADD IMPORT { readPngSize } FROM './pngSize.ts' → `apps/pi-asset-loop/src/orchestrator.ts`
- `11` ADD CONST MODEL_PROVIDER = 'anthropic' and MODEL_ID = 'claude-opus-4-7' → `apps/pi-asset-loop/src/orchestrator.ts`
- `12` ADD EXPORT FUNCTION runAssetLoop(input: ResolveInput): Promise<void> — top-level orchestration entry → `apps/pi-asset-loop/src/orchestrator.ts`
- `13` INSIDE runAssetLoop: CALL resolveAsset(input) AND STORE AS resolved → `apps/pi-asset-loop/src/orchestrator.ts`
- `14` INSIDE runAssetLoop: READ resolved.extractedPngPath, resolved.sourcePngPath, resolved.assetJsonPath, resolved.extractionPromptPath into base64 strings + text strings; COMPUTE referenceWidth/referenceHeight via readPngSize → `apps/pi-asset-loop/src/orchestrator.ts`
- `15` INSIDE runAssetLoop: CREATE authStorage via AuthStorage.create(); CREATE modelRegistry via new ModelRegistry(authStorage) → `apps/pi-asset-loop/src/orchestrator.ts`
- `16` INSIDE runAssetLoop: RESOLVE model via getModel(MODEL_PROVIDER, MODEL_ID); THROW if null → `apps/pi-asset-loop/src/orchestrator.ts`
- `17` INSIDE runAssetLoop: BUILD systemPrompt via buildSystemPrompt({ assetId: resolved.assetId, assetDir: resolved.assetDir, assetJson: assetJsonText, referenceWidth, referenceHeight }) → `apps/pi-asset-loop/src/orchestrator.ts`
- `18` INSIDE runAssetLoop: CREATE resourceLoader via new DefaultResourceLoader({ systemPromptOverride: () => systemPrompt }); AWAIT resourceLoader.reload() → `apps/pi-asset-loop/src/orchestrator.ts`
- `19` INSIDE runAssetLoop: CALL createAgentSession({ cwd: resolved.assetDir, model, thinkingLevel: 'high', authStorage, modelRegistry, resourceLoader, tools: createCodingTools(resolved.assetDir), sessionManager: SessionManager.inMemory() }) AND DESTRUCTURE { session } → `apps/pi-asset-loop/src/orchestrator.ts`
- `20` INSIDE runAssetLoop: LOG 'phase: initial-gen' TO stdout BEFORE session.prompt → `apps/pi-asset-loop/src/orchestrator.ts`
- `21` INSIDE runAssetLoop: CALL session.prompt(kickoffText, { images: [{ type: 'image', source: { type: 'base64', mediaType: 'image/png', data: sourceBase64 } }, { type: 'image', source: { type: 'base64', mediaType: 'image/png', data: referenceBase64 } }] }) where kickoffText mirrors the extension's Context-for-asset block (includes extraction prompt + reference dims) → `apps/pi-asset-loop/src/orchestrator.ts`
- `22` INSIDE runAssetLoop: AWAIT session.agent.waitForIdle(); THEN CALL session.dispose() → `apps/pi-asset-loop/src/orchestrator.ts`
- `23` INSIDE runAssetLoop: LOG 'phase: render' TO stdout; READ resolved.componentHtmlPath + resolved.componentCssPath; CALL buildRenderWrapper(componentHtml, componentCss) AND writeFileSync(resolved.wrapperPath, wrapperHtml); CALL renderWithPlaywright({ wrapperPath: resolved.wrapperPath, renderPath: resolved.renderPath, referenceWidth, referenceHeight }) → `apps/pi-asset-loop/src/orchestrator.ts`
- `24` INSIDE runAssetLoop: LOG 'phase: critique' TO stdout; CALL modelRegistry.getApiKeyAndHeaders(model); THROW on !auth.ok; CALL runCritique({ model, auth: { apiKey, headers }, sourcePngPath, extractedPngPath, renderPngPath: resolved.renderPath, extractionPromptText, assetJson: assetJsonText }) → `apps/pi-asset-loop/src/orchestrator.ts`
- `25` INSIDE runAssetLoop: writeFileSync(resolved.critiqueJsonPath, JSON.stringify({ iteration: 1, verdict: critique.verdict, issues: critique.issues }, null, 2) + '\n') → `apps/pi-asset-loop/src/orchestrator.ts`
- `26` INSIDE runAssetLoop: LOG summary ('iteration 1 complete — verdict: <...>, issues: <n>') TO stdout; RETURN → `apps/pi-asset-loop/src/orchestrator.ts`

### 2 CLI entry + bun launch wiring

_Objective:_ Stand up bin/asset-loop.ts as a thin argv parser that delegates to runAssetLoop, and expose it via `bun run asset-loop` from apps/pi-asset-loop/package.json. Old extension script (`pi`) is preserved so the extension still runs in parallel during transition.

#### Task 3: Create bin/asset-loop.ts entry

- Description: Thin CLI entry that parses --asset and --run from argv, then delegates to runAssetLoop from src/orchestrator.ts. Bun executes .ts natively so there is no build step. On success exit 0; on thrown error print the message to stderr and exit 1. Keep the flag parser inline — argv is just two optional --key value pairs; no yargs/commander needed.
- Read before:
  - `apps/pi-asset-loop/src/args.ts` (22-35) — ResolveInput shape — bin must pass { asset, run, cwd } with cwd = process.cwd().
  - `apps/pi-asset-loop/extensions/asset-loop.ts` (32-39) — Shows the two flags the extension exposes (--asset, --run) and their semantics — mirror them in the CLI parser.
- Depends on: 2

**Actions:**
- `1` CREATE FILE apps/pi-asset-loop/bin/asset-loop.ts → `apps/pi-asset-loop/bin/asset-loop.ts`
- `2` ADD IMPORT { runAssetLoop } FROM '../src/orchestrator.ts' → `apps/pi-asset-loop/bin/asset-loop.ts`
- `3` ADD FUNCTION parseArgs(argv: string[]): { asset?: string; run?: string } — walk pairs, recognize --asset and --run, THROW on unknown flag or missing value → `apps/pi-asset-loop/bin/asset-loop.ts`
- `4` ADD top-level try { const { asset, run } = parseArgs(process.argv.slice(2)); AWAIT runAssetLoop({ asset, run, cwd: process.cwd() }); process.exit(0); } catch (err) { console.error(err instanceof Error ? err.message : String(err)); process.exit(1); } → `apps/pi-asset-loop/bin/asset-loop.ts`

#### Task 4: Wire bun run asset-loop into package.json

- Description: Expose the CLI via `bun run asset-loop --asset ...`. Add a scripts entry that delegates to the new bin/asset-loop.ts. Promote @mariozechner/pi-coding-agent from devDependencies to dependencies because the orchestrator imports createAgentSession at runtime (a launched binary, not a dev-only tool). Keep the existing `pi`, `postinstall`, and `typecheck` scripts — the old extension still runs in parallel for this checkpoint.
- Read before:
  - `apps/pi-asset-loop/package.json` (1-23) — Current scripts (pi, postinstall, typecheck) and the dep/devDep split. @mariozechner/pi-coding-agent currently lives under devDependencies.
- Depends on: 3

**Actions:**
- `1` UPDATE scripts: ADD 'asset-loop' KEY WITH VALUE 'bun run ./bin/asset-loop.ts' AFTER 'pi' → `apps/pi-asset-loop/package.json`
- `2` MOVE '@mariozechner/pi-coding-agent' FROM devDependencies TO dependencies (value stays '*') → `apps/pi-asset-loop/package.json`
- `3` VERIFY scripts.pi, scripts.postinstall, scripts.typecheck ARE UNCHANGED → `apps/pi-asset-loop/package.json`

## CP2: Deterministic loop with per-issue fix sessions

**Goal:** Promote the thin slice into the full loop. Per-issue fix step opens its own in-memory SDK session with the full context (source + extracted + current render images, asset.json, extraction prompt, current component.html/.css) plus exactly one issue, runs to idle, disposes. Batch-fix (all issues from a critique cycle) then single render + single critique. Enforce MAX_ITERATIONS cap. Orchestrator writes accepted.json on empty-issues or cap. Critic parse failure aborts the loop (rewire critic.ts synthetic-issue path into a typed CritiqueOutcome consumed by the orchestrator). Still stdout-only — no TUI and no Usage aggregator yet.

**Prerequisites:** [1]

**Testing:** Manual end-to-end: `bun run asset-loop --asset <existing asset dir>` from apps/pi-asset-loop against an asset that converges inside the 15-render budget. Expect: stdout prints 'phase: initial-gen', then per iteration 'phase: render iter N/15', 'phase: critique iter N', either 'phase: fix iter N — K issues' followed by one 'fix I<j>: <brief>' line per popped issue, or 'accepted — hit_empty' / 'accepted — cap'. accepted.json is written and matches the shape the old extension produced (asset_id, iterations, max_iterations, hit_empty_issues, residual_issues, verdict, notes, accepted_at). critique.json is overwritten each critique cycle with the latest { iteration, verdict, issues }. component.html / component.css change between iterations (sanity: diff before/after). Typecheck passes (`npm run typecheck`). Parse-failure abort: temporarily force-return { ok: false, reason: 'parse_failed', ... } from runCritique and re-run — orchestrator prints 'aborted: critic parse failure' to stderr and exits 1 without writing accepted.json. Old extension path still runs: `pi -e ./extensions/asset-loop.ts --asset <dir>` must still drive a render/critique/accept cycle (critique tool unwraps the new CritiqueOutcome shape).

### 1 Critic parse-failure as typed CritiqueOutcome

_Objective:_ Replace runCritique's current synthetic-blocking-issue return with a discriminated CritiqueOutcome — { ok: true; result: CritiqueResult } | { ok: false; reason: 'parse_failed'; rawFirst: string; rawSecond: string } — so the orchestrator can detect double-parse-failure and abort instead of treating a fake issue as real. Update the old extension's critique tool to consume the new shape so the pi-extension path still runs during the transition.

#### Task 1: Rewire runCritique to return CritiqueOutcome

- Description: The critic currently returns a CritiqueResult with a synthesized blocking issue whenever the model replies with unparseable JSON twice. That worked for the LLM-driven loop (surface a fake issue, let the main agent re-render and retry) but it is a lie for the TypeScript-driven loop — the orchestrator needs to distinguish 'the critic legitimately reported zero issues' from 'the critic could not speak JSON'. Replace the synthetic branch with a discriminated union return type so callers are forced to handle the parse-failure explicitly. The happy path still produces the same { issues, verdict, raw } shape as today, wrapped in { ok: true, result: ... }.
- Read before:
  - `apps/pi-asset-loop/src/critic.ts` (1-50) — Current exports (CritiqueResult, RunCritiqueInput) — the new CritiqueOutcome is added here and runCritique's return type changes.
  - `apps/pi-asset-loop/src/critic.ts` (220-286) — Current double-retry body including the synthetic-issue branch that must be replaced with the parse_failed variant.
  - `apps/pi-asset-loop/src/critic.ts` (375-379) — Existing truncate helper — reuse to clip rawFirst/rawSecond before stuffing them into the outcome.

**Actions:**
- `1` ADD EXPORT TYPE CritiqueOutcome = { ok: true; result: CritiqueResult } | { ok: false; reason: 'parse_failed'; rawFirst: string; rawSecond: string } AFTER CritiqueResult interface → `apps/pi-asset-loop/src/critic.ts`
- `2` UPDATE runCritique SIGNATURE: CHANGE RETURN TYPE FROM Promise<CritiqueResult> TO Promise<CritiqueOutcome> → `apps/pi-asset-loop/src/critic.ts`
- `3` UPDATE first-parse-success BRANCH: REPLACE 'return { ...firstParsed, raw: firstText };' WITH 'return { ok: true, result: { ...firstParsed, raw: firstText } };' → `apps/pi-asset-loop/src/critic.ts`
- `4` UPDATE second-parse-success BRANCH: REPLACE 'return { ...secondParsed, raw: secondText };' WITH 'return { ok: true, result: { ...secondParsed, raw: secondText } };' → `apps/pi-asset-loop/src/critic.ts`
- `5` REMOVE the trailing synthetic-blocking-issue return block (issues: [{ id: I1, ... }], verdict: 'Critic parse failure — treat as unconverged.', raw: secondText) → `apps/pi-asset-loop/src/critic.ts`
- `6` ADD final RETURN '{ ok: false, reason: parse_failed, rawFirst: firstText, rawSecond: secondText }' at end of runCritique → `apps/pi-asset-loop/src/critic.ts`

#### Task 2: Update extension critique tool to unwrap CritiqueOutcome

- Description: The Pi extension at extensions/asset-loop.ts still runs in parallel during the CP1/CP2 transition. Its critique tool calls runCritique and uses result.issues / result.verdict directly. After task 1 the return shape changes, so the extension must unwrap the new discriminated union. On parse_failed, throw an Error so the extension surfaces the failure to the LLM as a tool error (behaviorally close to the previous 'synthetic blocking issue' surface and sufficient to keep the old flow functional until CP5 deletes the extension).
- Read before:
  - `apps/pi-asset-loop/extensions/asset-loop.ts` (222-279) — Current critique tool body — the only caller of runCritique inside the extension. Shows how result.issues / result.verdict are used (persisted to critique.json and formatted for the agent).
  - `apps/pi-asset-loop/src/critic.ts` (1-50) — After task 1 this file exports CritiqueOutcome; import it here so the extension type-checks against the new shape.
- Depends on: 1

**Actions:**
- `1` UPDATE IMPORT FROM '../src/critic.ts': ADD CritiqueOutcome TO the existing type-imports list alongside CritiqueIssue, CritiqueResult, IssueSeverity → `apps/pi-asset-loop/extensions/asset-loop.ts`
- `2` ADD local helper FUNCTION truncate(s: string, max: number): string — inline 3-line utility (length check, slice + horizontal-ellipsis) → `apps/pi-asset-loop/extensions/asset-loop.ts`
- `3` INSIDE critique tool execute body: RENAME 'const result = await runCritique(...)' TO 'const outcome = await runCritique(...)' → `apps/pi-asset-loop/extensions/asset-loop.ts`
- `4` INSIDE critique tool execute body: ADD 'if (!outcome.ok) throw new Error(`Critic parse failure after retry: ${truncate(outcome.rawSecond, 400)}`);' AFTER outcome is assigned → `apps/pi-asset-loop/extensions/asset-loop.ts`
- `5` INSIDE critique tool execute body: ADD 'const result = outcome.result;' BEFORE existing lines that use result.issues / result.verdict → `apps/pi-asset-loop/extensions/asset-loop.ts`

### 2 Per-issue fix SDK session + fix-mode prompt

_Objective:_ Introduce the fix-step primitive the orchestrator calls once per issue. A fix step opens a fresh in-memory Pi SDK session scoped to the asset dir with coding tools, kicks it off with the full visual + textual context plus exactly one CritiqueIssue, waits for idle, disposes. Add a fix-mode variant of the system prompt that drops the STUDY guidance (the STUDY pass already happened in initial-gen) and focuses the agent on 'apply exactly this one fix to component.html/.css; do not re-read context unless the fix requires it'.

#### Task 3: Add buildFixStepSystemPrompt export to systemPrompt.ts

- Description: Per-issue fix sessions need a narrower system prompt than initial-gen. Initial-gen's prompt is already stripped of loop/tool protocol (CP1) but still includes STUDY-first phrasing suited to building from scratch. Fix steps skip STUDY — component.html/.css already exist, and the agent's job is a single targeted edit. Export a sibling function buildFixStepSystemPrompt(input) that reuses the same role/goal/context/workspace/design-philosophy/file-contracts/asset-metadata scaffolding but drops the STUDY-first reminder and inserts a <fix_step_instruction> section that instructs the agent to read the current component files, apply exactly the one issue described in the user turn, and stop. Do NOT inline the issue text here — the user turn carries it so the prompt stays reusable across iterations.
- Read before:
  - `apps/pi-asset-loop/src/systemPrompt.ts` (1-183) — Current buildSystemPrompt after CP1 simplification — use as structural template for the new export. SystemPromptInput shape is also the input shape for the fix variant (minus maxIterations which is already gone).

**Actions:**
- `1` ADD EXPORT INTERFACE FixStepPromptInput WITH FIELDS assetId: string; assetDir: string; assetJson: string; referenceWidth: number; referenceHeight: number AFTER SystemPromptInput → `apps/pi-asset-loop/src/systemPrompt.ts`
- `2` ADD EXPORT FUNCTION buildFixStepSystemPrompt(input: FixStepPromptInput): string AFTER buildSystemPrompt → `apps/pi-asset-loop/src/systemPrompt.ts`
- `3` INSIDE buildFixStepSystemPrompt: RETURN template string CONTAINING <role>, <goal>, <context_you_receive>, <workspace>, <design_philosophy>, <file_contracts>, <asset_metadata> SECTIONS MIRRORED from buildSystemPrompt → `apps/pi-asset-loop/src/systemPrompt.ts`
- `4` INSIDE buildFixStepSystemPrompt: REPLACE <goal> BODY WITH single-fix phrasing ('apply the one critic issue described in the user turn to component.html and component.css; do not introduce other changes') → `apps/pi-asset-loop/src/systemPrompt.ts`
- `5` INSIDE buildFixStepSystemPrompt: ADD NEW SECTION <fix_step_instruction> WITH BODY 'Exactly one critic issue follows in the user turn. component.html and component.css already exist in your workspace — read them. Apply only the fix the issue describes — no additional changes, no refactors, no prose reply. When the edit is written, stop.' → `apps/pi-asset-loop/src/systemPrompt.ts`
- `6` INSIDE buildFixStepSystemPrompt: OMIT <reminders> SECTION entirely (fix-step has no multi-step budget to manage) → `apps/pi-asset-loop/src/systemPrompt.ts`

#### Task 4: Create src/fixStep.ts with runFixStep

- Description: Introduce the primitive the orchestrator calls once per critic issue. Each call opens a fresh in-memory Pi SDK session scoped to the asset dir with coding tools, feeds it the same visual grounding the initial-gen session had (source + extracted PNGs) plus the current render.png so the agent sees the current delta, plus the textual asset.json + extraction prompt for consistency, plus exactly one CritiqueIssue. The session is disposed after waitForIdle — no cross-issue state. The function returns void; the only observable effect is the updated component.html/.css files on disk.
- Read before:
  - `apps/pi-asset-loop/src/orchestrator.ts` (1-80) — CP1 orchestrator — same imports (AuthStorage, ModelRegistry, SessionManager, DefaultResourceLoader, createAgentSession, createCodingTools) and same session-construction pattern are reused inside fixStep.ts. Confirms the correct import paths and the session.prompt image-payload shape.
  - `apps/pi-asset-loop/src/critic.ts` (18-32) — CritiqueIssue / IssueSeverity shapes — the fix step's input carries one CritiqueIssue.
  - `apps/pi-asset-loop/src/args.ts` (1-63) — ResolvedAsset fields — used to find assetDir (session cwd) and componentHtml/componentCss paths.
  - `ai_docs/pi-agent/examples-sdk/12-full-control.ts` (1-83) — Full-control SDK session with explicit tools/resourceLoader — baseline pattern runFixStep mirrors.
  - `ai_docs/pi-agent/sdk.md` (60-260) — session.prompt image payload shape, session.agent.waitForIdle, session.dispose.
- Depends on: 3

**Actions:**
- `1` CREATE FILE apps/pi-asset-loop/src/fixStep.ts → `apps/pi-asset-loop/src/fixStep.ts`
- `2` ADD IMPORT { type Api, type Model } FROM '@mariozechner/pi-ai' → `apps/pi-asset-loop/src/fixStep.ts`
- `3` ADD IMPORT { AuthStorage, ModelRegistry, SessionManager, DefaultResourceLoader, createAgentSession, createCodingTools } FROM '@mariozechner/pi-coding-agent' → `apps/pi-asset-loop/src/fixStep.ts`
- `4` ADD IMPORT { type CritiqueIssue } FROM './critic.ts' → `apps/pi-asset-loop/src/fixStep.ts`
- `5` ADD IMPORT { type ResolvedAsset } FROM './args.ts' → `apps/pi-asset-loop/src/fixStep.ts`
- `6` ADD IMPORT { buildFixStepSystemPrompt } FROM './systemPrompt.ts' → `apps/pi-asset-loop/src/fixStep.ts`
- `7` ADD EXPORT INTERFACE RunFixStepInput WITH FIELDS resolved: ResolvedAsset; issue: CritiqueIssue; iteration: number; assetJsonText: string; extractionPromptText: string; referenceWidth: number; referenceHeight: number; sourceBase64: string; extractedBase64: string; currentRenderBase64: string; model: Model<Api>; authStorage: AuthStorage; modelRegistry: ModelRegistry → `apps/pi-asset-loop/src/fixStep.ts`
- `8` ADD EXPORT FUNCTION runFixStep(input: RunFixStepInput): Promise<void> → `apps/pi-asset-loop/src/fixStep.ts`
- `9` INSIDE runFixStep: BUILD systemPrompt via buildFixStepSystemPrompt({ assetId: input.resolved.assetId, assetDir: input.resolved.assetDir, assetJson: input.assetJsonText, referenceWidth: input.referenceWidth, referenceHeight: input.referenceHeight }) → `apps/pi-asset-loop/src/fixStep.ts`
- `10` INSIDE runFixStep: CREATE resourceLoader via new DefaultResourceLoader({ systemPromptOverride: () => systemPrompt }); AWAIT resourceLoader.reload() → `apps/pi-asset-loop/src/fixStep.ts`
- `11` INSIDE runFixStep: CALL createAgentSession({ cwd: input.resolved.assetDir, model: input.model, thinkingLevel: 'high', authStorage: input.authStorage, modelRegistry: input.modelRegistry, resourceLoader, tools: createCodingTools(input.resolved.assetDir), sessionManager: SessionManager.inMemory() }) AND DESTRUCTURE { session } → `apps/pi-asset-loop/src/fixStep.ts`
- `12` INSIDE runFixStep: BUILD kickoffText that labels the three images (source / extracted / current render), restates referenceWidth x referenceHeight, includes the extraction prompt, and enumerates the single issue block (id, region, severity, description, fix_hint) followed by instructions to read component.html + component.css and apply only this fix → `apps/pi-asset-loop/src/fixStep.ts`
- `13` INSIDE runFixStep: CALL session.prompt(kickoffText, { images: [{ type: 'image', source: { type: 'base64', mediaType: 'image/png', data: input.sourceBase64 } }, { type: 'image', source: { type: 'base64', mediaType: 'image/png', data: input.extractedBase64 } }, { type: 'image', source: { type: 'base64', mediaType: 'image/png', data: input.currentRenderBase64 } }] }) → `apps/pi-asset-loop/src/fixStep.ts`
- `14` INSIDE runFixStep: AWAIT session.agent.waitForIdle(); THEN CALL session.dispose(); RETURN → `apps/pi-asset-loop/src/fixStep.ts`

### 3 Orchestrator full deterministic loop + accepted.json

_Objective:_ Expand runAssetLoop from the thin slice (initial-gen + single render + single critique) into the full deterministic loop: initial-gen once, then while not terminal do render, critique, handle parse-failure abort, check empty-issue or cap termination, else batch-fix every issue via runFixStep. On empty-issues or cap, write accepted.json with the exact shape the extension produced. Introduce MAX_ITERATIONS = 15 and a small writeAcceptedJson helper so the loop body stays readable.

#### Task 5: Add MAX_ITERATIONS + writeAcceptedJson helper in orchestrator.ts

- Description: Prepare orchestrator.ts for the full loop by lifting MAX_ITERATIONS to a module-level constant and introducing a small internal writeAcceptedJson helper that serializes the accepted.json payload exactly as the legacy extension's accept tool did. This isolates the on-disk contract in one place so the loop body (task 6) can call it twice (empty-issues termination, cap termination) without duplicating the shape. Notes are synthesized from termination reason; caller passes iterations, hitEmpty, residualIssues, verdict.
- Read before:
  - `apps/pi-asset-loop/src/orchestrator.ts` (1-60) — CP1 orchestrator imports and initial MAX_ITERATIONS placement (if any) — confirm where to add the constant and the helper so the diff stays minimal for task 6.
  - `apps/pi-asset-loop/extensions/asset-loop.ts` (292-337) — Legacy accept tool — canonical shape of accepted.json (asset_id, iterations, max_iterations, hit_empty_issues, residual_issues, verdict, notes, accepted_at). The helper must produce byte-identical output (trailing newline included) so downstream consumers do not need to branch.

**Actions:**
- `1` VERIFY const MAX_ITERATIONS EXISTS at module scope; IF local to runAssetLoop, MOVE to module scope; ELSE ADD 'const MAX_ITERATIONS = 15;' at module top (below imports) → `apps/pi-asset-loop/src/orchestrator.ts`
- `2` ADD IMPORT { type CritiqueIssue } FROM './critic.ts' IF NOT already imported → `apps/pi-asset-loop/src/orchestrator.ts`
- `3` ADD IMPORT { type ResolvedAsset } FROM './args.ts' IF NOT already imported → `apps/pi-asset-loop/src/orchestrator.ts`
- `4` ADD INTERNAL FUNCTION writeAcceptedJson(resolved: ResolvedAsset, payload: { iterations: number; hitEmpty: boolean; residualIssues: CritiqueIssue[]; verdict: string }): void AT module scope, BEFORE runAssetLoop → `apps/pi-asset-loop/src/orchestrator.ts`
- `5` INSIDE writeAcceptedJson: BUILD notes: string[] — ['converged at iteration ${payload.iterations}'] WHEN payload.hitEmpty; ELSE ['iteration cap reached at ${payload.iterations} renders', '${payload.residualIssues.length} residual issue(s)'] → `apps/pi-asset-loop/src/orchestrator.ts`
- `6` INSIDE writeAcceptedJson: BUILD output object { asset_id: resolved.assetId, iterations: payload.iterations, max_iterations: MAX_ITERATIONS, hit_empty_issues: payload.hitEmpty, residual_issues: payload.residualIssues, verdict: payload.verdict, notes, accepted_at: new Date().toISOString() } → `apps/pi-asset-loop/src/orchestrator.ts`
- `7` INSIDE writeAcceptedJson: writeFileSync(resolved.acceptedJsonPath, JSON.stringify(output, null, 2) + '\n') → `apps/pi-asset-loop/src/orchestrator.ts`

#### Task 6: Refactor runAssetLoop into full deterministic loop

- Description: Turn runAssetLoop from the one-shot slice into the full TypeScript-driven loop. Keep the existing initialization (resolveAsset + read inputs + AuthStorage/ModelRegistry + DefaultResourceLoader + initial-gen SDK session). After initial-gen dispose, iterate from 1..MAX_ITERATIONS: render, critique, handle parse-failure abort, check empty-issue termination, check cap termination, else batch-fix every issue via runFixStep, then next iteration. Every iteration re-reads render.png into base64 and feeds that base64 (plus source + extracted) into each per-issue fix session. The loop does not call any TUI — stdout-only phase logs ('phase: render iter N/15', 'phase: critique iter N', 'phase: fix iter N — K issues', 'fix I<j>: <severity> <region>', 'accepted — hit_empty' / 'accepted — cap'). Parse-failure: console.error a short message referencing the truncated rawSecond and throw; bin/asset-loop.ts already exits 1 on throw, and no accepted.json is written.
- Read before:
  - `apps/pi-asset-loop/src/orchestrator.ts` (1-200) — Current thin-slice body. After task 5 it already has MAX_ITERATIONS and writeAcceptedJson. Identify the post-dispose single-critique region that this task replaces.
  - `apps/pi-asset-loop/src/critic.ts` (180-286) — runCritique now returns CritiqueOutcome (task 1). The orchestrator must branch on outcome.ok and pull outcome.result.issues / outcome.result.verdict on success.
  - `apps/pi-asset-loop/src/fixStep.ts` (1-80) — runFixStep signature (task 4). The orchestrator calls it once per issue, per iteration, awaiting sequentially.
  - `apps/pi-asset-loop/extensions/asset-loop.ts` (161-219) — Legacy render tool — confirms the exact buildRenderWrapper + renderWithPlaywright call sequence (wrapperPath, renderPath, referenceWidth, referenceHeight). Orchestrator must reproduce it.
- Depends on: 1, 4, 5

**Actions:**
- `1` ADD IMPORT { runFixStep } FROM './fixStep.ts' → `apps/pi-asset-loop/src/orchestrator.ts`
- `2` ADD local helper FUNCTION truncate(s: string, max: number): string — 3-line utility (length check, slice + horizontal-ellipsis) → `apps/pi-asset-loop/src/orchestrator.ts`
- `3` INSIDE runAssetLoop: KEEP initialization unchanged — resolveAsset, read 4 context inputs, create AuthStorage, new ModelRegistry, getModel, build systemPrompt, DefaultResourceLoader, createAgentSession, session.prompt with source+extracted images, session.agent.waitForIdle, session.dispose → `apps/pi-asset-loop/src/orchestrator.ts`
- `4` INSIDE runAssetLoop: REMOVE thin-slice body AFTER initial-gen dispose (single buildRenderWrapper + renderWithPlaywright + auth resolve + runCritique + writeFileSync critique.json + stdout summary + return) → `apps/pi-asset-loop/src/orchestrator.ts`
- `5` INSIDE runAssetLoop: ADD 'for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++)' AFTER initial-gen dispose → `apps/pi-asset-loop/src/orchestrator.ts`
- `6` INSIDE loop: LOG 'phase: render iter ${iteration}/${MAX_ITERATIONS}' TO stdout; READ resolved.componentHtmlPath + resolved.componentCssPath; writeFileSync(resolved.wrapperPath, buildRenderWrapper(html, css)); AWAIT renderWithPlaywright({ wrapperPath, renderPath, referenceWidth, referenceHeight }); READ resolved.renderPath INTO renderBase64 → `apps/pi-asset-loop/src/orchestrator.ts`
- `7` INSIDE loop: LOG 'phase: critique iter ${iteration}' TO stdout; AWAIT modelRegistry.getApiKeyAndHeaders(model); THROW on !auth.ok; AWAIT runCritique({ model, auth, sourcePngPath, extractedPngPath, renderPngPath: resolved.renderPath, extractionPromptText, assetJson: assetJsonText }) AND STORE AS outcome → `apps/pi-asset-loop/src/orchestrator.ts`
- `8` INSIDE loop: IF (!outcome.ok) console.error('aborted: critic parse failure — ' + truncate(outcome.rawSecond, 400)); THROW new Error('critic parse failure') → `apps/pi-asset-loop/src/orchestrator.ts`
- `9` INSIDE loop: writeFileSync(resolved.critiqueJsonPath, JSON.stringify({ iteration, verdict: outcome.result.verdict, issues: outcome.result.issues }, null, 2) + '\n') → `apps/pi-asset-loop/src/orchestrator.ts`
- `10` INSIDE loop: IF (outcome.result.issues.length === 0) LOG 'accepted — hit_empty'; CALL writeAcceptedJson(resolved, { iterations: iteration, hitEmpty: true, residualIssues: [], verdict: outcome.result.verdict }); RETURN → `apps/pi-asset-loop/src/orchestrator.ts`
- `11` INSIDE loop: IF (iteration === MAX_ITERATIONS) LOG 'accepted — cap'; CALL writeAcceptedJson(resolved, { iterations: iteration, hitEmpty: false, residualIssues: outcome.result.issues, verdict: outcome.result.verdict }); RETURN → `apps/pi-asset-loop/src/orchestrator.ts`
- `12` INSIDE loop: LOG 'phase: fix iter ${iteration} — ${outcome.result.issues.length} issues' TO stdout → `apps/pi-asset-loop/src/orchestrator.ts`
- `13` INSIDE loop: FOR each issue IN outcome.result.issues: LOG 'fix ${issue.id}: ${issue.severity} ${issue.region}' TO stdout; AWAIT runFixStep({ resolved, issue, iteration, assetJsonText, extractionPromptText, referenceWidth, referenceHeight, sourceBase64, extractedBase64: referenceBase64, currentRenderBase64: renderBase64, model, authStorage, modelRegistry }) → `apps/pi-asset-loop/src/orchestrator.ts`

## CP3: Usage aggregator (tokens + cost)

**Goal:** Introduce src/usage.ts that accumulates pi-ai Usage objects across the initial-gen SDK session, each per-issue fix SDK session, and each runCritique call. Orchestrator subscribes to SDK agent_end and feeds critic usage in directly. Exposes cumulative input/output/cache tokens and dollar cost via a simple getter suitable for any observer (TUI in CP4, summary in CP5). No UI binding yet — verify via stdout dump at loop end.

**Prerequisites:** [2]

**Testing:** Manual end-to-end: after build, `bun run asset-loop --asset <fresh asset dir>`. Expect a single 'usage: calls=N ↑..k ↓..k R=..k W=..k tot=..k $0.XXXX' line on stdout immediately before process exit on every termination path — hit_empty, cap, and critic parse-failure abort (forceable by pointing critic at a model that fails to emit JSON twice). calls should equal (initial-gen assistant turns) + (sum of fix-step assistant turns across all iterations) + (critique attempts: 1 per successful critique, 2 if a retry fired). Cost totals match what pi-ai reports (cross-check by temporarily logging u.cost.total on each add). Typecheck passes (`npm run typecheck`). accepted.json shape unchanged from CP2.

### 1 UsageAggregator module (src/usage.ts)

_Objective:_ Introduce a pure TypeScript aggregator for pi-ai Usage objects. No I/O, no SDK imports — just add(u) to accumulate input/output/cacheRead/cacheWrite/totalTokens and cost.{input,output,cacheRead,cacheWrite,total}, and snapshot() returning an immutable UsageSnapshot. This is the data primitive that CP4's TUI and CP5's summary will consume.

#### Task 1: Create src/usage.ts with UsageAggregator + formatUsageSnapshot

- Description: New standalone module that owns cumulative Usage accounting for the whole run. Zero SDK imports — only imports the Usage type from @mariozechner/pi-ai. Exposes a tiny surface: UsageSnapshot (immutable snapshot shape, mirrors pi-ai Usage plus a calls counter), class UsageAggregator with add(u) and snapshot(), and formatUsageSnapshot(s) that returns a one-line stdout-friendly summary the orchestrator uses at termination. Pure and testable; no side effects beyond mutating private counters.
- Read before:
  - `apps/pi-asset-loop/node_modules/@mariozechner/pi-ai/dist/types.d.ts` (111-124) — Canonical pi-ai Usage interface shape { input, output, cacheRead, cacheWrite, totalTokens, cost: { input, output, cacheRead, cacheWrite, total } } — UsageSnapshot mirrors this and adds a calls counter.
  - `ai_docs/pi-agent/examples-extensions/subagent/index.ts` (30-62) — Reference for formatUsageStats output shape — tokens printed as 1.2k/340k/2.1M, cost as $X.XXXX, ↑/↓ arrows for input/output. formatUsageSnapshot should follow this idiom (simplified, no turns / contextTokens since we derive nothing from those).
  - `ai_docs/pi-agent/session.md` (103-117) — Same Usage shape as seen from pi-coding-agent; confirms we can treat both critic completeSimple usage and SDK assistant message usage as a single type.

**Actions:**
- `1` CREATE FILE apps/pi-asset-loop/src/usage.ts → `apps/pi-asset-loop/src/usage.ts`
- `2` ADD IMPORT type { Usage } FROM '@mariozechner/pi-ai' → `apps/pi-asset-loop/src/usage.ts`
- `3` ADD EXPORT TYPE UsageSnapshot = { calls: number; input: number; output: number; cacheRead: number; cacheWrite: number; totalTokens: number; cost: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number } } → `apps/pi-asset-loop/src/usage.ts`
- `4` ADD EXPORT CLASS UsageAggregator WITH private fields mirroring UsageSnapshot (calls=0, input=0, output=0, cacheRead=0, cacheWrite=0, totalTokens=0, costInput=0, costOutput=0, costCacheRead=0, costCacheWrite=0, costTotal=0) → `apps/pi-asset-loop/src/usage.ts`
- `5` ADD METHOD add(u: Usage): void TO UsageAggregator — increments calls++ and accumulates each numeric field from u and u.cost into the matching private field → `apps/pi-asset-loop/src/usage.ts`
- `6` ADD METHOD snapshot(): UsageSnapshot TO UsageAggregator — RETURNS a new plain object populated from the private fields (must be a fresh object each call, no internal reference leak) → `apps/pi-asset-loop/src/usage.ts`
- `7` ADD local helper FUNCTION formatTokens(n: number): string — n<1000 returns String(n); n<10000 returns (n/1000).toFixed(1)+'k'; n<1_000_000 returns Math.round(n/1000)+'k'; else returns (n/1_000_000).toFixed(1)+'M' → `apps/pi-asset-loop/src/usage.ts`
- `8` ADD EXPORT FUNCTION formatUsageSnapshot(s: UsageSnapshot): string — returns 'usage: calls=${s.calls} ↑${formatTokens(s.input)} ↓${formatTokens(s.output)} R=${formatTokens(s.cacheRead)} W=${formatTokens(s.cacheWrite)} tot=${formatTokens(s.totalTokens)} $${s.cost.total.toFixed(4)}' → `apps/pi-asset-loop/src/usage.ts`

### 2 Emit Usage from critic and fix step

_Objective:_ Surface Usage at the two places it lives today without orchestrator wiring. (a) CritiqueOutcome gains a usages: Usage[] field on both the ok:true and ok:false variants, populated from completeSimple's AssistantMessage.usage on each attempt. (b) runFixStep accepts an optional onUsage(u: Usage) callback in RunFixStepInput and subscribes to the session to forward assistant message usage as it arrives. These are additive surface changes — the orchestrator in CP2 still compiles (usages is new and extra; onUsage is optional).

#### Task 2: Extend CritiqueOutcome with usages[] and populate in runCritique

- Description: runCritique already calls completeSimple once and potentially a second time on retry. Both responses carry an AssistantMessage with a Usage object (first.usage, second.usage). Today those are only used to fill the fake retry-context assistant message; after this task they are also returned to the caller. Add a usages: Usage[] field to both CritiqueOutcome variants. Happy path (first parse OK) → usages is [first.usage]. Retry parse OK → [first.usage, second.usage]. Parse failure → [first.usage, second.usage]. No other runCritique logic changes.
- Read before:
  - `apps/pi-asset-loop/src/critic.ts` (1-50) — Current header and CritiqueOutcome/CritiqueResult export surface — after CP2 T1 runCritique returns CritiqueOutcome; this task extends that type.
  - `apps/pi-asset-loop/src/critic.ts` (180-286) — runCritique body — identify where first and second are awaited (completeSimple calls) and the three return sites (first-parse success, second-parse success, parse-failure). Each return must include usages.
  - `apps/pi-asset-loop/node_modules/@mariozechner/pi-ai/dist/types.d.ts` (111-142) — AssistantMessage exports usage: Usage (always present, not optional) so first.usage / second.usage are safe to reference without a guard.

**Actions:**
- `1` UPDATE IMPORT from '@mariozechner/pi-ai': ADD Usage type TO the existing imported type list (currently Api, Context, Model) → `apps/pi-asset-loop/src/critic.ts`
- `2` UPDATE EXPORT TYPE CritiqueOutcome: ADD FIELD usages: Usage[] TO BOTH variants — { ok: true; result: CritiqueResult; usages: Usage[] } | { ok: false; reason: 'parse_failed'; rawFirst: string; rawSecond: string; usages: Usage[] } → `apps/pi-asset-loop/src/critic.ts`
- `3` UPDATE first-parse-success RETURN: REPLACE '{ ok: true, result: { ...firstParsed, raw: firstText } }' WITH '{ ok: true, result: { ...firstParsed, raw: firstText }, usages: [first.usage] }' → `apps/pi-asset-loop/src/critic.ts`
- `4` UPDATE second-parse-success RETURN: REPLACE '{ ok: true, result: { ...secondParsed, raw: secondText } }' WITH '{ ok: true, result: { ...secondParsed, raw: secondText }, usages: [first.usage, second.usage] }' → `apps/pi-asset-loop/src/critic.ts`
- `5` UPDATE parse-failure RETURN: REPLACE '{ ok: false, reason: parse_failed, rawFirst: firstText, rawSecond: secondText }' WITH '{ ok: false, reason: parse_failed, rawFirst: firstText, rawSecond: secondText, usages: [first.usage, second.usage] }' → `apps/pi-asset-loop/src/critic.ts`

#### Task 3: Add onUsage callback to RunFixStepInput and subscribe to session message_end

- Description: After CP2 T4 runFixStep creates a session and awaits idle. It never subscribes. Per-issue fix sessions emit exactly one assistant message_end per LLM turn (usually 1 turn since the fix is tightly scoped; more if the agent calls tools). The orchestrator needs to see each assistant usage as it arrives. Add an optional onUsage?: (usage: Usage) => void field to RunFixStepInput. After createAgentSession resolves (before session.prompt), register session.subscribe(event => { if (event.type === 'message_end' && event.message.role === 'assistant' && event.message.usage) input.onUsage?.(event.message.usage); }). Keep waitForIdle + dispose flow unchanged. If onUsage is undefined, the subscribe handler is a no-op.
- Read before:
  - `ai_docs/pi-agent/sdk.md` (183-243) — Canonical event subscription pattern: session.subscribe(event => switch(event.type) { case 'message_end': ... }). Confirms message_end fires per-message (not per-turn) and the subscription returns void.
  - `ai_docs/pi-agent/session.md` (95-117) — AssistantMessage shape carries usage: Usage as a required field.
  - `ai_docs/pi-agent/examples-extensions/subagent/index.ts` (290-325) — Reference implementation of the exact pattern: on message_end with role='assistant', read msg.usage and accumulate. This task applies the same pattern to a live session.subscribe (not a JSONL tail).

**Actions:**
- `1` UPDATE IMPORT from '@mariozechner/pi-ai': ADD type Usage TO the existing imported type list (currently type Api, type Model) → `apps/pi-asset-loop/src/fixStep.ts`
- `2` UPDATE EXPORT INTERFACE RunFixStepInput: ADD optional FIELD onUsage?: (usage: Usage) => void → `apps/pi-asset-loop/src/fixStep.ts`
- `3` INSIDE runFixStep: INSERT AFTER the createAgentSession destructure (const { session } = ...) AND BEFORE session.prompt: 'session.subscribe((event) => { if (event.type === "message_end" && event.message?.role === "assistant" && event.message.usage) { input.onUsage?.(event.message.usage); } })' → `apps/pi-asset-loop/src/fixStep.ts`

### 3 Wire UsageAggregator into orchestrator + stdout dump

_Objective:_ Instantiate one UsageAggregator at the top of runAssetLoop. Subscribe to the initial-gen SDK session and feed message_end assistant usage into the aggregator. Feed every critic outcome.usages entry in. Pass onUsage: (u) => agg.add(u) to every runFixStep call. At every return site (hit_empty, cap, and before re-throw on parse-failure abort) console.log formatUsageSnapshot(agg.snapshot()). No TUI and no accepted.json shape change — CP5 decides whether to persist snapshot alongside accepted.json.

#### Task 4: Instantiate UsageAggregator and wire all emit sites in runAssetLoop

- Description: Thread a single UsageAggregator through the full deterministic loop. One instance per runAssetLoop call. Subscribe the initial-gen session's message_end events so coding-agent turns feed in. Feed outcome.usages[] from runCritique on every iteration (success branch) and also on the parse-failure branch before the re-throw. Pass onUsage: (u) => usage.add(u) into every runFixStep call so each fix-session assistant turn contributes. At every terminal point — hit_empty return, cap return, and parse-failure abort — console.log(formatUsageSnapshot(usage.snapshot())) before the return/throw. No accepted.json shape change.
- Read before:
  - `apps/pi-asset-loop/src/orchestrator.ts` (1-200) — Current runAssetLoop body after CP2 T6. Identify: (a) point right after resolveAsset, (b) initial-gen session creation + session.prompt, (c) every runCritique await + outcome branch, (d) every runFixStep call site inside the per-issue for loop, (e) both writeAcceptedJson return sites (hit_empty, cap), (f) the console.error + throw in the parse-failure branch.
  - `apps/pi-asset-loop/src/usage.ts` (1-80) — UsageAggregator and formatUsageSnapshot API (task 1) — both are imported here.
  - `apps/pi-asset-loop/src/critic.ts` (1-60) — CritiqueOutcome now carries usages: Usage[] on both variants (task 2) — orchestrator reads outcome.usages regardless of ok branch.
  - `apps/pi-asset-loop/src/fixStep.ts` (1-80) — RunFixStepInput.onUsage is optional (task 3) — orchestrator always passes it.
  - `ai_docs/pi-agent/sdk.md` (183-243) — session.subscribe event handler shape — same pattern as fixStep, applied to the initial-gen session before session.prompt.
- Depends on: 1, 2, 3

**Actions:**
- `1` ADD IMPORT { UsageAggregator, formatUsageSnapshot } FROM './usage.ts' → `apps/pi-asset-loop/src/orchestrator.ts`
- `2` INSIDE runAssetLoop: INSERT 'const usage = new UsageAggregator()' AFTER resolveAsset (before reading the 4 context inputs) → `apps/pi-asset-loop/src/orchestrator.ts`
- `3` INSIDE runAssetLoop initial-gen block: INSERT AFTER 'const { session } = await createAgentSession(...)' AND BEFORE session.prompt: 'session.subscribe((event) => { if (event.type === "message_end" && event.message?.role === "assistant" && event.message.usage) { usage.add(event.message.usage); } })' → `apps/pi-asset-loop/src/orchestrator.ts`
- `4` INSIDE runAssetLoop iteration loop: INSERT AFTER 'const outcome = await runCritique(...)' AND BEFORE the '!outcome.ok' parse-failure branch: 'for (const u of outcome.usages) usage.add(u)' → `apps/pi-asset-loop/src/orchestrator.ts`
- `5` INSIDE runAssetLoop parse-failure branch: INSERT 'console.log(formatUsageSnapshot(usage.snapshot()))' AFTER the existing console.error AND BEFORE 'throw new Error("critic parse failure")' → `apps/pi-asset-loop/src/orchestrator.ts`
- `6` INSIDE runAssetLoop hit_empty branch (outcome.result.issues.length === 0): INSERT 'console.log(formatUsageSnapshot(usage.snapshot()))' AFTER writeAcceptedJson AND BEFORE return → `apps/pi-asset-loop/src/orchestrator.ts`
- `7` INSIDE runAssetLoop cap branch (iteration === MAX_ITERATIONS): INSERT 'console.log(formatUsageSnapshot(usage.snapshot()))' AFTER writeAcceptedJson AND BEFORE return → `apps/pi-asset-loop/src/orchestrator.ts`
- `8` INSIDE runAssetLoop per-issue for loop: UPDATE runFixStep call — ADD onUsage: (u) => usage.add(u) TO the input object alongside the existing fields (resolved, issue, iteration, assetJsonText, extractionPromptText, referenceWidth, referenceHeight, sourceBase64, extractedBase64, currentRenderBase64, model, authStorage, modelRegistry) → `apps/pi-asset-loop/src/orchestrator.ts`

## CP4: pi-tui observe-only dashboard

**Goal:** Create src/tui.ts using @mariozechner/pi-tui components (Container, Text, Box, SelectList, Image). Mount a dashboard that surfaces: current iteration + phase + current issue line; pending-issues queue (highlight current, dim completed); cumulative token+cost meter pulled from the CP3 aggregator; side-by-side extracted reference vs. latest render as inline Image components. Orchestrator notifies the TUI on each phase/issue/render/critique transition. Ctrl+C aborts cleanly (tear down TUI, exit).

**Prerequisites:** [3]

**Testing:** Manual end-to-end in a Kitty/Ghostty/iTerm2/WezTerm terminal: `bun run asset-loop --asset <fresh asset dir>` from apps/pi-asset-loop. Expect: TUI mounts; header shows `<assetId> · iter 0/15`; status line transitions initial_gen → render → critique → fix (per issue) → render → ...; pending-issues panel populates after each critique and the current issue is bolded while already-fixed issues this iteration are dim+prefixed with ✓; extracted reference image is visible from the start; render image panel refreshes after every Playwright call; usage footer updates after every SDK turn and every critic call; on hit_empty or cap termination the TUI switches to a summary block (asset id, hit_empty bool or cap-reached line, usage summary, accepted.json path) and exits 0; Ctrl+C during any phase tears down the TUI cleanly and exits 130; critic parse-failure prints the usage snapshot to stderr, tears down the TUI, and re-throws. accepted.json + critique.json shapes unchanged from CP3. Typecheck passes (`npm run typecheck`).

### 1 AssetLoopTUI dashboard component (src/tui.ts)

_Objective:_ New module src/tui.ts exports class AssetLoopTUI — a passive observe-only dashboard built on @mariozechner/pi-tui. It owns one TUI instance wired to ProcessTerminal and stacks five panels: header (asset id + iteration counter), status line (phase + current-issue description), pending-issues list (SelectList driven programmatically, no input focus), images panel (extracted reference + latest render as inline Image components), usage footer. Exposes a small imperative API (start, stop, setIteration, setPhase, setIssues, setCurrentIssue, setRender, setUsage, showSummary) that mutates internal state, reformats the affected child component(s), and calls tui.requestRender(). No keyboard handling — Ctrl+C is owned by the orchestrator (task group 2).

#### Task 1: Create src/tui.ts with AssetLoopTUI observe-only dashboard

- Description: New standalone module that owns the entire pi-tui dashboard for the asset loop. One public class, AssetLoopTUI, wraps a TUI instance driven by ProcessTerminal and composes five stacked panels: a single-line header (asset id + iter N/M), a single-line status (phase + current-issue brief), a pending-issues queue built with SelectList (non-interactive — we mutate its items + selectedIndex from outside), an images panel with two inline Image components (extracted reference + latest render), and a usage footer. The class has a narrow imperative API consumed by the orchestrator in task group 2. No input handlers, no focus, no side effects beyond stdin/stdout writes during start/stop/requestRender. All per-update methods must be safe to call before start() (they mutate state) and after stop() (they should still update internal fields silently — requestRender on a stopped TUI is a no-op per pi-tui).
- Read before:
  - `apps/pi-asset-loop/node_modules/@mariozechner/pi-tui/dist/index.d.ts` (1-23) — Canonical export list — confirms TUI, ProcessTerminal, Container, Box, Text, Spacer, SelectList, Image, type SelectItem, type SelectListTheme, type ImageTheme are all exported from '@mariozechner/pi-tui' (barrel export). Nothing to import from sub-paths.
  - `apps/pi-asset-loop/node_modules/@mariozechner/pi-tui/dist/tui.d.ts` (120-221) — Container.addChild/clear/invalidate/render and TUI constructor (new TUI(terminal, showHardwareCursor?)), start(), stop(), requestRender(), setFocus(). TUI extends Container so addChild on the TUI itself stacks top-level panels.
  - `apps/pi-asset-loop/node_modules/@mariozechner/pi-tui/dist/components/text.d.ts` (1-19) — Text constructor(text?, paddingX=1, paddingY=1, customBgFn?) and setText(text) — used for header, status, usage lines.
  - `apps/pi-asset-loop/node_modules/@mariozechner/pi-tui/dist/components/box.d.ts` (1-22) — Box constructor(paddingX=1, paddingY=1, bgFn?) — used to frame each panel consistently.
  - `apps/pi-asset-loop/node_modules/@mariozechner/pi-tui/dist/components/select-list.d.ts` (1-50) — SelectList(items, maxVisible, theme, layout?) with setFilter/setSelectedIndex/invalidate and SelectListTheme { selectedPrefix, selectedText, description, scrollInfo, noMatch } — we pass it a theme with ANSI-bold for selectedText and ANSI-dim for description/scrollInfo, and drive selectedIndex from outside.
  - `apps/pi-asset-loop/node_modules/@mariozechner/pi-tui/dist/components/image.d.ts` (1-28) — Image(base64Data, mimeType, theme: ImageTheme { fallbackColor }, options?: { maxWidthCells, maxHeightCells, filename, imageId }) — constructed with an ImageTheme whose fallbackColor wraps text in ANSI dim for non-Kitty/iTerm terminals.
  - `apps/pi-asset-loop/src/critic.ts` (18-32) — CritiqueIssue shape { id, region, severity, description, fix_hint } — drives setIssues label formatting.
  - `apps/pi-asset-loop/src/usage.ts` (1-60) — UsageSnapshot type + formatUsageSnapshot(s) — usage footer delegates formatting to formatUsageSnapshot.
  - `apps/pi-asset-loop/node_modules/@mariozechner/pi-coding-agent/dist/modes/interactive/interactive-mode.js` (185-215) — Reference wiring: `new TUI(new ProcessTerminal(), showHardwareCursor?)` then addChild for each top-level panel. We mirror this shape (minus settingsManager) for a single-purpose dashboard.

**Actions:**
- `1` CREATE FILE apps/pi-asset-loop/src/tui.ts → `apps/pi-asset-loop/src/tui.ts`
- `2` ADD IMPORT { TUI, ProcessTerminal, Container, Box, Text, Spacer, SelectList, Image, type SelectItem, type SelectListTheme, type ImageTheme } FROM '@mariozechner/pi-tui' → `apps/pi-asset-loop/src/tui.ts`
- `3` ADD IMPORT type { CritiqueIssue } FROM './critic.js' → `apps/pi-asset-loop/src/tui.ts`
- `4` ADD IMPORT { formatUsageSnapshot, type UsageSnapshot } FROM './usage.js' → `apps/pi-asset-loop/src/tui.ts`
- `5` ADD EXPORT TYPE AssetLoopPhase = 'initial_gen' | 'render' | 'critique' | 'fix' | 'done' → `apps/pi-asset-loop/src/tui.ts`
- `6` ADD EXPORT INTERFACE AssetLoopTUIInit { assetId: string; maxIterations: number; extractedBase64: string; extractedMime: string } → `apps/pi-asset-loop/src/tui.ts`
- `7` ADD EXPORT CLASS AssetLoopTUI WITH private fields: tui: TUI, header: Text, statusLine: Text, issuesList: SelectList, extractedImage: Image, renderImage: Image | null = null, renderPlaceholder: Text, imagesContainer: Container, usageLine: Text, assetId: string, maxIterations: number, iteration: number = 0, phase: AssetLoopPhase = 'initial_gen', currentIssue: CritiqueIssue | null = null, issues: CritiqueIssue[] = [], currentIndex: number = -1 → `apps/pi-asset-loop/src/tui.ts`
- `8` ADD private FIELD selectListTheme: SelectListTheme = { selectedPrefix: (s) => `> ${s}`, selectedText: (s) => `\x1b[1m${s}\x1b[22m`, description: (s) => `\x1b[2m${s}\x1b[22m`, scrollInfo: (s) => `\x1b[2m${s}\x1b[22m`, noMatch: (s) => s } TO AssetLoopTUI → `apps/pi-asset-loop/src/tui.ts`
- `9` ADD private FIELD imageTheme: ImageTheme = { fallbackColor: (s) => `\x1b[2m${s}\x1b[22m` } TO AssetLoopTUI → `apps/pi-asset-loop/src/tui.ts`
- `10` ADD CONSTRUCTOR(init: AssetLoopTUIInit) TO AssetLoopTUI — assigns this.assetId = init.assetId, this.maxIterations = init.maxIterations; creates this.tui = new TUI(new ProcessTerminal()); this.header = new Text(this.formatHeader(), 1, 0); this.statusLine = new Text(this.formatStatus(), 1, 0); this.issuesList = new SelectList([], 8, this.selectListTheme); this.extractedImage = new Image(init.extractedBase64, init.extractedMime, this.imageTheme, { maxWidthCells: 48 }); this.renderPlaceholder = new Text('render: (pending first render)', 1, 0); this.imagesContainer = new Container(); imagesContainer.addChild(new Text('reference:', 1, 0)); imagesContainer.addChild(this.extractedImage); imagesContainer.addChild(new Spacer(1)); imagesContainer.addChild(new Text('render:', 1, 0)); imagesContainer.addChild(this.renderPlaceholder); this.usageLine = new Text(formatUsageSnapshot({ calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }), 1, 0) → `apps/pi-asset-loop/src/tui.ts`
- `11` INSIDE CONSTRUCTOR: APPEND children to this.tui in order — headerBox (new Box(1,0) addChild this.header), Spacer(1), statusBox (new Box(1,0) addChild this.statusLine), Spacer(1), issuesBox (new Box(1,0) addChild this.issuesList), Spacer(1), imagesBox (new Box(1,0) addChild this.imagesContainer), Spacer(1), usageBox (new Box(1,0) addChild this.usageLine) → `apps/pi-asset-loop/src/tui.ts`
- `12` ADD METHOD start(): void TO AssetLoopTUI — calls this.tui.start() → `apps/pi-asset-loop/src/tui.ts`
- `13` ADD METHOD stop(): void TO AssetLoopTUI — calls this.tui.stop() → `apps/pi-asset-loop/src/tui.ts`
- `14` ADD METHOD setIteration(n: number): void TO AssetLoopTUI — assigns this.iteration = n; this.header.setText(this.formatHeader()); this.tui.requestRender() → `apps/pi-asset-loop/src/tui.ts`
- `15` ADD METHOD setPhase(phase: AssetLoopPhase, currentIssue?: CritiqueIssue | null): void TO AssetLoopTUI — assigns this.phase = phase; this.currentIssue = currentIssue ?? null; this.statusLine.setText(this.formatStatus()); this.tui.requestRender() → `apps/pi-asset-loop/src/tui.ts`
- `16` ADD METHOD setIssues(issues: CritiqueIssue[]): void TO AssetLoopTUI — assigns this.issues = [...issues]; this.currentIndex = -1; REPLACE this.issuesList WITH new SelectList(this.buildSelectItems(), Math.min(8, Math.max(issues.length, 1)), this.selectListTheme) by finding its parent Box (child index 4 in this.tui, i.e. issuesBox) and swapping — simplest: issuesBox.clear(); issuesBox.addChild(this.issuesList); this.tui.requestRender() → `apps/pi-asset-loop/src/tui.ts`
- `17` ADD METHOD setCurrentIssue(index: number): void TO AssetLoopTUI — assigns this.currentIndex = index; REPLACE this.issuesList with new SelectList(this.buildSelectItems(), ..., this.selectListTheme) (same swap as setIssues); this.issuesList.setSelectedIndex(index); this.tui.requestRender() → `apps/pi-asset-loop/src/tui.ts`
- `18` ADD METHOD setRender(base64: string, mime: string): void TO AssetLoopTUI — this.renderImage = new Image(base64, mime, this.imageTheme, { maxWidthCells: 48 }); this.imagesContainer.clear(); this.imagesContainer.addChild(new Text('reference:', 1, 0)); this.imagesContainer.addChild(this.extractedImage); this.imagesContainer.addChild(new Spacer(1)); this.imagesContainer.addChild(new Text('render:', 1, 0)); this.imagesContainer.addChild(this.renderImage); this.tui.requestRender() → `apps/pi-asset-loop/src/tui.ts`
- `19` ADD METHOD setUsage(s: UsageSnapshot): void TO AssetLoopTUI — this.usageLine.setText(formatUsageSnapshot(s)); this.tui.requestRender() → `apps/pi-asset-loop/src/tui.ts`
- `20` ADD METHOD showSummary(lines: string[]): void TO AssetLoopTUI — this.tui.clear(); this.tui.addChild(new Box(1, 1)); the last-added Box.addChild(new Text(lines.join('\n'), 0, 0)); this.tui.requestRender() → `apps/pi-asset-loop/src/tui.ts`
- `21` ADD private METHOD formatHeader(): string TO AssetLoopTUI — RETURNS `${this.assetId} · iter ${this.iteration}/${this.maxIterations}` → `apps/pi-asset-loop/src/tui.ts`
- `22` ADD private METHOD formatStatus(): string TO AssetLoopTUI — RETURNS `phase: ${this.phase}` concatenated with (this.currentIssue ? ` · [${this.currentIssue.id}] ${this.currentIssue.severity} ${this.currentIssue.region}: ${this.currentIssue.description}` : '') → `apps/pi-asset-loop/src/tui.ts`
- `23` ADD private METHOD buildSelectItems(): SelectItem[] TO AssetLoopTUI — MAPS this.issues TO items: const base = `[${issue.severity}] ${issue.region}: ${issue.description}`; const label = index < this.currentIndex ? `\x1b[2m✓ ${base}\x1b[22m` : base; RETURN { value: issue.id, label, description: `fix: ${issue.fix_hint}` } → `apps/pi-asset-loop/src/tui.ts`

### 2 Wire AssetLoopTUI into runAssetLoop

_Objective:_ Thread AssetLoopTUI through src/orchestrator.ts. Instantiate immediately after resolveAsset + reading extracted PNG base64 (already read in CP1 T2 for kickoff images). Call setPhase/setIteration/setIssues/setCurrentIssue/setRender/setUsage at each orchestrator transition. Replace the CP3 `console.log(formatUsageSnapshot(...))` calls at each termination site with `tui.showSummary([...])` + `tui.stop()`. Install a one-shot SIGINT handler that tears down the TUI and exits 130, and guarantee handler removal via a try/finally wrapping the rest of runAssetLoop.

#### Task 2: Instantiate AssetLoopTUI in runAssetLoop and wire all transitions

- Description: Thread a single AssetLoopTUI through the full deterministic loop. Construct it after resolveAsset + extractedBase64 read (extractedBase64 already exists from CP1 T2 where the kickoff message reads the four context inputs). Call tui.start() immediately. Then at every state-change boundary in runAssetLoop, call the matching update method. Replace the CP3 stdout `console.log(formatUsageSnapshot(usage.snapshot()))` calls at the three terminal sites (hit_empty return, cap return, parse-failure throw) with tui.showSummary([...]) + tui.stop(). On the parse-failure path also emit the usage line on stderr before tui.stop() so it survives terminal teardown. The per-issue for loop uses .entries() so both issueIndex and issue are available for setCurrentIssue. Each runFixStep call updates onUsage to both fold the usage into the aggregator and push the fresh snapshot into the TUI. No accepted.json shape change; no new file outputs.
- Read before:
  - `apps/pi-asset-loop/src/orchestrator.ts` (1-220) — Current runAssetLoop body after CP3 T4. Identify: (a) the point where extractedBase64 is read (CP1), (b) the initial-gen createAgentSession + session.subscribe + session.prompt block (CP1 + CP3), (c) the iteration for-loop header, (d) renderWithPlaywright call, (e) runCritique await + outcome.ok branch, (f) the per-issue for loop and the runFixStep call inside it, (g) both writeAcceptedJson return sites (hit_empty, cap) and the parse-failure console.error + throw — each currently prefixed by the CP3 console.log(formatUsageSnapshot(usage.snapshot())).
  - `apps/pi-asset-loop/src/tui.ts` (1-200) — AssetLoopTUI API from task 1 — constructor shape (AssetLoopTUIInit) and all update methods consumed here.
  - `apps/pi-asset-loop/src/usage.ts` (1-60) — formatUsageSnapshot still used for the stderr emission on the parse-failure branch.
  - `apps/pi-asset-loop/src/critic.ts` (18-50) — CritiqueIssue shape passed into tui.setIssues + tui.setPhase('fix', issue).
  - `apps/pi-asset-loop/src/args.ts` (7-63) — ResolvedAsset.renderPath (used to read render.png bytes into base64 for tui.setRender) and acceptedJsonPath (used in summary).
- Depends on: 1

**Actions:**
- `1` ADD IMPORT { AssetLoopTUI } FROM './tui.js' → `apps/pi-asset-loop/src/orchestrator.ts`
- `2` INSIDE runAssetLoop: INSERT AFTER extractedBase64 is read (and AFTER 'const usage = new UsageAggregator()') AND BEFORE the initial-gen createAgentSession call: 'const tui = new AssetLoopTUI({ assetId: resolved.assetId, maxIterations: MAX_ITERATIONS, extractedBase64, extractedMime: "image/png" })' → `apps/pi-asset-loop/src/orchestrator.ts`
- `3` INSIDE runAssetLoop: INSERT AFTER 'const tui = new AssetLoopTUI(...)': 'tui.start(); tui.setPhase("initial_gen");' → `apps/pi-asset-loop/src/orchestrator.ts`
- `4` INSIDE the initial-gen session.subscribe handler: INSERT 'tui.setUsage(usage.snapshot());' AFTER the existing 'usage.add(event.message.usage)' INSIDE the same if-block → `apps/pi-asset-loop/src/orchestrator.ts`
- `5` INSIDE runAssetLoop per-iteration for-loop: INSERT at the very top of the loop body: 'tui.setIteration(iteration); tui.setPhase("render");' → `apps/pi-asset-loop/src/orchestrator.ts`
- `6` INSIDE runAssetLoop per-iteration loop: INSERT AFTER the awaited renderWithPlaywright call AND BEFORE the runCritique call: 'const renderBase64 = readFileSync(resolved.renderPath).toString("base64"); tui.setRender(renderBase64, "image/png"); tui.setPhase("critique");' → `apps/pi-asset-loop/src/orchestrator.ts`
- `7` INSIDE runAssetLoop per-iteration loop: INSERT AFTER the existing 'for (const u of outcome.usages) usage.add(u)' line: 'tui.setUsage(usage.snapshot());' → `apps/pi-asset-loop/src/orchestrator.ts`
- `8` INSIDE runAssetLoop outcome.ok branch: INSERT 'tui.setIssues(outcome.result.issues);' IMMEDIATELY BEFORE the hit_empty check (outcome.result.issues.length === 0) → `apps/pi-asset-loop/src/orchestrator.ts`
- `9` REFACTOR per-issue iteration: REPLACE 'for (const issue of outcome.result.issues)' WITH 'for (const [issueIndex, issue] of outcome.result.issues.entries())' → `apps/pi-asset-loop/src/orchestrator.ts`
- `10` INSIDE the per-issue for loop body: INSERT at the very top of the loop body: 'tui.setPhase("fix", issue); tui.setCurrentIssue(issueIndex);' → `apps/pi-asset-loop/src/orchestrator.ts`
- `11` UPDATE runFixStep input inside per-issue loop: REPLACE the CP3-introduced 'onUsage: (u) => usage.add(u)' WITH 'onUsage: (u) => { usage.add(u); tui.setUsage(usage.snapshot()); }' → `apps/pi-asset-loop/src/orchestrator.ts`
- `12` INSIDE the hit_empty branch (outcome.result.issues.length === 0): REPLACE the CP3 'console.log(formatUsageSnapshot(usage.snapshot()))' WITH 'tui.setPhase("done"); tui.showSummary(["hit_empty: true", `iter ${iteration}/${MAX_ITERATIONS}`, formatUsageSnapshot(usage.snapshot()), `accepted: ${resolved.acceptedJsonPath}`]); tui.stop();' → `apps/pi-asset-loop/src/orchestrator.ts`
- `13` INSIDE the cap branch (iteration === MAX_ITERATIONS): REPLACE the CP3 'console.log(formatUsageSnapshot(usage.snapshot()))' WITH 'tui.setPhase("done"); tui.showSummary(["cap_reached", `iter ${iteration}/${MAX_ITERATIONS}`, formatUsageSnapshot(usage.snapshot()), `accepted: ${resolved.acceptedJsonPath}`]); tui.stop();' → `apps/pi-asset-loop/src/orchestrator.ts`
- `14` INSIDE the parse-failure branch (outcome.ok === false): REPLACE the CP3 'console.log(formatUsageSnapshot(usage.snapshot()))' WITH 'console.error(formatUsageSnapshot(usage.snapshot())); tui.stop();' (keep the existing throw after this) → `apps/pi-asset-loop/src/orchestrator.ts`

#### Task 3: Install SIGINT handler + try/finally around runAssetLoop body

- Description: Guarantee TUI teardown on Ctrl+C and on thrown exceptions from any inner await. Register a one-shot SIGINT handler immediately after tui.start() that tears down the TUI and exits 130 — the operator's only input path is Ctrl+C per spec. Wrap the remainder of runAssetLoop in try { ... } finally { process.off('SIGINT', handler) } so the handler is always removed on normal return, return-in-branch, or thrown error. The finally block does NOT call tui.stop() again (the three terminal branches already call tui.stop, and the SIGINT handler calls it before exit); it only unregisters the listener to prevent leaks across multiple runAssetLoop calls in the same process.
- Read before:
  - `apps/pi-asset-loop/src/orchestrator.ts` (1-220) — Identify the line immediately after tui.start() (from task 2) and the last return/throw in runAssetLoop. The try/finally wraps everything between them.
  - `apps/pi-asset-loop/src/tui.ts` (1-80) — Confirm stop() is idempotent-friendly (pi-tui TUI.stop sets `stopped` and is safe to call twice). If the SIGINT handler fires after a branch already called stop, the second stop is a no-op.
- Depends on: 2

**Actions:**
- `1` INSIDE runAssetLoop: INSERT IMMEDIATELY AFTER the 'tui.start(); tui.setPhase("initial_gen");' line: 'const sigintHandler = () => { try { tui.stop(); } finally { process.exit(130); } };' → `apps/pi-asset-loop/src/orchestrator.ts`
- `2` INSIDE runAssetLoop: INSERT AFTER the sigintHandler declaration: 'process.once("SIGINT", sigintHandler);' → `apps/pi-asset-loop/src/orchestrator.ts`
- `3` WRAP everything in runAssetLoop AFTER the process.once("SIGINT", sigintHandler) line (through the last return/throw) IN 'try { ... } finally { process.off("SIGINT", sigintHandler); }' — DO NOT call tui.stop() inside the finally block (inner branches handle that) → `apps/pi-asset-loop/src/orchestrator.ts`

## CP5: Cleanup, summary, end-to-end validation

**Goal:** Delete extensions/asset-loop.ts. Strip pi-extension scripts from apps/pi-asset-loop/package.json; keep bun launch script (add top-level workspace alias only if convenient). On termination, tear down TUI and print a single summary block to stdout: asset id, iterations used, hit_empty flag, residual issue count + briefs, accepted.json path, total cost. Verify end-to-end against a known asset dir — accepted.json shape must match what the old extension produced (asset_id, iterations, max_iterations, hit_empty_issues, residual_issues, verdict, notes, accepted_at).

**Prerequisites:** [4]

**Testing:** Manual end-to-end against a fresh asset dir after CP5 TG1 + TG2 land, in a Kitty/Ghostty/iTerm2/WezTerm terminal: `bun run asset-loop --asset <dir>` from apps/pi-asset-loop. Expect: (a) TUI mounts, transitions through initial_gen → render → critique → fix cycles; (b) on each termination path (hit_empty, cap_reached, critic parse-failure) the TUI tears down and a single canonical summary block appears in stdout scrollback after the shell returns, containing asset id, `iter N/15`, termination kind, residual-issue count + per-issue briefs (severity + region + description, or `residual: 0` when hit_empty), accepted.json path (omitted on parse-failure), and the formatted usage line. Verify `cat runs/<run>/assets/<id>/accepted.json | jq 'keys | sort'` returns exactly `["accepted_at","asset_id","hit_empty_issues","iterations","max_iterations","notes","residual_issues","verdict"]`. Verify `rg "extensions/asset-loop" apps/pi-asset-loop` returns zero matches and `apps/pi-asset-loop/extensions/` no longer exists. Verify `npm run typecheck` (from apps/pi-asset-loop) passes. Verify `cat apps/pi-asset-loop/package.json | jq '.scripts | keys | sort'` contains `asset-loop`, `postinstall`, `typecheck` and does NOT contain `pi`.

### 1 Shared termination summary + stdout persistence

_Objective:_ Replace CP4's per-branch inline `tui.showSummary([...])` argument arrays with a single shared helper, `buildTerminationSummary`, in orchestrator.ts. The helper composes the canonical summary block (asset id, `iter N/MAX`, termination kind, residual-issue count + per-issue briefs, accepted.json path, formatted usage line) from structured inputs so the three termination sites (hit_empty, cap_reached, parse_failure) all emit byte-identical content. Each site calls `tui.showSummary(lines)` for the ephemeral on-screen flash, then `tui.stop()`, then `console.log(lines.join('\n'))` so the block survives in scrollback after the TUI clears the screen — this is the persisted artifact the spec's Success Criteria reference.

#### Task 1: Add buildTerminationSummary helper in src/orchestrator.ts

- Description: New module-level internal function in orchestrator.ts that builds the canonical multi-line summary block shared by the in-TUI ephemeral display and the post-teardown stdout emission. Consolidates what CP4 T2 currently hard-codes in three separate `tui.showSummary([...])` call sites. Takes one structured argument and returns `string[]` — callers decide whether to join with '\n' for console.log or pass the array through to tui.showSummary (which already does its own join internally per CP4 T1 action 20). Line composition: (1) `asset: <assetId>`, (2) `iter: <n>/<max>`, (3) `termination: <kind>` where kind stringifies to `hit_empty`, `cap_reached`, or `parse_failure`, (4) `residual: <n>` followed by one indented line per residual issue formatted as `  - [<severity>] <region>: <description>` (omit the per-issue lines when n === 0), (5) `accepted: <acceptedJsonPath>` — omitted entirely when acceptedJsonPath is null (parse-failure path does not write accepted.json), (6) `usage: <formatUsageSnapshot(usage)>`. No I/O inside the helper; pure string array construction.
- Read before:
  - `apps/pi-asset-loop/src/orchestrator.ts` (1-260) — Identify where writeAcceptedJson ends and the three termination sites begin (hit_empty return, cap_reached return, parse-failure throw). The helper is added at module scope immediately after writeAcceptedJson and before runAssetLoop. Current termination sites (after CP4 T2) contain hand-rolled argument arrays like `['hit_empty: true', `iter ${iteration}/${MAX_ITERATIONS}`, formatUsageSnapshot(usage.snapshot()), `accepted: ${resolved.acceptedJsonPath}`]` — this task does NOT modify those sites (task 2 does).
  - `apps/pi-asset-loop/src/critic.ts` (18-50) — CritiqueIssue shape { id, region, severity, description, fix_hint } — residual issue formatting uses severity/region/description.
  - `apps/pi-asset-loop/src/usage.ts` (1-60) — UsageSnapshot type + formatUsageSnapshot(s) — helper's usage line delegates to formatUsageSnapshot.
  - `apps/pi-asset-loop/src/args.ts` (7-63) — ResolvedAsset.assetId + acceptedJsonPath shape — callers pass these into the helper input.

**Actions:**
- `1` ADD INTERNAL FUNCTION buildTerminationSummary(input: { kind: 'hit_empty' | 'cap_reached' | 'parse_failure'; assetId: string; iteration: number; maxIterations: number; residualIssues: CritiqueIssue[]; acceptedJsonPath: string | null; usage: UsageSnapshot }): string[] AT module scope, AFTER writeAcceptedJson AND BEFORE runAssetLoop → `apps/pi-asset-loop/src/orchestrator.ts`
- `2` INSIDE buildTerminationSummary: INIT 'const lines: string[] = []' → `apps/pi-asset-loop/src/orchestrator.ts`
- `3` INSIDE buildTerminationSummary: APPEND `asset: ${input.assetId}` TO lines → `apps/pi-asset-loop/src/orchestrator.ts`
- `4` INSIDE buildTerminationSummary: APPEND `iter: ${input.iteration}/${input.maxIterations}` TO lines → `apps/pi-asset-loop/src/orchestrator.ts`
- `5` INSIDE buildTerminationSummary: APPEND `termination: ${input.kind}` TO lines → `apps/pi-asset-loop/src/orchestrator.ts`
- `6` INSIDE buildTerminationSummary: APPEND `residual: ${input.residualIssues.length}` TO lines → `apps/pi-asset-loop/src/orchestrator.ts`
- `7` INSIDE buildTerminationSummary: IF (input.residualIssues.length > 0) FOR each issue IN input.residualIssues APPEND `  - [${issue.severity}] ${issue.region}: ${issue.description}` TO lines → `apps/pi-asset-loop/src/orchestrator.ts`
- `8` INSIDE buildTerminationSummary: IF (input.acceptedJsonPath !== null) APPEND `accepted: ${input.acceptedJsonPath}` TO lines → `apps/pi-asset-loop/src/orchestrator.ts`
- `9` INSIDE buildTerminationSummary: APPEND `usage: ${formatUsageSnapshot(input.usage)}` TO lines → `apps/pi-asset-loop/src/orchestrator.ts`
- `10` INSIDE buildTerminationSummary: RETURN lines → `apps/pi-asset-loop/src/orchestrator.ts`

#### Task 2: Rewire runAssetLoop's three termination sites to use buildTerminationSummary and console.log post-TUI

- Description: Replace the three hand-rolled `tui.showSummary([...])` argument arrays introduced in CP4 T2 with single calls to `buildTerminationSummary(...)`. After `tui.stop()` on each path, `console.log(lines.join('\n'))` so the canonical summary persists in the operator's terminal scrollback after the TUI clears the screen (pi-tui's stop restores terminal state; anything drawn via showSummary is ephemeral). The parse-failure branch is special: the TUI state may be mid-phase, so it skips tui.showSummary, calls tui.stop first, then emits the summary via console.error (keeps the error context on stderr alongside the existing thrown error) AND console.log (so a `| tee` or `>summary.log` capture still sees it). acceptedJsonPath is passed as `resolved.acceptedJsonPath` on the hit_empty and cap_reached paths, and as `null` on the parse-failure path. residualIssues is `[]` on hit_empty, `outcome.result.issues` on cap_reached, and `[]` on parse_failure (outcome.result is not available when outcome.ok is false).
- Read before:
  - `apps/pi-asset-loop/src/orchestrator.ts` (1-260) — Post-task-1 state. Locate: (a) the hit_empty branch — currently `tui.setPhase('done'); tui.showSummary(['hit_empty: true', ...]); tui.stop();` (from CP4 T2 action 12), (b) the cap_reached branch — currently `tui.setPhase('done'); tui.showSummary(['cap_reached', ...]); tui.stop();` (CP4 T2 action 13), (c) the parse-failure branch — currently `console.error(formatUsageSnapshot(usage.snapshot())); tui.stop();` followed by `throw new Error('critic parse failure')` (CP4 T2 action 14 + CP2 T6 action 8). Confirm the writeAcceptedJson call on hit_empty/cap sites still executes before the new summary logic.
  - `apps/pi-asset-loop/src/tui.ts` (1-200) — Confirm showSummary accepts string[] (CP4 T1 action 20) and stop() is safe to call even after showSummary.
- Depends on: 1

**Actions:**
- `1` INSIDE runAssetLoop hit_empty branch (outcome.result.issues.length === 0): REPLACE the CP4 T2 action-12 block 'tui.setPhase("done"); tui.showSummary(["hit_empty: true", `iter ${iteration}/${MAX_ITERATIONS}`, formatUsageSnapshot(usage.snapshot()), `accepted: ${resolved.acceptedJsonPath}`]); tui.stop();' WITH 'tui.setPhase("done"); const summary = buildTerminationSummary({ kind: "hit_empty", assetId: resolved.assetId, iteration, maxIterations: MAX_ITERATIONS, residualIssues: [], acceptedJsonPath: resolved.acceptedJsonPath, usage: usage.snapshot() }); tui.showSummary(summary); tui.stop(); console.log(summary.join("\n"));' → `apps/pi-asset-loop/src/orchestrator.ts`
- `2` INSIDE runAssetLoop cap_reached branch (iteration === MAX_ITERATIONS): REPLACE the CP4 T2 action-13 block 'tui.setPhase("done"); tui.showSummary(["cap_reached", `iter ${iteration}/${MAX_ITERATIONS}`, formatUsageSnapshot(usage.snapshot()), `accepted: ${resolved.acceptedJsonPath}`]); tui.stop();' WITH 'tui.setPhase("done"); const summary = buildTerminationSummary({ kind: "cap_reached", assetId: resolved.assetId, iteration, maxIterations: MAX_ITERATIONS, residualIssues: outcome.result.issues, acceptedJsonPath: resolved.acceptedJsonPath, usage: usage.snapshot() }); tui.showSummary(summary); tui.stop(); console.log(summary.join("\n"));' → `apps/pi-asset-loop/src/orchestrator.ts`
- `3` INSIDE runAssetLoop parse_failure branch (!outcome.ok): REPLACE the CP4 T2 action-14 block 'console.error(formatUsageSnapshot(usage.snapshot())); tui.stop();' WITH 'const summary = buildTerminationSummary({ kind: "parse_failure", assetId: resolved.assetId, iteration, maxIterations: MAX_ITERATIONS, residualIssues: [], acceptedJsonPath: null, usage: usage.snapshot() }); tui.stop(); console.error(summary.join("\n")); console.log(summary.join("\n"));' — PRESERVE the preceding CP2 T6 action-8 line 'console.error("aborted: critic parse failure — " + truncate(outcome.rawSecond, 400))' immediately BEFORE this block, and PRESERVE the trailing 'throw new Error("critic parse failure")' immediately AFTER this block → `apps/pi-asset-loop/src/orchestrator.ts`

### 2 Retire legacy pi-extension surface

_Objective:_ Remove the now-obsolete extension codepath so a reader cannot accidentally launch the old LLM-driven loop. Delete `apps/pi-asset-loop/extensions/asset-loop.ts`. Strip the `"pi": "pi -e ./extensions/asset-loop.ts"` script from `apps/pi-asset-loop/package.json` (keep `postinstall`, `typecheck`, and the `asset-loop` bun script CP1 added). Delete the now-empty `apps/pi-asset-loop/extensions/` directory so the tree reflects the SDK-driven architecture.

#### Task 3: Delete apps/pi-asset-loop/extensions/asset-loop.ts and the empty extensions/ directory

- Description: Remove the legacy Pi extension file in full. Then remove the `apps/pi-asset-loop/extensions/` directory, which becomes empty after the file deletion. This severs the last reference point to the LLM-driven loop design. No imports in src/ or bin/ point to extensions/asset-loop.ts (verified: only reusable modules live under src/, and the bin entry was authored in CP1 T2 against src/orchestrator). Deletion must happen after CP5 TG1 lands so runtime behavior for the SDK-driven path is already proven before the fallback disappears.
- Read before:
  - `apps/pi-asset-loop/extensions/asset-loop.ts` (1-40) — Confirm file identity before deletion — this is the pi extension entry (`export default function assetLoop(pi: ExtensionAPI)`). Nothing in it is still needed; the accept-tool payload shape was already lifted into writeAcceptedJson in CP2 T5.
  - `apps/pi-asset-loop/package.json` (1-25) — Confirm the `pi` script is the only reference to extensions/asset-loop.ts from within the app (removed in task 4). External references are audited in TG3 T5 via ripgrep.
- Depends on: 2

**Actions:**
- `1` DELETE FILE apps/pi-asset-loop/extensions/asset-loop.ts → `apps/pi-asset-loop/extensions/asset-loop.ts`
- `2` DELETE DIRECTORY apps/pi-asset-loop/extensions (must be empty after action 1) → `apps/pi-asset-loop/extensions`

#### Task 4: Remove the `pi` script from apps/pi-asset-loop/package.json

- Description: Drop the `"pi": "pi -e ./extensions/asset-loop.ts"` line from the scripts object in apps/pi-asset-loop/package.json. After this change scripts contains exactly: postinstall (playwright install chromium), typecheck (tsc --noEmit), and asset-loop (bun run bin/asset-loop.ts — added by CP1 T2 action 1). No other edits: dependencies, devDependencies, name, type, private, description all unchanged. JSON formatting preserved (2-space indent, trailing newline).
- Read before:
  - `apps/pi-asset-loop/package.json` (1-22) — Current scripts object: { postinstall, pi, typecheck }. After CP1 T2 it also contains `asset-loop`. This task removes only the `pi` entry.

**Actions:**
- `1` UPDATE apps/pi-asset-loop/package.json: REMOVE the scripts entry '"pi": "pi -e ./extensions/asset-loop.ts"' — leave postinstall, typecheck, and asset-loop entries intact → `apps/pi-asset-loop/package.json`
- `2` VERIFY apps/pi-asset-loop/package.json: scripts keys are exactly ['postinstall', 'typecheck', 'asset-loop'] — preserve 2-space indent and trailing newline → `apps/pi-asset-loop/package.json`

### 3 End-to-end run + accepted.json shape parity verification

_Objective:_ Execute the full pipeline against a known asset dir and assert shape parity with the legacy extension. Run typecheck, run the CLI end-to-end, inspect the stdout-persisted summary block, inspect accepted.json for the exact 8 legacy keys, confirm no stale references to the deleted extension remain, and confirm package.json scripts are clean. This is a verification task: no new code is produced, but failure on any assertion blocks CP5 completion.

#### Task 5: Run typecheck, end-to-end asset-loop, and accepted.json shape/cleanliness assertions

- Description: Pure verification task that executes after TG1 + TG2 land. Does NOT modify any source files. Runs every assertion the spec's Success Criteria imply, aborting CP5 completion on first failure. Concretely: (1) `cd apps/pi-asset-loop && npm run typecheck` — must exit 0. (2) Pick a known asset dir under `runs/` (e.g. `runs/test-1/assets/asset_01`) that has source.png + extracted.png + asset.json + extraction_prompt present. Copy to a scratch dir OR just accept that accepted.json will be overwritten. Run `bun run asset-loop --asset <path>` in a Kitty/Ghostty/iTerm2/WezTerm terminal so inline Image components render; the run should complete on hit_empty OR cap_reached (either is fine — shape is the assertion, not convergence). (3) After the shell returns, scroll up and confirm the stdout-persisted summary block is present and contains `asset:`, `iter: N/15`, `termination: hit_empty` or `termination: cap_reached`, `residual: <n>` followed by `  - [severity] region: description` lines when n>0, `accepted: <path>`, and `usage: calls=... tot=... $...`. (4) `jq 'keys | sort' <acceptedJsonPath>` must equal `["accepted_at","asset_id","hit_empty_issues","iterations","max_iterations","notes","residual_issues","verdict"]` — exactly these 8 keys, no more, no fewer. (5) `rg 'extensions/asset-loop' apps/pi-asset-loop` must return zero matches. (6) `test ! -d apps/pi-asset-loop/extensions` must succeed (directory removed). (7) `jq '.scripts | keys | sort' apps/pi-asset-loop/package.json` must return `["asset-loop","postinstall","typecheck"]` — specifically no `pi` entry. Optional force-failure variant: temporarily point the critic at a model that cannot emit JSON to confirm the parse-failure branch also prints the summary block (termination: parse_failure, no `accepted:` line). Report each check individually in the final task output so a reader can see what passed and what did not.
- Read before:
  - `apps/pi-asset-loop/package.json` (1-25) — Post-TG2 state — confirm `pi` script absent, `asset-loop` script present.
  - `apps/pi-asset-loop/src/orchestrator.ts` (1-260) — Reference the termination sites so you know which console.log lines to look for in scrollback.
  - `apps/pi-asset-loop/src/args.ts` (7-63) — ResolvedAsset paths — acceptedJsonPath location for jq inspection.
  - `apps/pi-asset-loop/extensions/asset-loop.ts` (309-320) — Legacy accepted.json payload — canonical 8-key shape. NOTE: this file is deleted by TG2 T3; this pointer is for the agent's reference only (key list reproduced in this task's description).
- Depends on: 2, 3, 4

**Actions:**
- `1` RUN 'cd apps/pi-asset-loop && npm run typecheck' AND ASSERT exit code === 0 → `apps/pi-asset-loop/package.json`
- `2` IDENTIFY a known asset dir under runs/ (e.g. runs/test-1/assets/asset_01) WITH source.png + extracted.png + asset.json + extraction_prompt present → `runs`
- `3` RUN 'cd apps/pi-asset-loop && bun run asset-loop --asset <known asset dir>' IN a Kitty/Ghostty/iTerm2/WezTerm terminal AND WAIT for the run to complete (hit_empty, cap_reached, or parse_failure — any termination kind is acceptable for shape verification) → `apps/pi-asset-loop/bin/asset-loop.ts`
- `4` VERIFY the stdout-persisted summary block in scrollback CONTAINS 'asset: <id>', 'iter: <n>/15', 'termination: <kind>', 'residual: <n>' (with per-issue lines when n>0), 'accepted: <path>' when kind !== parse_failure, AND 'usage: calls=... tot=... $...' → `apps/pi-asset-loop/src/orchestrator.ts`
- `5` RUN 'jq "keys | sort" <acceptedJsonPath>' AND ASSERT output equals '["accepted_at","asset_id","hit_empty_issues","iterations","max_iterations","notes","residual_issues","verdict"]' (exactly 8 keys, nothing more) → `runs`
- `6` RUN 'rg "extensions/asset-loop" apps/pi-asset-loop' AND ASSERT zero matches (exit code 1 from ripgrep) → `apps/pi-asset-loop`
- `7` RUN 'test ! -d apps/pi-asset-loop/extensions' AND ASSERT exit code === 0 → `apps/pi-asset-loop/extensions`
- `8` RUN 'jq ".scripts | keys | sort" apps/pi-asset-loop/package.json' AND ASSERT output equals '["asset-loop","postinstall","typecheck"]' → `apps/pi-asset-loop/package.json`
- `9` REPORT pass/fail for each of actions 1, 3, 4, 5, 6, 7, 8 — if any assertion fails, surface the failure details and stop (do NOT mark CP5 complete) → `apps/pi-asset-loop`

