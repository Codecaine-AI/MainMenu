/**
 * MELEE asset-recreation loop as a pi extension.
 *
 * Launch:
 *   pi -e apps/pi-asset-loop/extensions/asset-loop.ts \
 *      --asset runs/test-1/assets/asset_03
 *
 * The agent writes component.html + component.css into the asset dir, calls the
 * custom `render` tool to produce render.png, sees the reference and the new
 * render inline in the tool result, iterates, and calls `accept` when it would
 * ship. Hard cap of 10 render calls per session.
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

const MAX_ITERATIONS = 15;
const MIN_ACCEPT_SCORE = 0.95;
const MODEL_CANDIDATES: Array<{ provider: string; id: string }> = [
  { provider: "anthropic", id: "claude-opus-4-7" },
];

const formatScore = (score: number | null): string =>
  score === null ? "—" : score.toFixed(2);

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
  let iteration = 0;
  let accepted = false;
  let reviewedSinceLastWrite = false;
  let latestScore: number | null = null;

  const refreshWidget = (ctx: ExtensionContext) => {
    if (!resolved) return;
    const scoreStr = formatScore(latestScore);
    const lines = [
      `asset: ${resolved.assetId}`,
      `iter:  ${iteration}/${MAX_ITERATIONS}${accepted ? "  (accepted)" : ""}`,
      `score: ${scoreStr} / ${MIN_ACCEPT_SCORE.toFixed(2)}`,
      `dir:   ${resolved.assetDir}`,
    ];
    ctx.ui.setStatus(
      "asset-loop",
      `${resolved.assetId} · iter ${iteration}/${MAX_ITERATIONS} · score ${scoreStr}/${MIN_ACCEPT_SCORE.toFixed(2)}${accepted ? " ✓" : ""}`,
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
    const extractionPromptText = readFileSync(resolved.extractionPromptPath, "utf8");

    await pickModel(pi, ctx);
    pi.setThinkingLevel("high");
    refreshWidget(ctx);

    // Kick off the first turn with all four inputs the system prompt expects:
    // source screenshot, extracted asset, extraction prompt, asset metadata
    // (metadata is already baked into the system prompt by before_agent_start).
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
      maxIterations: MAX_ITERATIONS,
      minAcceptScore: MIN_ACCEPT_SCORE,
    });
    return { systemPrompt: prompt };
  });

  pi.on("tool_call", async (event, _ctx) => {
    if (event.toolName === "render") {
      if (!reviewedSinceLastWrite) {
        return {
          block: true,
          reason:
            "Call the `review` tool first. Post a code-only critique of the current component.html and component.css before spending a render call.",
        };
      }
      if (iteration >= MAX_ITERATIONS) {
        return {
          block: true,
          reason: `Max iterations (${MAX_ITERATIONS}) reached. Call \`accept\` with your current result or stop.`,
        };
      }
    }

    // Re-lock the review gate on any write/edit that touches the component files.
    if (event.toolName === "write" || event.toolName === "edit") {
      const path = (event.input as { path?: unknown } | undefined)?.path;
      if (
        typeof path === "string" &&
        (path.endsWith("component.html") || path.endsWith("component.css"))
      ) {
        reviewedSinceLastWrite = false;
      }
    }

    return { block: false };
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    ctx.ui.setStatus("asset-loop", undefined);
    ctx.ui.setWidget("asset-loop-progress", undefined);
  });

  pi.registerTool({
    name: "review",
    label: "Pre-render review",
    description:
      "Post a code-only self-critique of the current component.html and component.css BEFORE calling render. Required before every render. Editing component.html or component.css after review re-locks the render gate.",
    parameters: Type.Object({
      critique: Type.String({
        description:
          "Prose critique covering: does the code attempt every element in visual_description; are sizes/colors/borders sourced from the reference or invented (name the values); structural errors; a concrete prediction of what will be wrong in the next render.",
      }),
    }),
    async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
      reviewedSinceLastWrite = true;
      return {
        content: [
          {
            type: "text" as const,
            text: "Review recorded. Render gate open. Editing component.html or component.css will re-lock it.",
          },
        ],
        details: { reviewedSinceLastWrite: true },
      };
    },
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
      reviewedSinceLastWrite = false;
      refreshWidget(ctx);

      return {
        content: [
          {
            type: "text" as const,
            text: `Iteration ${iteration}/${MAX_ITERATIONS}. Reference (native ${referenceWidth}x${referenceHeight}) first, current render second.`,
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
    name: "score",
    label: "Record fidelity score",
    description:
      "Record a self-assessed fidelity score for the most recent render, in [0, 1]. Call after your post-render critique. The score is shown in the UI and gates `accept`: you cannot accept until the score reaches the threshold or the iteration cap is hit. 1.0 means nearly exact; 0.9 means minor visible drift; 0.7 means shippable but clearly imperfect.",
    parameters: Type.Object({
      fidelity: Type.Number({
        description: "Self-assessed fidelity in [0, 1], grounded in your post-render critique.",
      }),
      rationale: Type.String({
        description:
          "One or two sentences justifying the score against the defects you named in the post-render critique.",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const clamped = Math.max(0, Math.min(1, params.fidelity));
      latestScore = clamped;
      refreshWidget(ctx);
      const gateMsg =
        clamped >= MIN_ACCEPT_SCORE
          ? `Score ${clamped.toFixed(2)} meets the acceptance bar (${MIN_ACCEPT_SCORE.toFixed(2)}). You may call \`accept\`.`
          : iteration >= MAX_ITERATIONS
            ? `Score ${clamped.toFixed(2)} is below the acceptance bar (${MIN_ACCEPT_SCORE.toFixed(2)}), but you are out of render budget. Call \`accept\` and record residual defects in notes.`
            : `Score ${clamped.toFixed(2)} is below the acceptance bar (${MIN_ACCEPT_SCORE.toFixed(2)}). Iterate: fix the defects named in your critique, then review + render again.`;
      return {
        content: [{ type: "text" as const, text: gateMsg }],
        details: { fidelity: clamped, rationale: params.rationale, threshold: MIN_ACCEPT_SCORE },
      };
    },
  });

  pi.registerTool({
    name: "accept",
    label: "Accept asset",
    description:
      "Call when the current component.html + component.css + render.png are good enough to ship. Writes accepted.json and shuts down the session.",
    parameters: Type.Object({
      score: Type.Number({
        description: "Self-assessed fidelity in [0, 1]. 1.0 means nearly exact visual match.",
      }),
      notes: Type.Array(Type.String(), {
        description:
          "Short notes for the record: residual defects, raster fallbacks used, anything a later reviewer should know.",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!resolved) {
        throw new Error("Extension not initialized; asset not resolved.");
      }
      const clamped = Math.max(0, Math.min(1, params.score));
      if (clamped < MIN_ACCEPT_SCORE && iteration < MAX_ITERATIONS) {
        throw new Error(
          `Cannot accept at score ${clamped.toFixed(2)}: below acceptance bar ${MIN_ACCEPT_SCORE.toFixed(2)} and render budget not exhausted (${iteration}/${MAX_ITERATIONS}). Keep iterating.`,
        );
      }
      latestScore = clamped;
      const payload = {
        asset_id: resolved.assetId,
        iterations: iteration,
        max_iterations: MAX_ITERATIONS,
        score: clamped,
        min_accept_score: MIN_ACCEPT_SCORE,
        hit_threshold: clamped >= MIN_ACCEPT_SCORE,
        notes: params.notes,
        accepted_at: new Date().toISOString(),
      };
      writeFileSync(resolved.acceptedJsonPath, `${JSON.stringify(payload, null, 2)}\n`);
      accepted = true;
      refreshWidget(ctx);
      ctx.shutdown();
      return {
        content: [
          {
            type: "text" as const,
            text: `Accepted asset ${resolved.assetId} after ${iteration} iteration(s) at score ${clamped.toFixed(2)} (bar ${MIN_ACCEPT_SCORE.toFixed(2)}). Wrote ${resolved.acceptedJsonPath}.`,
          },
        ],
        details: payload,
      };
    },
  });
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
    "claude-opus-4-6 unavailable. Falling back to current model.",
    "error",
  );
}
