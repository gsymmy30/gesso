import { ui, colorBar } from "./colors.js";
import type { BrandScoreItem } from "../llm/schemas.js";

const SPINNER_FRAMES = ["◐", "◓", "◑", "◒"];
const SPINNER_INTERVAL = 120;

// ── Stage Header ────────────────────────────────────────────

export function printStageHeader(name: string) {
  const cols = process.stdout.columns ?? 80;
  const innerWidth = Math.min(cols - 4, 60);
  const nameLen = name.length + 2; // space on each side
  const dashCount = Math.max(innerWidth - nameLen - 4, 4); // 4 for leading "── "
  const line = `  ── ${name} ${"─".repeat(dashCount)}`;
  console.log();
  console.log(ui.muted(line));
  console.log();
}

// ── Header ──────────────────────────────────────────────────

export function printHeader(version: string) {
  console.log();
  console.log(`  ${ui.primary("┏┓┏┓┏┏┏┓")}`);
  console.log(`  ${ui.primary("┗┫┗ ┛┛┗┛")} ${ui.muted(`v${version}`)}`);
  console.log(`  ${ui.primary(" ┛")}`);
  console.log();
}

// ── Scan Result ─────────────────────────────────────────────

export function printScanResult(info: {
  manifest: string;
  readme: boolean;
  fileCount: number;
  detected: string;
}) {
  console.log(
    `  Found: ${info.manifest}${info.readme ? ", README.md" : ""}, ${info.fileCount} source files`
  );
  console.log(`  Detected: ${ui.text(info.detected)}`);
}

// ── Brand Score ─────────────────────────────────────────────

export function printBrandScore(
  total: number,
  maxTotal: number,
  items: BrandScoreItem[]
) {
  const label =
    total <= 30
      ? "Your brand is barely there. Let's fix that."
      : total <= 60
        ? "Has bones but needs work."
        : total <= 80
          ? "Solid foundation. Let's sharpen it."
          : "Strong brand. Let's make it sharper.";

  console.log(`  ${ui.accent(`Brand Score: ${total}/${maxTotal}`)}`);
  console.log();

  for (const item of items) {
    const ratio = Math.min(item.score / item.maxScore, 1);
    const value = `${item.score}/${item.maxScore}`.padStart(5);
    const pct = `${Math.round(ratio * 100)}%`.padStart(4);
    const name = item.name.padEnd(20);
    const bar = colorBar(item.score, item.maxScore, 8);
    console.log(`    ${ui.muted(name)} ${bar} ${ui.muted(value)} ${ui.dim(pct)}`);
  }

  console.log();
  console.log(`  ${label}`);
}

// ── Projected Score ─────────────────────────────────────────

export function printProjectedScore(before: number, after: number) {
  const delta = after - before;
  const sign = delta > 0 ? "+" : "";
  console.log(
    `  Projected Brand Score: ${before} → ${ui.accent(String(after))}/100  ${ui.success(`(${sign}${delta})`)}`
  );
}

// ── Analysis Preview ────────────────────────────────────────

export function formatAnalysisPreview(info: {
  archetype: string;
  techStack: string[];
  repoSize: { files: number; linesOfCode: number };
  sampledFiles: string[];
  hasBrief: boolean;
  briefAnswers: number;
}): string {
  const lines: string[] = [];
  lines.push(ui.muted("  ── Analysis Preview ──────────────────────────────"));
  lines.push("");
  lines.push(`  ${ui.muted("Archetype:")}    ${info.archetype}`);
  lines.push(
    `  ${ui.muted("Tech stack:")}   ${info.techStack.slice(0, 4).join(", ")}`
  );
  lines.push(
    `  ${ui.muted("Repo size:")}    ${info.repoSize.files} files, ~${info.repoSize.linesOfCode.toLocaleString()} LOC`
  );
  const shown = info.sampledFiles.slice(0, 3).join(", ");
  const more =
    info.sampledFiles.length > 3
      ? ` (+${info.sampledFiles.length - 3} more)`
      : "";
  lines.push(`  ${ui.muted("Sampled:")}      ${shown}${more}`);
  if (info.hasBrief) {
    lines.push(
      `  ${ui.muted("Has brief:")}    yes (${info.briefAnswers}/3 questions answered)`
    );
  }
  return lines.join("\n");
}

// Keep the direct-print version for use outside of progress display
export function printAnalysisPreview(info: Parameters<typeof formatAnalysisPreview>[0]) {
  console.log(formatAnalysisPreview(info));
  console.log();
}

// ── Progress Display ────────────────────────────────────────

type StepStatus = "queued" | "running" | "done" | "failed";

interface StepState {
  name: string;
  status: StepStatus;
  duration?: number;
}

export class ProgressDisplay {
  private steps: StepState[];
  private interval: ReturnType<typeof setInterval> | null = null;
  private frame = 0;
  private lineCount = 0;
  private dirty = true;
  private started = false;
  private logBuffer: string[] = [];

  constructor(stepNames: string[]) {
    this.steps = stepNames.map((name) => ({ name, status: "queued" }));
  }

  start() {
    this.started = true;
    this.render();
    this.interval = setInterval(() => {
      // Only mark dirty if any step is currently running (spinner needs animation)
      const hasRunning = this.steps.some((s) => s.status === "running");
      if (hasRunning) {
        this.frame = (this.frame + 1) % SPINNER_FRAMES.length;
        this.dirty = true;
      }
      if (this.dirty) {
        this.rerender();
      }
    }, SPINNER_INTERVAL);
  }

  update(name: string, status: StepStatus, duration?: number) {
    const step = this.steps.find((s) => s.name === name);
    if (step) {
      step.status = status;
      step.duration = duration;
      this.dirty = true;
      // Immediately rerender on state change for responsiveness
      if (this.started) {
        this.rerender();
      }
    }
  }

  /**
   * Print a message while the progress display is active.
   * Clears progress lines, prints the message, then re-renders progress below.
   * ALL output during generation must go through this method.
   */
  log(message: string) {
    if (!this.started) {
      console.log(message);
      return;
    }
    this.clearLines();
    console.log(message);
    console.log();
    this.logBuffer.push(message);
    this.render();
  }

  /**
   * Stop the spinner and clear all progress lines from the terminal.
   * Gives a clean canvas for subsequent static output.
   */
  stopAndClear() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.clearLines();
    this.started = false;
  }

  /**
   * Stop the spinner but leave the final state visible.
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.dirty = true;
    this.rerender();
    this.started = false;
  }

  private clearLines() {
    if (this.lineCount > 0) {
      process.stdout.write(`\x1b[${this.lineCount}A`);
      for (let i = 0; i < this.lineCount; i++) {
        process.stdout.write("\x1b[2K\n");
      }
      process.stdout.write(`\x1b[${this.lineCount}A`);
    }
    this.lineCount = 0;
  }

  private render() {
    const lines = this.buildLines();
    this.lineCount = lines.length;
    this.dirty = false;
    process.stdout.write(lines.join("\n") + "\n");
  }

  private rerender() {
    this.clearLines();
    this.render();
  }

  private buildLines(): string[] {
    return this.steps.map((step) => {
      const name = step.name.padEnd(22);
      switch (step.status) {
        case "queued":
          return `    ${ui.dim(name)} ${ui.dim("queued")}`;
        case "running":
          return `  ${ui.primary(SPINNER_FRAMES[this.frame])} ${name} ${ui.muted("...")}`;
        case "done":
          return `  ${ui.success("✓")} ${name} ${ui.muted(step.duration ? `${step.duration.toFixed(1)}s` : "")}`;
        case "failed":
          return `  ${ui.error("✗")} ${ui.error(name)}`;
      }
    });
  }
}

// ── Partial Success ─────────────────────────────────────────

export function printPartialSuccess(
  steps: { name: string; status: "done" | "failed"; error?: string }[]
) {
  const succeeded = steps.filter((s) => s.status === "done");
  const failed = steps.filter((s) => s.status === "failed");

  if (failed.length === 0) return;

  console.log(
    `  ${ui.error("✗")} Generation partially failed (${succeeded.length}/${steps.length} steps succeeded).`
  );
  console.log();

  if (succeeded.length > 0) {
    console.log(
      `    ${ui.success("✓")} ${succeeded.map((s) => s.name).join(", ")}`
    );
  }
  for (const f of failed) {
    console.log(
      `    ${ui.error("✗")} ${f.name}${f.error ? ` (${f.error})` : ""}`
    );
  }

  console.log();
  console.log("  Proceeding to review with completed sections.");
  console.log();
}

// ── File List ───────────────────────────────────────────────

export function printFileList(
  files: { name: string; description: string }[]
) {
  console.log("  Files written:");
  for (const f of files) {
    console.log(
      `    ${f.name.padEnd(22)} ${ui.muted(f.description)}`
    );
  }
}

// ── Snippet Box ─────────────────────────────────────────────

export function printSnippet(title: string, content: string) {
  const cols = process.stdout.columns ?? 80;
  const boxWidth = Math.min(cols - 6, 52); // 4 indent + 2 margin
  const innerWidth = boxWidth - 2; // for │ on each side

  console.log(`  ${title}:`);
  console.log(`  ${ui.muted("┌" + "─".repeat(innerWidth) + "┐")}`);
  for (const line of content.split("\n").slice(0, 8)) {
    const truncated = line.length > innerWidth - 1
      ? line.slice(0, innerWidth - 2) + "…"
      : line;
    console.log(`  ${ui.muted("│")} ${truncated.padEnd(innerWidth - 1)}${ui.muted("│")}`);
  }
  if (content.split("\n").length > 8) {
    console.log(`  ${ui.muted("│")} ${ui.dim("...").padEnd(innerWidth - 1)}${ui.muted("│")}`);
  }
  console.log(`  ${ui.muted("└" + "─".repeat(innerWidth) + "┘")}`);
}

// ── Error & Success ─────────────────────────────────────────

export function printError(message: string) {
  console.log(`  ${ui.error("✗")} ${message}`);
}

export function printSuccess(message: string) {
  console.log(`  ${ui.success("✓")} ${message}`);
}
