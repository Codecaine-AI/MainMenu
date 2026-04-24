#!/usr/bin/env bun
// Thin CLI entry: parse --asset/--run from argv, delegate to runAssetLoop.

import { runAssetLoop } from "../src/agent/orchestrator.ts";

interface ParsedArgs {
  asset?: string;
  run?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag !== "--asset" && flag !== "--run") {
      throw new Error(`Unknown argument: ${flag}`);
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag}`);
    }
    if (flag === "--asset") out.asset = value;
    else out.run = value;
    i++;
  }
  return out;
}

try {
  const { asset, run } = parseArgs(process.argv.slice(2));
  await runAssetLoop({ asset, run, cwd: process.cwd() });
  process.exit(0);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
