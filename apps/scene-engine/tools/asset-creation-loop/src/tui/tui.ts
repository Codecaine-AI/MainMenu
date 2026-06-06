import {
  Box,
  Container,
  Image,
  type ImageTheme,
  ProcessTerminal,
  SelectList,
  type SelectItem,
  type SelectListTheme,
  Spacer,
  Text,
  TUI,
} from "@mariozechner/pi-tui";

import type { CritiqueIssue } from "../agent/critic.ts";
import type { UsageSnapshot } from "./usage.ts";

// ── Pi dark theme palette (24-bit truecolor ANSI) ───────────────────────────

const PI = {
  accent:      (s: string) => `\x1b[38;2;138;190;183m${s}\x1b[39m`,
  border:      (s: string) => `\x1b[38;2;95;135;255m${s}\x1b[39m`,
  borderBright:(s: string) => `\x1b[38;2;0;215;255m${s}\x1b[39m`,
  borderMuted: (s: string) => `\x1b[38;2;80;80;80m${s}\x1b[39m`,
  success:     (s: string) => `\x1b[38;2;181;189;104m${s}\x1b[39m`,
  error:       (s: string) => `\x1b[38;2;204;102;102m${s}\x1b[39m`,
  warning:     (s: string) => `\x1b[38;2;240;198;116m${s}\x1b[39m`,
  muted:       (s: string) => `\x1b[38;2;128;128;128m${s}\x1b[39m`,
  dim:         (s: string) => `\x1b[38;2;102;102;102m${s}\x1b[39m`,
  bold:        (s: string) => `\x1b[1m${s}\x1b[22m`,
};

function sectionRule(label: string): string {
  return `${PI.borderMuted("──")} ${PI.border(label)} ${PI.borderMuted("─".repeat(44))}`;
}

// ── Types ───────────────────────────────────────────────────────────────────

export type AssetLoopPhase = "initial_gen" | "render" | "critique" | "fix" | "done";

export interface AssetLoopTUIInit {
  assetId: string;
  maxIterations: number;
  extractedBase64: string;
  extractedMime: string;
}

export interface ToolActivityEvent {
  type: "start" | "end";
  toolCallId: string;
  toolName: string;
  args?: any;
  isError?: boolean;
}

// ── Internal helpers ────────────────────────────────────────────────────────

interface ToolActivity {
  toolCallId: string;
  toolName: string;
  arg: string;
  status: "running" | "done" | "error";
}

const MAX_ACTIVITIES = 12;

const EMPTY_SNAPSHOT: UsageSnapshot = {
  calls: 0, input: 0, output: 0,
  cacheRead: 0, cacheWrite: 0, totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

function extractToolArg(toolName: string, args: any): string {
  if (!args) return "";
  switch (toolName) {
    case "read":  return shortenPath(args.path ?? "");
    case "write": return shortenPath(args.path ?? "");
    case "edit":  return shortenPath(args.path ?? "");
    case "bash":  return truncStr(args.command ?? "", 55);
    case "grep":  return args.pattern ?? "";
    case "find":  return args.pattern ?? "";
    case "ls":    return shortenPath(args.path ?? ".");
    default:      return "";
  }
}

function shortenPath(p: string): string {
  const parts = p.split("/");
  return parts.length <= 2 ? p : parts.slice(-2).join("/");
}

function truncStr(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function fmtTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

const PHASE_LABELS: Record<AssetLoopPhase, string> = {
  initial_gen: "generating",
  render: "rendering",
  critique: "critiquing",
  fix: "fixing",
  done: "complete",
};

// ── TUI ─────────────────────────────────────────────────────────────────────

export class AssetLoopTUI {
  private tui: TUI;
  private header: Text;
  private statusLine: Text;
  private activityLog: Text;
  private issuesList: SelectList;
  private issuesBox: Box;
  private extractedImage: Image;
  private renderImage: Image | null = null;
  private renderPlaceholder: Text;
  private imagesContainer: Container;
  private usageLine: Text;

  private assetId: string;
  private maxIterations: number;
  private iteration: number = 0;
  private phase: AssetLoopPhase = "initial_gen";
  private currentIssue: CritiqueIssue | null = null;
  private issues: CritiqueIssue[] = [];
  private currentIndex: number = -1;
  private activities: ToolActivity[] = [];

  private selectListTheme: SelectListTheme = {
    selectedPrefix: (s) => `${PI.warning("▸")} ${s}`,
    selectedText: (s) => PI.bold(s),
    description: (s) => PI.dim(s),
    scrollInfo: (s) => PI.dim(s),
    noMatch: (s) => PI.muted(s),
  };

  private imageTheme: ImageTheme = {
    fallbackColor: (s) => PI.dim(s),
  };

  constructor(init: AssetLoopTUIInit) {
    this.assetId = init.assetId;
    this.maxIterations = init.maxIterations;

    this.tui = new TUI(new ProcessTerminal());

    this.header = new Text(this.fmtHeader(), 1, 0);
    this.statusLine = new Text(this.fmtStatus(), 1, 0);
    this.activityLog = new Text(PI.dim("  waiting for agent…"), 1, 0);
    this.issuesList = new SelectList([], 8, this.selectListTheme);
    this.extractedImage = new Image(
      init.extractedBase64,
      init.extractedMime,
      this.imageTheme,
      { maxWidthCells: 48 },
    );
    this.renderPlaceholder = new Text(PI.dim("(pending first render)"), 1, 0);
    this.usageLine = new Text(this.fmtUsage(EMPTY_SNAPSHOT), 1, 0);

    this.imagesContainer = new Container();
    this.imagesContainer.addChild(new Text(PI.border("reference:"), 1, 0));
    this.imagesContainer.addChild(this.extractedImage);
    this.imagesContainer.addChild(new Spacer(1));
    this.imagesContainer.addChild(new Text(PI.border("render:"), 1, 0));
    this.imagesContainer.addChild(this.renderPlaceholder);

    this.issuesBox = new Box(1, 0);
    this.issuesBox.addChild(this.issuesList);

    const headerBox = new Box(1, 0);
    headerBox.addChild(this.header);

    const imagesBox = new Box(1, 0);
    imagesBox.addChild(this.imagesContainer);

    const usageBox = new Box(1, 0);
    usageBox.addChild(this.usageLine);

    this.tui.addChild(headerBox);
    this.tui.addChild(new Spacer(1));
    this.tui.addChild(new Text(sectionRule("status"), 1, 0));
    this.tui.addChild(this.statusLine);
    this.tui.addChild(new Spacer(1));
    this.tui.addChild(new Text(sectionRule("activity"), 1, 0));
    this.tui.addChild(this.activityLog);
    this.tui.addChild(new Spacer(1));
    this.tui.addChild(new Text(sectionRule("issues"), 1, 0));
    this.tui.addChild(this.issuesBox);
    this.tui.addChild(new Spacer(1));
    this.tui.addChild(imagesBox);
    this.tui.addChild(new Spacer(1));
    this.tui.addChild(new Text(sectionRule("usage"), 1, 0));
    this.tui.addChild(usageBox);
  }

  // ── Public API ──────────────────────────────────────────────────────────

  start(): void {
    this.tui.start();
  }

  stop(): void {
    this.tui.stop();
  }

  setIteration(n: number): void {
    this.iteration = n;
    this.activities = [];
    this.header.setText(this.fmtHeader());
    this.activityLog.setText(PI.dim("  waiting for agent…"));
    this.tui.requestRender();
  }

  setPhase(phase: AssetLoopPhase, currentIssue?: CritiqueIssue | null): void {
    this.phase = phase;
    this.currentIssue = currentIssue ?? null;
    this.statusLine.setText(this.fmtStatus());
    this.tui.requestRender();
  }

  setIssues(issues: CritiqueIssue[]): void {
    this.issues = [...issues];
    this.currentIndex = -1;
    this.issuesList = new SelectList(
      this.buildSelectItems(),
      Math.min(8, Math.max(issues.length, 1)),
      this.selectListTheme,
    );
    this.issuesBox.clear();
    this.issuesBox.addChild(this.issuesList);
    this.tui.requestRender();
  }

  setCurrentIssue(index: number): void {
    this.currentIndex = index;
    this.issuesList = new SelectList(
      this.buildSelectItems(),
      Math.min(8, Math.max(this.issues.length, 1)),
      this.selectListTheme,
    );
    this.issuesBox.clear();
    this.issuesBox.addChild(this.issuesList);
    if (index >= 0 && index < this.issues.length) {
      this.issuesList.setSelectedIndex(index);
    }
    this.tui.requestRender();
  }

  setRender(base64: string, mime: string): void {
    this.renderImage = new Image(base64, mime, this.imageTheme, {
      maxWidthCells: 48,
    });
    this.imagesContainer.clear();
    this.imagesContainer.addChild(new Text(PI.border("reference:"), 1, 0));
    this.imagesContainer.addChild(this.extractedImage);
    this.imagesContainer.addChild(new Spacer(1));
    this.imagesContainer.addChild(new Text(PI.border("render:"), 1, 0));
    this.imagesContainer.addChild(this.renderImage);
    this.tui.requestRender();
  }

  setUsage(s: UsageSnapshot): void {
    this.usageLine.setText(this.fmtUsage(s));
    this.tui.requestRender();
  }

  addToolActivity(event: ToolActivityEvent): void {
    if (event.type === "start") {
      this.activities.push({
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        arg: extractToolArg(event.toolName, event.args),
        status: "running",
      });
      if (this.activities.length > MAX_ACTIVITIES) {
        this.activities.shift();
      }
    } else {
      const entry = this.activities.find((a) => a.toolCallId === event.toolCallId);
      if (entry) {
        entry.status = event.isError ? "error" : "done";
      }
    }
    this.activityLog.setText(this.fmtActivity());
    this.tui.requestRender();
  }

  showSummary(lines: string[]): void {
    this.tui.clear();
    const summaryBox = new Box(1, 1);
    summaryBox.addChild(new Text(lines.join("\n"), 0, 0));
    this.tui.addChild(summaryBox);
    this.tui.requestRender();
  }

  // ── Formatting ──────────────────────────────────────────────────────────

  private fmtHeader(): string {
    return [
      PI.borderBright("π"),
      PI.borderMuted("·"),
      PI.border("asset-loop"),
      PI.borderMuted("─".repeat(6)),
      PI.accent(this.assetId),
      PI.borderMuted("·"),
      `${PI.dim("iter")} ${PI.success(String(this.iteration))}${PI.borderMuted("/")}${PI.dim(String(this.maxIterations))}`,
    ].join(" ");
  }

  private fmtStatus(): string {
    const phaseStr = PI.accent(PHASE_LABELS[this.phase]);
    if (!this.currentIssue) return `  ${PI.dim("phase:")} ${phaseStr}`;
    const i = this.currentIssue;
    const severity = i.severity === "major" ? PI.error(i.severity) : PI.warning(i.severity);
    return `  ${PI.dim("phase:")} ${phaseStr} ${PI.warning("·")} ${PI.warning("[")}${i.id}${PI.warning("]")} ${severity} ${PI.muted(i.region)}${PI.warning(":")} ${i.description}`;
  }

  private fmtActivity(): string {
    if (this.activities.length === 0) return PI.dim("  waiting for agent…");
    return this.activities.map((a) => {
      if (a.status === "running") {
        return `  ${PI.warning("◌")} ${PI.accent(a.toolName.padEnd(7))} ${a.arg}`;
      }
      if (a.status === "error") {
        return `  ${PI.error("✗")} ${PI.error(a.toolName.padEnd(7))} ${PI.error(a.arg)}`;
      }
      return `  ${PI.success("✓")} ${PI.dim(`${a.toolName.padEnd(7)} ${a.arg}`)}`;
    }).join("\n");
  }

  private fmtUsage(s: UsageSnapshot): string {
    return [
      `${PI.dim("calls")}${PI.warning("=")}${PI.success(String(s.calls))}`,
      `${PI.dim("↑")}${PI.success(fmtTokens(s.input))}`,
      `${PI.dim("↓")}${PI.success(fmtTokens(s.output))}`,
      `${PI.dim("R")}${PI.warning("=")}${PI.success(fmtTokens(s.cacheRead))}`,
      `${PI.dim("W")}${PI.warning("=")}${PI.success(fmtTokens(s.cacheWrite))}`,
      `${PI.dim("tot")}${PI.warning("=")}${PI.success(fmtTokens(s.totalTokens))}`,
      `${PI.warning("$")}${PI.success(s.cost.total.toFixed(4))}`,
    ].join(" ");
  }

  private buildSelectItems(): SelectItem[] {
    return this.issues.map((issue, index) => {
      const severity = issue.severity === "major" ? PI.error(issue.severity) : PI.warning(issue.severity);
      const base = `${PI.warning("[")}${severity}${PI.warning("]")} ${PI.muted(issue.region)}${PI.warning(":")} ${issue.description}`;
      const label =
        index < this.currentIndex
          ? `${PI.success("✓")} ${PI.dim(`[${issue.severity}] ${issue.region}: ${issue.description}`)}`
          : base;
      return {
        value: issue.id,
        label,
        description: `${PI.dim("fix:")} ${issue.fix_hint}`,
      };
    });
  }
}
