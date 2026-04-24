// Cumulative Usage accounting for one runAssetLoop pass.
//
// Folds every pi-ai Usage object the loop produces — initial-gen assistant
// turns, per-issue fix-session assistant turns, and critic completeSimple
// attempts — into a single running total. Pure (no I/O, no SDK imports);
// the orchestrator owns wiring, observers (TUI, summary) read snapshot().

import type { Usage } from "@mariozechner/pi-ai";

export type UsageSnapshot = {
  calls: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
};

export class UsageAggregator {
  private calls = 0;
  private input = 0;
  private output = 0;
  private cacheRead = 0;
  private cacheWrite = 0;
  private totalTokens = 0;
  private costInput = 0;
  private costOutput = 0;
  private costCacheRead = 0;
  private costCacheWrite = 0;
  private costTotal = 0;

  add(u: Usage): void {
    this.calls += 1;
    this.input += u.input;
    this.output += u.output;
    this.cacheRead += u.cacheRead;
    this.cacheWrite += u.cacheWrite;
    this.totalTokens += u.totalTokens;
    this.costInput += u.cost.input;
    this.costOutput += u.cost.output;
    this.costCacheRead += u.cost.cacheRead;
    this.costCacheWrite += u.cost.cacheWrite;
    this.costTotal += u.cost.total;
  }

  snapshot(): UsageSnapshot {
    return {
      calls: this.calls,
      input: this.input,
      output: this.output,
      cacheRead: this.cacheRead,
      cacheWrite: this.cacheWrite,
      totalTokens: this.totalTokens,
      cost: {
        input: this.costInput,
        output: this.costOutput,
        cacheRead: this.costCacheRead,
        cacheWrite: this.costCacheWrite,
        total: this.costTotal,
      },
    };
  }
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function formatUsageSnapshot(s: UsageSnapshot): string {
  return `usage: calls=${s.calls} ↑${formatTokens(s.input)} ↓${formatTokens(s.output)} R=${formatTokens(s.cacheRead)} W=${formatTokens(s.cacheWrite)} tot=${formatTokens(s.totalTokens)} $${s.cost.total.toFixed(4)}`;
}
