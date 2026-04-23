// Resolves an asset dir produced by apps/asset-extraction-pipeline and finds
// the extracted reference image (structured path first, legacy root fallback).

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

export interface ResolvedAsset {
  assetId: string;
  assetDir: string;
  assetJsonPath: string;
  extractedPngPath: string;
  componentHtmlPath: string;
  componentCssPath: string;
  renderPath: string;
  wrapperPath: string;
  acceptedJsonPath: string;
}

export interface ResolveInput {
  asset: string | undefined;
  run: string | undefined;
  cwd: string;
}

export function resolveAsset(input: ResolveInput): ResolvedAsset {
  if (!input.asset) {
    throw new Error("--asset is required (path to asset dir or bare id with --run)");
  }

  const assetDir = resolveAssetDir(input.asset, input.run, input.cwd);
  if (!existsSync(assetDir)) {
    throw new Error(`Asset dir not found: ${assetDir}`);
  }

  const assetJsonPath = resolve(assetDir, "asset.json");
  if (!existsSync(assetJsonPath)) {
    throw new Error(`Missing asset metadata: ${assetJsonPath}`);
  }

  const extractedPngPath = resolveExtractedPng(assetDir);

  const assetId = parseAssetId(assetJsonPath) ?? assetDir.split("/").pop() ?? "asset";

  return {
    assetId,
    assetDir,
    assetJsonPath,
    extractedPngPath,
    componentHtmlPath: resolve(assetDir, "component.html"),
    componentCssPath: resolve(assetDir, "component.css"),
    renderPath: resolve(assetDir, "render.png"),
    wrapperPath: resolve(assetDir, "wrapper.html"),
    acceptedJsonPath: resolve(assetDir, "accepted.json"),
  };
}

function resolveAssetDir(asset: string, run: string | undefined, cwd: string): string {
  const looksLikePath = asset.includes("/") || isAbsolute(asset) || existsSync(asset);
  if (looksLikePath) {
    return resolve(cwd, asset);
  }
  if (!run) {
    throw new Error(`--asset "${asset}" looks like a bare id; also pass --run <run-dir>`);
  }
  return resolve(cwd, run, "assets", asset);
}

function resolveExtractedPng(assetDir: string): string {
  const structured = resolve(assetDir, "extraction", "image_extraction", "extracted.png");
  if (existsSync(structured)) return structured;
  const legacy = resolve(assetDir, "extracted.png");
  if (existsSync(legacy)) return legacy;
  throw new Error(`Missing extracted asset image: ${structured}`);
}

function parseAssetId(assetJsonPath: string): string | undefined {
  try {
    const raw = readFileSync(assetJsonPath, "utf8");
    const data = JSON.parse(raw) as { id?: unknown };
    return typeof data.id === "string" ? data.id : undefined;
  } catch {
    return undefined;
  }
}
