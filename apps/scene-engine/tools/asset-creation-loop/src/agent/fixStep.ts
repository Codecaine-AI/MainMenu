// Per-issue fix step. The orchestrator calls runFixStep once per critic
// issue: open a fresh in-memory Pi SDK session scoped to the asset dir with
// coding tools, feed it the four-image grounding plus exactly one issue,
// wait for idle, dispose. Cross-issue state is never carried over.

import { type Api, type Model, type Usage } from "@mariozechner/pi-ai";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRegistry,
  SessionManager,
} from "@mariozechner/pi-coding-agent";

import { type ResolvedAsset } from "../args.ts";
import { type CritiqueIssue } from "./critic.ts";
import { buildFixStepSystemPrompt } from "./systemPrompt.ts";
import type { ToolActivityEvent } from "../tui/tui.ts";

export interface RunFixStepInput {
  resolved: ResolvedAsset;
  issue: CritiqueIssue;
  iteration: number;
  assetJsonText: string;
  extractionPromptText: string;
  referenceWidth: number;
  referenceHeight: number;
  sourceBase64: string;
  extractedBase64: string;
  currentRenderBase64: string;
  model: Model<Api>;
  authStorage: AuthStorage;
  modelRegistry: ModelRegistry;
  onUsage?: (usage: Usage) => void;
  onToolActivity?: (event: ToolActivityEvent) => void;
}

export async function runFixStep(input: RunFixStepInput): Promise<void> {
  const systemPrompt = buildFixStepSystemPrompt({
    assetId: input.resolved.assetId,
    assetDir: input.resolved.assetDir,
    assetJson: input.assetJsonText,
    referenceWidth: input.referenceWidth,
    referenceHeight: input.referenceHeight,
  });

  const agentDir = getAgentDir();
  const resourceLoader = new DefaultResourceLoader({
    cwd: input.resolved.assetDir,
    agentDir,
    systemPromptOverride: () => systemPrompt,
  });
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    cwd: input.resolved.assetDir,
    agentDir,
    model: input.model,
    thinkingLevel: "high",
    authStorage: input.authStorage,
    modelRegistry: input.modelRegistry,
    resourceLoader,
    sessionManager: SessionManager.inMemory(),
  });

  session.subscribe((event) => {
    if (
      event.type === "message_end" &&
      event.message?.role === "assistant" &&
      event.message.usage
    ) {
      input.onUsage?.(event.message.usage);
    }
    if (event.type === "tool_execution_start") {
      input.onToolActivity?.({
        type: "start",
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
      });
    }
    if (event.type === "tool_execution_end") {
      input.onToolActivity?.({
        type: "end",
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        isError: event.isError,
      });
    }
  });

  const kickoffText = [
    `Fix step for asset "${input.resolved.assetId}" at iteration ${input.iteration}.`,
    `Native size: ${input.referenceWidth}x${input.referenceHeight}px. Coordinate system: (0,0) is top-left.`,
    "",
    "Three images follow in this order:",
    "  1. source.png — original screenshot the asset was extracted from (ground truth in situ).",
    "  2. extracted.png — isolated asset on a solid background (primary render target).",
    "  3. render.png — current render of component.html / component.css (the present delta).",
    "",
    "Extraction prompt that produced the extracted image:",
    "",
    input.extractionPromptText.trim(),
    "",
    "Apply exactly this one critic issue:",
    "",
    `  id: ${input.issue.id}`,
    `  region: ${input.issue.region}`,
    `  severity: ${input.issue.severity}`,
    `  description: ${input.issue.description}`,
    "",
    `  REFERENCE shows: ${input.issue.reference_geometry}`,
    `  RENDER shows:    ${input.issue.render_geometry}`,
    `  Element to fix:  ${input.issue.affected_element_hint}`,
    "",
    `  fix_hint: ${input.issue.fix_hint}`,
    "",
    "Read component.html and component.css in the working directory, then apply only this fix. No other changes, no refactors, no prose reply. When the edit is written, stop.",
  ].join("\n");

  await session.prompt(kickoffText, {
    images: [
      { type: "image", data: input.sourceBase64, mimeType: "image/png" },
      { type: "image", data: input.extractedBase64, mimeType: "image/png" },
      { type: "image", data: input.currentRenderBase64, mimeType: "image/png" },
    ],
  });
  await session.agent.waitForIdle();
  session.dispose();
}
