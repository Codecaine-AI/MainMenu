// Observe-only pi-tui dashboard for the asset loop.
//
// AssetLoopTUI owns one TUI instance (driven by ProcessTerminal) and stacks
// five panels: header (asset id + iteration), status (phase + current issue),
// pending-issues queue (SelectList, non-interactive), images (extracted
// reference + latest render), and usage footer. The class exposes a narrow
// imperative API that the orchestrator calls on every state transition. No
// keyboard handling — Ctrl+C is owned by the orchestrator.

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

import type { CritiqueIssue } from "./critic.ts";
import { formatUsageSnapshot, type UsageSnapshot } from "./usage.ts";

export type AssetLoopPhase = "initial_gen" | "render" | "critique" | "fix" | "done";

export interface AssetLoopTUIInit {
  assetId: string;
  maxIterations: number;
  extractedBase64: string;
  extractedMime: string;
}

const EMPTY_SNAPSHOT: UsageSnapshot = {
  calls: 0,
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

export class AssetLoopTUI {
  private tui: TUI;
  private header: Text;
  private statusLine: Text;
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

  private selectListTheme: SelectListTheme = {
    selectedPrefix: (s) => `> ${s}`,
    selectedText: (s) => `\x1b[1m${s}\x1b[22m`,
    description: (s) => `\x1b[2m${s}\x1b[22m`,
    scrollInfo: (s) => `\x1b[2m${s}\x1b[22m`,
    noMatch: (s) => s,
  };

  private imageTheme: ImageTheme = {
    fallbackColor: (s) => `\x1b[2m${s}\x1b[22m`,
  };

  constructor(init: AssetLoopTUIInit) {
    this.assetId = init.assetId;
    this.maxIterations = init.maxIterations;

    this.tui = new TUI(new ProcessTerminal());

    this.header = new Text(this.formatHeader(), 1, 0);
    this.statusLine = new Text(this.formatStatus(), 1, 0);
    this.issuesList = new SelectList([], 8, this.selectListTheme);
    this.extractedImage = new Image(
      init.extractedBase64,
      init.extractedMime,
      this.imageTheme,
      { maxWidthCells: 48 },
    );
    this.renderPlaceholder = new Text("render: (pending first render)", 1, 0);

    this.imagesContainer = new Container();
    this.imagesContainer.addChild(new Text("reference:", 1, 0));
    this.imagesContainer.addChild(this.extractedImage);
    this.imagesContainer.addChild(new Spacer(1));
    this.imagesContainer.addChild(new Text("render:", 1, 0));
    this.imagesContainer.addChild(this.renderPlaceholder);

    this.usageLine = new Text(formatUsageSnapshot(EMPTY_SNAPSHOT), 1, 0);

    const headerBox = new Box(1, 0);
    headerBox.addChild(this.header);

    const statusBox = new Box(1, 0);
    statusBox.addChild(this.statusLine);

    this.issuesBox = new Box(1, 0);
    this.issuesBox.addChild(this.issuesList);

    const imagesBox = new Box(1, 0);
    imagesBox.addChild(this.imagesContainer);

    const usageBox = new Box(1, 0);
    usageBox.addChild(this.usageLine);

    this.tui.addChild(headerBox);
    this.tui.addChild(new Spacer(1));
    this.tui.addChild(statusBox);
    this.tui.addChild(new Spacer(1));
    this.tui.addChild(this.issuesBox);
    this.tui.addChild(new Spacer(1));
    this.tui.addChild(imagesBox);
    this.tui.addChild(new Spacer(1));
    this.tui.addChild(usageBox);
  }

  start(): void {
    this.tui.start();
  }

  stop(): void {
    this.tui.stop();
  }

  setIteration(n: number): void {
    this.iteration = n;
    this.header.setText(this.formatHeader());
    this.tui.requestRender();
  }

  setPhase(phase: AssetLoopPhase, currentIssue?: CritiqueIssue | null): void {
    this.phase = phase;
    this.currentIssue = currentIssue ?? null;
    this.statusLine.setText(this.formatStatus());
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
    this.imagesContainer.addChild(new Text("reference:", 1, 0));
    this.imagesContainer.addChild(this.extractedImage);
    this.imagesContainer.addChild(new Spacer(1));
    this.imagesContainer.addChild(new Text("render:", 1, 0));
    this.imagesContainer.addChild(this.renderImage);
    this.tui.requestRender();
  }

  setUsage(s: UsageSnapshot): void {
    this.usageLine.setText(formatUsageSnapshot(s));
    this.tui.requestRender();
  }

  showSummary(lines: string[]): void {
    this.tui.clear();
    const summaryBox = new Box(1, 1);
    summaryBox.addChild(new Text(lines.join("\n"), 0, 0));
    this.tui.addChild(summaryBox);
    this.tui.requestRender();
  }

  private formatHeader(): string {
    return `${this.assetId} · iter ${this.iteration}/${this.maxIterations}`;
  }

  private formatStatus(): string {
    const base = `phase: ${this.phase}`;
    if (!this.currentIssue) return base;
    const i = this.currentIssue;
    return `${base} · [${i.id}] ${i.severity} ${i.region}: ${i.description}`;
  }

  private buildSelectItems(): SelectItem[] {
    return this.issues.map((issue, index) => {
      const base = `[${issue.severity}] ${issue.region}: ${issue.description}`;
      const label =
        index < this.currentIndex ? `\x1b[2m✓ ${base}\x1b[22m` : base;
      return {
        value: issue.id,
        label,
        description: `fix: ${issue.fix_hint}`,
      };
    });
  }
}
