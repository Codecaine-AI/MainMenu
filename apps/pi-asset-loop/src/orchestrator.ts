// TypeScript-driven asset-loop orchestrator (thin slice).
//
// Owns one end-to-end pass: resolve asset → one in-memory Pi SDK session that
// writes component.html/.css (initial-gen) → one Playwright render → one
// critic call → write critique.json. No iteration, no fix loop, no accepted.json
// in this slice — those land in CP2.

import { readFileSync, writeFileSync } from "node:fs";

import { getModel } from "@mariozechner/pi-ai";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRegistry,
  SessionManager,
} from "@mariozechner/pi-coding-agent";

import { resolveAsset, type ResolvedAsset, type ResolveInput } from "./args.ts";
import { runCritique, type CritiqueIssue } from "./critic.ts";
import { runFixStep } from "./fixStep.ts";
import { readPngSize } from "./pngSize.ts";
import { renderWithPlaywright } from "./renderer.ts";
import { buildSystemPrompt } from "./systemPrompt.ts";
import { AssetLoopTUI } from "./tui.ts";
import { UsageAggregator, formatUsageSnapshot, type UsageSnapshot } from "./usage.ts";
import { buildRenderWrapper } from "./wrapper.ts";

const MODEL_PROVIDER = "anthropic" as const;
const MODEL_ID = "claude-opus-4-7" as const;
const MAX_ITERATIONS = 15;

function writeAcceptedJson(
  resolved: ResolvedAsset,
  payload: {
    iterations: number;
    hitEmpty: boolean;
    residualIssues: CritiqueIssue[];
    verdict: string;
  },
): void {
  const notes: string[] = payload.hitEmpty
    ? [`converged at iteration ${payload.iterations}`]
    : [
        `iteration cap reached at ${payload.iterations} renders`,
        `${payload.residualIssues.length} residual issue(s)`,
      ];
  const output = {
    asset_id: resolved.assetId,
    iterations: payload.iterations,
    max_iterations: MAX_ITERATIONS,
    hit_empty_issues: payload.hitEmpty,
    residual_issues: payload.residualIssues,
    verdict: payload.verdict,
    notes,
    accepted_at: new Date().toISOString(),
  };
  writeFileSync(resolved.acceptedJsonPath, `${JSON.stringify(output, null, 2)}\n`);
}

function buildTerminationSummary(input: {
  kind: "hit_empty" | "cap_reached" | "parse_failure";
  assetId: string;
  iteration: number;
  maxIterations: number;
  residualIssues: CritiqueIssue[];
  acceptedJsonPath: string | null;
  usage: UsageSnapshot;
}): string[] {
  const lines: string[] = [];
  lines.push(`asset: ${input.assetId}`);
  lines.push(`iter: ${input.iteration}/${input.maxIterations}`);
  lines.push(`termination: ${input.kind}`);
  lines.push(`residual: ${input.residualIssues.length}`);
  if (input.residualIssues.length > 0) {
    for (const issue of input.residualIssues) {
      lines.push(`  - [${issue.severity}] ${issue.region}: ${issue.description}`);
    }
  }
  if (input.acceptedJsonPath !== null) {
    lines.push(`accepted: ${input.acceptedJsonPath}`);
  }
  lines.push(formatUsageSnapshot(input.usage));
  return lines;
}

export async function runAssetLoop(input: ResolveInput): Promise<void> {
  const resolved = resolveAsset(input);
  const usage = new UsageAggregator();

  const referenceBuf = readFileSync(resolved.extractedPngPath);
  const { width: referenceWidth, height: referenceHeight } = readPngSize(referenceBuf);
  const referenceBase64 = referenceBuf.toString("base64");
  const sourceBase64 = readFileSync(resolved.sourcePngPath).toString("base64");
  const assetJsonText = readFileSync(resolved.assetJsonPath, "utf8");
  const extractionPromptText = readFileSync(resolved.extractionPromptPath, "utf8");

  const tui = new AssetLoopTUI({
    assetId: resolved.assetId,
    maxIterations: MAX_ITERATIONS,
    extractedBase64: referenceBase64,
    extractedMime: "image/png",
  });
  tui.start();
  tui.setPhase("initial_gen");

  const sigintHandler = () => {
    try {
      tui.stop();
    } finally {
      process.exit(130);
    }
  };
  process.once("SIGINT", sigintHandler);

  try {
  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);

  const model = getModel(MODEL_PROVIDER, MODEL_ID);
  if (!model) {
    throw new Error(`Model not found: ${MODEL_PROVIDER}/${MODEL_ID}`);
  }

  const systemPrompt = buildSystemPrompt({
    assetId: resolved.assetId,
    assetDir: resolved.assetDir,
    assetJson: assetJsonText,
    referenceWidth,
    referenceHeight,
  });

  const agentDir = getAgentDir();
  const resourceLoader = new DefaultResourceLoader({
    cwd: resolved.assetDir,
    agentDir,
    systemPromptOverride: () => systemPrompt,
  });
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    cwd: resolved.assetDir,
    agentDir,
    model,
    thinkingLevel: "high",
    authStorage,
    modelRegistry,
    resourceLoader,
    sessionManager: SessionManager.inMemory(),
  });

  session.subscribe((event) => {
    if (
      event.type === "message_end" &&
      event.message?.role === "assistant" &&
      event.message.usage
    ) {
      usage.add(event.message.usage);
      tui.setUsage(usage.snapshot());
    }
  });

  const kickoffText = [
    `Context for asset "${resolved.assetId}". Four inputs follow: source screenshot (ground truth in situ), extracted asset (native ${referenceWidth}x${referenceHeight}px; your primary render target), the extraction prompt that produced the extracted asset, and asset metadata (already in the system prompt). Read all four before writing code.`,
    "",
    "Extraction prompt that produced the extracted image:",
    "",
    extractionPromptText.trim(),
    "",
    "Source screenshot (ground truth in situ) first, extracted asset (primary render target) second.",
  ].join("\n");

  console.log("phase: initial-gen");
  await session.prompt(kickoffText, {
    images: [
      { type: "image", data: sourceBase64, mimeType: "image/png" },
      { type: "image", data: referenceBase64, mimeType: "image/png" },
    ],
  });
  await session.agent.waitForIdle();
  session.dispose();

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    tui.setIteration(iteration);
    tui.setPhase("render");
    console.log(`phase: render iter ${iteration}/${MAX_ITERATIONS}`);
    const componentHtml = readFileSync(resolved.componentHtmlPath, "utf8");
    const componentCss = readFileSync(resolved.componentCssPath, "utf8");
    writeFileSync(resolved.wrapperPath, buildRenderWrapper(componentHtml, componentCss));
    await renderWithPlaywright({
      wrapperPath: resolved.wrapperPath,
      renderPath: resolved.renderPath,
      referenceWidth,
      referenceHeight,
    });
    const renderBase64 = readFileSync(resolved.renderPath).toString("base64");
    tui.setRender(renderBase64, "image/png");
    tui.setPhase("critique");

    console.log(`phase: critique iter ${iteration}`);
    const auth = await modelRegistry.getApiKeyAndHeaders(model);
    if (!auth.ok) {
      throw new Error(`Cannot resolve credentials for critic: ${auth.error}`);
    }
    const outcome = await runCritique({
      model,
      auth: { apiKey: auth.apiKey, headers: auth.headers },
      sourcePngPath: resolved.sourcePngPath,
      extractedPngPath: resolved.extractedPngPath,
      renderPngPath: resolved.renderPath,
      extractionPromptText,
      assetJson: assetJsonText,
    });
    for (const u of outcome.usages) usage.add(u);
    tui.setUsage(usage.snapshot());

    if (!outcome.ok) {
      console.error(
        `aborted: critic parse failure — ${truncate(outcome.rawSecond, 400)}`,
      );
      const summary = buildTerminationSummary({
        kind: "parse_failure",
        assetId: resolved.assetId,
        iteration,
        maxIterations: MAX_ITERATIONS,
        residualIssues: [],
        acceptedJsonPath: null,
        usage: usage.snapshot(),
      });
      tui.stop();
      console.error(summary.join("\n"));
      console.log(summary.join("\n"));
      throw new Error("critic parse failure");
    }

    writeFileSync(
      resolved.critiqueJsonPath,
      `${JSON.stringify({ iteration, verdict: outcome.result.verdict, issues: outcome.result.issues }, null, 2)}\n`,
    );

    tui.setIssues(outcome.result.issues);

    if (outcome.result.issues.length === 0) {
      console.log("accepted — hit_empty");
      writeAcceptedJson(resolved, {
        iterations: iteration,
        hitEmpty: true,
        residualIssues: [],
        verdict: outcome.result.verdict,
      });
      tui.setPhase("done");
      const summary = buildTerminationSummary({
        kind: "hit_empty",
        assetId: resolved.assetId,
        iteration,
        maxIterations: MAX_ITERATIONS,
        residualIssues: [],
        acceptedJsonPath: resolved.acceptedJsonPath,
        usage: usage.snapshot(),
      });
      tui.showSummary(summary);
      tui.stop();
      console.log(summary.join("\n"));
      return;
    }

    if (iteration === MAX_ITERATIONS) {
      console.log("accepted — cap");
      writeAcceptedJson(resolved, {
        iterations: iteration,
        hitEmpty: false,
        residualIssues: outcome.result.issues,
        verdict: outcome.result.verdict,
      });
      tui.setPhase("done");
      const summary = buildTerminationSummary({
        kind: "cap_reached",
        assetId: resolved.assetId,
        iteration,
        maxIterations: MAX_ITERATIONS,
        residualIssues: outcome.result.issues,
        acceptedJsonPath: resolved.acceptedJsonPath,
        usage: usage.snapshot(),
      });
      tui.showSummary(summary);
      tui.stop();
      console.log(summary.join("\n"));
      return;
    }

    console.log(`phase: fix iter ${iteration} — ${outcome.result.issues.length} issues`);
    for (const [issueIndex, issue] of outcome.result.issues.entries()) {
      tui.setPhase("fix", issue);
      tui.setCurrentIssue(issueIndex);
      console.log(`fix ${issue.id}: ${issue.severity} ${issue.region}`);
      await runFixStep({
        resolved,
        issue,
        iteration,
        assetJsonText,
        extractionPromptText,
        referenceWidth,
        referenceHeight,
        sourceBase64,
        extractedBase64: referenceBase64,
        currentRenderBase64: renderBase64,
        model,
        authStorage,
        modelRegistry,
        onUsage: (u) => {
          usage.add(u);
          tui.setUsage(usage.snapshot());
        },
      });
    }
  }
  } finally {
    process.off("SIGINT", sigintHandler);
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}
