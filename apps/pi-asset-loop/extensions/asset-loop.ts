/**
 * MELEE asset-recreation loop as a pi extension.
 *
 * Launch:
 *   pi -e apps/pi-asset-loop/extensions/asset-loop.ts \
 *      --asset runs/test-1/assets/asset_03
 *
 * The main agent writes component.html + component.css, calls `render` to
 * produce render.png, then calls `critique` — an isolated vision-capable
 * sub-agent that returns a structured issue list. The main agent fixes every
 * issue and renders again. Loop terminates on empty issue list or iteration cap.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

import { resolveAsset, type ResolvedAsset } from "../src/args.ts";
import { buildRenderWrapper } from "../src/wrapper.ts";
import { renderWithPlaywright } from "../src/renderer.ts";
import { buildSystemPrompt } from "../src/systemPrompt.ts";
import { readPngSize } from "../src/pngSize.ts";
import { runCritique, type CritiqueIssue, type CritiqueOutcome, type CritiqueResult, type IssueSeverity } from "../src/critic.ts";

const MAX_ITERATIONS = 15;
const MODEL_CANDIDATES: Array<{ provider: string; id: string }> = [
  { provider: "anthropic", id: "claude-opus-4-7" },
];

export default function assetLoop(pi: ExtensionAPI) {
  pi.registerFlag("asset", {
    description: "Path to an asset dir, or a bare id when combined with --run.",
    type: "string",
  });
  pi.registerFlag("run", {
    description: "Run dir containing assets/<id>/ (only needed when --asset is a bare id).",
    type: "string",
  });

  let resolved: ResolvedAsset | null = null;
  let referenceBase64: string | null = null;
  let referenceWidth = 0;
  let referenceHeight = 0;
  let assetJsonText = "";
  let extractionPromptText = "";
  let iteration = 0;
  let accepted = false;
  let lastCritique: CritiqueResult | null = null;
  let renderedSinceLastCritique = false;
  let critiquedSinceLastRender = false;
  let toolsLine = "tools: —";

  const issueCountsLine = (): string => {
    if (!lastCritique) return "issues: —";
    if (lastCritique.issues.length === 0) return "issues: none";
    return `issues: ${countBy(lastCritique.issues, "blocking")} blocking · ${countBy(lastCritique.issues, "major")} major · ${countBy(lastCritique.issues, "minor")} minor`;
  };

  const issueStatusSuffix = (): string => {
    if (!lastCritique) return "";
    if (lastCritique.issues.length === 0) return " · issues: none";
    return ` · b:${countBy(lastCritique.issues, "blocking")} m:${countBy(lastCritique.issues, "major")} mn:${countBy(lastCritique.issues, "minor")}`;
  };

  const refreshWidget = (ctx: ExtensionContext) => {
    if (!resolved) return;
    const lines = [
      `asset: ${resolved.assetId}`,
      `iter:  ${iteration}/${MAX_ITERATIONS}${accepted ? "  (accepted)" : ""}`,
      issueCountsLine(),
      toolsLine,
    ];
    ctx.ui.setStatus(
      "asset-loop",
      `${resolved.assetId} · iter ${iteration}/${MAX_ITERATIONS}${issueStatusSuffix()}${accepted ? " ✓" : ""}`,
    );
    ctx.ui.setWidget("asset-loop-progress", lines, { placement: "belowEditor" });
  };

  pi.on("session_start", async (_event, ctx) => {
    resolved = resolveAsset({
      asset: pi.getFlag("asset") as string | undefined,
      run: pi.getFlag("run") as string | undefined,
      cwd: ctx.cwd,
    });

    assetJsonText = readFileSync(resolved.assetJsonPath, "utf8");
    const referenceBuf = readFileSync(resolved.extractedPngPath);
    referenceBase64 = referenceBuf.toString("base64");
    const dims = readPngSize(referenceBuf);
    referenceWidth = dims.width;
    referenceHeight = dims.height;

    const sourceBase64 = readFileSync(resolved.sourcePngPath).toString("base64");
    extractionPromptText = readFileSync(resolved.extractionPromptPath, "utf8");

    await pickModel(pi, ctx);
    pi.setThinkingLevel("high");

    const allNames = pi.getAllTools().map((t) => t.name).sort();
    const activeNames = new Set(pi.getActiveTools());
    toolsLine = `tools: ${allNames
      .map((n) => (activeNames.has(n) ? n : `${n}*`))
      .join(", ")}`;
    refreshWidget(ctx);

    // Kick off the first turn with all four inputs the system prompt expects.
    pi.sendUserMessage([
      {
        type: "text",
        text: `Context for asset "${resolved.assetId}". Four inputs follow: source screenshot (ground truth in situ), extracted asset (native ${referenceWidth}x${referenceHeight}px; your primary render target), the extraction prompt that produced the extracted asset, and asset metadata (already in the system prompt). Read all four before writing code.\n\nExtraction prompt that produced the extracted image:\n\n${extractionPromptText}`,
      },
      { type: "text", text: "Source screenshot (ground truth in situ):" },
      { type: "image", data: sourceBase64, mimeType: "image/png" },
      { type: "text", text: "Extracted asset (your primary render target):" },
      { type: "image", data: referenceBase64, mimeType: "image/png" },
    ]);
  });

  pi.on("before_agent_start", async (_event, _ctx) => {
    if (!resolved) return;
    const prompt = buildSystemPrompt({
      assetId: resolved.assetId,
      assetDir: resolved.assetDir,
      assetJson: assetJsonText,
      referenceWidth,
      referenceHeight,
    });
    return { systemPrompt: prompt };
  });

  pi.on("tool_call", async (event, _ctx) => {
    if (event.toolName === "render" && iteration >= MAX_ITERATIONS) {
      return {
        block: true,
        reason: `Max iterations (${MAX_ITERATIONS}) reached. Call \`accept\` with your current result.`,
      };
    }

    // Any write/edit to component files invalidates the last critique.
    if (event.toolName === "write" || event.toolName === "edit") {
      const path = (event.input as { path?: unknown } | undefined)?.path;
      if (
        typeof path === "string" &&
        (path.endsWith("component.html") || path.endsWith("component.css"))
      ) {
        critiquedSinceLastRender = false;
      }
    }

    return { block: false };
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    ctx.ui.setStatus("asset-loop", undefined);
    ctx.ui.setWidget("asset-loop-progress", undefined);
  });

  pi.registerTool({
    name: "render",
    label: "Render asset",
    description:
      "Build the wrapper from the current component.html + component.css, screenshot #asset-root, write render.png, and return the extracted reference and the new render as inline images for comparison.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      if (!resolved || !referenceBase64) {
        throw new Error("Extension not initialized; asset not resolved.");
      }

      let componentHtml: string;
      let componentCss: string;
      try {
        componentHtml = readFileSync(resolved.componentHtmlPath, "utf8");
      } catch {
        throw new Error(
          `Missing ${basename(resolved.componentHtmlPath)}. Write it before calling render.`,
        );
      }
      try {
        componentCss = readFileSync(resolved.componentCssPath, "utf8");
      } catch {
        throw new Error(
          `Missing ${basename(resolved.componentCssPath)}. Write it before calling render.`,
        );
      }

      writeFileSync(resolved.wrapperPath, buildRenderWrapper(componentHtml, componentCss));

      await renderWithPlaywright({
        wrapperPath: resolved.wrapperPath,
        renderPath: resolved.renderPath,
        referenceWidth,
        referenceHeight,
      });

      const renderBase64 = readFileSync(resolved.renderPath).toString("base64");
      iteration += 1;
      renderedSinceLastCritique = true;
      critiquedSinceLastRender = false;
      refreshWidget(ctx);

      return {
        content: [
          {
            type: "text" as const,
            text: `Iteration ${iteration}/${MAX_ITERATIONS}. Reference (native ${referenceWidth}x${referenceHeight}) first, current render second. Call \`critique\` to get the issue list.`,
          },
          { type: "image" as const, data: referenceBase64, mimeType: "image/png" },
          { type: "image" as const, data: renderBase64, mimeType: "image/png" },
        ],
        details: {
          iteration,
          maxIterations: MAX_ITERATIONS,
          renderPath: resolved.renderPath,
        },
      };
    },
  });

  pi.registerTool({
    name: "critique",
    label: "Critique render",
    description:
      "Launch an isolated critic agent with the source screenshot, extracted reference, the current render.png, the extraction prompt, and asset.json. Returns a structured JSON issue list (blocking/major/minor severities). The critic is the scoring authority — fix every issue it reports, then render + critique again. Loop terminates when issues is empty. Gate: you must have rendered since the last critique.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      if (!resolved) {
        throw new Error("Extension not initialized; asset not resolved.");
      }
      if (!renderedSinceLastCritique) {
        throw new Error(
          "No new render since the last critique. Call `render` first, then `critique`.",
        );
      }
      if (!ctx.model) {
        throw new Error("No model configured; cannot run critic.");
      }
      const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model);
      if (!auth.ok) {
        throw new Error(`Cannot resolve credentials for critic: ${auth.error}`);
      }

      const outcome = await runCritique({
        model: ctx.model,
        auth: { apiKey: auth.apiKey, headers: auth.headers },
        sourcePngPath: resolved.sourcePngPath,
        extractedPngPath: resolved.extractedPngPath,
        renderPngPath: resolved.renderPath,
        extractionPromptText,
        assetJson: assetJsonText,
        signal: ctx.signal,
      });
      if (!outcome.ok) {
        throw new Error(`Critic parse failure after retry: ${truncate(outcome.rawSecond, 400)}`);
      }
      const result = outcome.result;

      lastCritique = result;
      renderedSinceLastCritique = false;
      critiquedSinceLastRender = true;

      const persisted = {
        iteration,
        verdict: result.verdict,
        issues: result.issues,
      };
      writeFileSync(resolved.critiqueJsonPath, `${JSON.stringify(persisted, null, 2)}\n`);

      refreshWidget(ctx);

      return {
        content: [
          {
            type: "text" as const,
            text: formatCritiqueForAgent(result, iteration, MAX_ITERATIONS),
          },
        ],
        details: persisted,
      };
    },
  });

  pi.registerTool({
    name: "accept",
    label: "Accept asset",
    description:
      "Call when the critic returns zero issues, or when you have hit the iteration cap. Writes accepted.json and shuts down the session. Blocked if there is no fresh critique for the current render, or if the critic still has issues and you have iterations remaining.",
    parameters: Type.Object({
      notes: Type.Array(Type.String(), {
        description:
          "Short notes for the record: residual defects (if accepting at cap), raster fallbacks used, anything a later reviewer should know.",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!resolved) {
        throw new Error("Extension not initialized; asset not resolved.");
      }
      if (!critiquedSinceLastRender || !lastCritique) {
        throw new Error(
          "No fresh critique for the current render. Call `render` then `critique` before accepting.",
        );
      }
      const outstandingIssues = lastCritique.issues;
      const hitEmpty = outstandingIssues.length === 0;
      if (!hitEmpty && iteration < MAX_ITERATIONS) {
        throw new Error(
          `Critic still reports ${outstandingIssues.length} issue(s) and you have ${MAX_ITERATIONS - iteration} render(s) left. Fix the issues, render, and critique again.`,
        );
      }

      const payload = {
        asset_id: resolved.assetId,
        iterations: iteration,
        max_iterations: MAX_ITERATIONS,
        hit_empty_issues: hitEmpty,
        residual_issues: outstandingIssues,
        verdict: lastCritique.verdict,
        notes: params.notes,
        accepted_at: new Date().toISOString(),
      };
      writeFileSync(resolved.acceptedJsonPath, `${JSON.stringify(payload, null, 2)}\n`);
      accepted = true;
      refreshWidget(ctx);
      ctx.shutdown();

      const reason = hitEmpty
        ? "critic returned zero issues"
        : `iteration cap reached with ${outstandingIssues.length} residual issue(s)`;
      return {
        content: [
          {
            type: "text" as const,
            text: `Accepted asset ${resolved.assetId} after ${iteration} iteration(s) — ${reason}. Wrote ${resolved.acceptedJsonPath}.`,
          },
        ],
        details: payload,
      };
    },
  });
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function countBy(issues: CritiqueIssue[], severity: IssueSeverity): number {
  let n = 0;
  for (const i of issues) if (i.severity === severity) n++;
  return n;
}

function formatCritiqueForAgent(
  result: CritiqueResult,
  iteration: number,
  maxIterations: number,
): string {
  const lines: string[] = [];
  lines.push(`Critique for iteration ${iteration}/${maxIterations}.`);
  lines.push(`Verdict: ${result.verdict || "(none)"}`);
  lines.push("");
  if (result.issues.length === 0) {
    lines.push("Issues: none. The critic has no defects to report — call `accept`.");
    return lines.join("\n");
  }
  const b = countBy(result.issues, "blocking");
  const m = countBy(result.issues, "major");
  const mn = countBy(result.issues, "minor");
  lines.push(`Issues: ${b} blocking · ${m} major · ${mn} minor. Fix every blocking and major issue, and every minor unless fixing would regress something else. Then call \`render\` and \`critique\` again.`);
  lines.push("");
  for (const severity of ["blocking", "major", "minor"] as const) {
    const group = result.issues.filter((i) => i.severity === severity);
    if (group.length === 0) continue;
    lines.push(`${severity.toUpperCase()}:`);
    for (const issue of group) {
      lines.push(`  [${issue.id}] region=${issue.region}`);
      lines.push(`    ${issue.description}`);
      if (issue.fix_hint) lines.push(`    fix_hint: ${issue.fix_hint}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

async function pickModel(pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
  for (const candidate of MODEL_CANDIDATES) {
    const model = ctx.modelRegistry.find(candidate.provider, candidate.id);
    if (!model) continue;
    const ok = await pi.setModel(model);
    if (ok) {
      if (candidate.id !== MODEL_CANDIDATES[0]!.id) {
        ctx.ui.notify(
          `Using ${candidate.provider}/${candidate.id} (preferred ${MODEL_CANDIDATES[0]!.id} unavailable).`,
          "warning",
        );
      }
      return;
    }
  }
  ctx.ui.notify(
    `${MODEL_CANDIDATES[0]!.id} unavailable. Falling back to current model.`,
    "error",
  );
}
