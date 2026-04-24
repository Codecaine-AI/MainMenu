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

import { resolveAsset, type ResolveInput } from "./args.ts";
import { runCritique } from "./critic.ts";
import { readPngSize } from "./pngSize.ts";
import { renderWithPlaywright } from "./renderer.ts";
import { buildSystemPrompt } from "./systemPrompt.ts";
import { buildRenderWrapper } from "./wrapper.ts";

const MODEL_PROVIDER = "anthropic" as const;
const MODEL_ID = "claude-opus-4-7" as const;

export async function runAssetLoop(input: ResolveInput): Promise<void> {
  const resolved = resolveAsset(input);

  const referenceBuf = readFileSync(resolved.extractedPngPath);
  const { width: referenceWidth, height: referenceHeight } = readPngSize(referenceBuf);
  const referenceBase64 = referenceBuf.toString("base64");
  const sourceBase64 = readFileSync(resolved.sourcePngPath).toString("base64");
  const assetJsonText = readFileSync(resolved.assetJsonPath, "utf8");
  const extractionPromptText = readFileSync(resolved.extractionPromptPath, "utf8");

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

  console.log("phase: render");
  const componentHtml = readFileSync(resolved.componentHtmlPath, "utf8");
  const componentCss = readFileSync(resolved.componentCssPath, "utf8");
  writeFileSync(resolved.wrapperPath, buildRenderWrapper(componentHtml, componentCss));
  await renderWithPlaywright({
    wrapperPath: resolved.wrapperPath,
    renderPath: resolved.renderPath,
    referenceWidth,
    referenceHeight,
  });

  console.log("phase: critique");
  const auth = await modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok) {
    throw new Error(`Cannot resolve credentials for critic: ${auth.error}`);
  }
  const critique = await runCritique({
    model,
    auth: { apiKey: auth.apiKey, headers: auth.headers },
    sourcePngPath: resolved.sourcePngPath,
    extractedPngPath: resolved.extractedPngPath,
    renderPngPath: resolved.renderPath,
    extractionPromptText,
    assetJson: assetJsonText,
  });

  writeFileSync(
    resolved.critiqueJsonPath,
    `${JSON.stringify({ iteration: 1, verdict: critique.verdict, issues: critique.issues }, null, 2)}\n`,
  );

  console.log(
    `iteration 1 complete — verdict: ${critique.verdict || "(none)"}, issues: ${critique.issues.length}`,
  );
}
