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

const MAX_ITERATIONS = 10;
const MODEL_CANDIDATES: Array<{ provider: string; id: string }> = [
  { provider: "anthropic", id: "claude-opus-4-7" },
  { provider: "anthropic", id: "claude-opus-4-6" },
  { provider: "anthropic", id: "claude-opus-4-5" },
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
  let iteration = 0;
  let accepted = false;

  const refreshWidget = (ctx: ExtensionContext) => {
    if (!resolved) return;
    const lines = [
      `asset: ${resolved.assetId}`,
      `iter:  ${iteration}/${MAX_ITERATIONS}${accepted ? "  (accepted)" : ""}`,
      `dir:   ${resolved.assetDir}`,
    ];
    ctx.ui.setStatus(
      "asset-loop",
      `${resolved.assetId} · iter ${iteration}/${MAX_ITERATIONS}${accepted ? " ✓" : ""}`,
    );
    ctx.ui.setWidget("asset-loop-progress", lines, { placement: "belowEditor" });
  };

  pi.on("session_start", async (_event, ctx) => {
    resolved = resolveAsset({
      asset: pi.getFlag("--asset") as string | undefined,
      run: pi.getFlag("--run") as string | undefined,
      cwd: ctx.cwd,
    });

    assetJsonText = readFileSync(resolved.assetJsonPath, "utf8");
    const referenceBuf = readFileSync(resolved.extractedPngPath);
    referenceBase64 = referenceBuf.toString("base64");
    const dims = readPngSize(referenceBuf);
    referenceWidth = dims.width;
    referenceHeight = dims.height;

    await pickModel(pi, ctx);
    refreshWidget(ctx);

    // Kick off the first turn with the reference image + brief.
    pi.sendUserMessage(
      [
        {
          type: "text",
          text: `Reconstruct the attached asset "${resolved.assetId}" as component.html + component.css in ${resolved.assetDir}. Study the reference, write the files with the built-in \`write\` tool, then call the \`render\` tool to screenshot #asset-root. Compare the reference with your render and iterate. Native size: ${referenceWidth}x${referenceHeight}px.`,
        },
        { type: "image", data: referenceBase64, mimeType: "image/png" },
      ],
    );
  });

  pi.on("before_agent_start", async (event, _ctx) => {
    if (!resolved) return;
    const prompt = buildSystemPrompt({
      assetId: resolved.assetId,
      assetDir: resolved.assetDir,
      assetJson: assetJsonText,
      referenceWidth,
      referenceHeight,
      maxIterations: MAX_ITERATIONS,
    });
    return { systemPrompt: prompt };
  });

  pi.on("tool_call", async (event, _ctx) => {
    if (event.toolName === "render" && iteration >= MAX_ITERATIONS) {
      return {
        block: true,
        reason: `Max iterations (${MAX_ITERATIONS}) reached. Call \`accept\` with your current result or stop.`,
      };
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
      const payload = {
        asset_id: resolved.assetId,
        iterations: iteration,
        score: params.score,
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
            text: `Accepted asset ${resolved.assetId} after ${iteration} iteration(s) at score ${params.score}. Wrote ${resolved.acceptedJsonPath}.`,
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
    "No Anthropic Opus model available (tried 4-7, 4-6, 4-5). Falling back to current model.",
    "error",
  );
}
