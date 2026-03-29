import { ui, colorBar } from "./colors.js";
import type { BrandScoreItem } from "../llm/schemas.js";

const SPINNER_FRAMES = ["◐", "◓", "◑", "◒"];
const SPINNER_INTERVAL = 80;

interface SpinnerHandle {
  stop: (success: boolean, duration?: number) => void;
}

export function printHeader(version: string) {
  console.log();
  console.log(`${ui.primary("gesso")} ${ui.muted(`v${version}`)}`);
  console.log();
}

export function printScanResult(info: {
  manifest: string;
  readme: boolean;
  fileCount: number;
  detected: string;
}) {
  console.log("Scanning repository...");
  console.log(
    `Found: ${info.manifest}${info.readme ? ", README.md" : ""}, ${info.fileCount} source files`
  );
  console.log(`Detected: ${info.detected}`);
  console.log();
}

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

  console.log(`${ui.accent(`Brand Score: ${total}/${maxTotal}`)}`);
  console.log();

  for (const item of items) {
    const bar = colorBar(item.score, item.maxScore);
    const name = item.name.padEnd(18);
    const value = `${item.score}/${item.maxScore}`;
    console.log(`  ${ui.muted(name)} ${bar}  ${ui.muted(value)}`);
  }

  console.log();
  console.log(label);
  console.log();
}

export function printProjectedScore(before: number, after: number) {
  const delta = after - before;
  const sign = delta > 0 ? "+" : "";
  console.log(
    `  Projected Brand Score: ${before} → ${ui.accent(String(after))}/100  (${sign}${delta})`
  );
  console.log();
}

export function printAnalysisPreview(info: {
  archetype: string;
  techStack: string[];
  repoSize: { files: number; linesOfCode: number };
  sampledFiles: string[];
  hasBrief: boolean;
  briefAnswers: number;
}) {
  console.log(ui.dim("  ── Analysis Preview ──────────────────────────────"));
  console.log();
  console.log(`  ${ui.muted("Archetype:")}    ${info.archetype}`);
  console.log(
    `  ${ui.muted("Tech stack:")}   ${info.techStack.slice(0, 4).join(", ")}`
  );
  console.log(
    `  ${ui.muted("Repo size:")}    ${info.repoSize.files} files, ~${info.repoSize.linesOfCode.toLocaleString()} LOC`
  );
  const shown = info.sampledFiles.slice(0, 3).join(", ");
  const more =
    info.sampledFiles.length > 3
      ? ` (+${info.sampledFiles.length - 3} more)`
      : "";
  console.log(`  ${ui.muted("Sampled:")}      ${shown}${more}`);
  if (info.hasBrief) {
    console.log(
      `  ${ui.muted("Has brief:")}    yes (${info.briefAnswers}/3 questions answered)`
    );
  }
  console.log();
}

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

  constructor(stepNames: string[]) {
    this.steps = stepNames.map((name) => ({ name, status: "queued" }));
  }

  start() {
    this.render();
    this.interval = setInterval(() => {
      this.frame = (this.frame + 1) % SPINNER_FRAMES.length;
      this.rerender();
    }, SPINNER_INTERVAL);
  }

  update(name: string, status: StepStatus, duration?: number) {
    const step = this.steps.find((s) => s.name === name);
    if (step) {
      step.status = status;
      step.duration = duration;
      this.rerender();
    }
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.rerender();
  }

  private render() {
    const lines = this.buildLines();
    this.lineCount = lines.length;
    process.stdout.write(lines.join("\n") + "\n");
  }

  private rerender() {
    // Move cursor up and clear
    if (this.lineCount > 0) {
      process.stdout.write(`\x1b[${this.lineCount}A`);
      for (let i = 0; i < this.lineCount; i++) {
        process.stdout.write("\x1b[2K\n");
      }
      process.stdout.write(`\x1b[${this.lineCount}A`);
    }
    this.render();
  }

  private buildLines(): string[] {
    return this.steps.map((step) => {
      const name = step.name.padEnd(22);
      switch (step.status) {
        case "queued":
          return `    ${name} ${ui.dim("queued")}`;
        case "running":
          return `  ${ui.primary(SPINNER_FRAMES[this.frame])} ${name} ${ui.muted("...")}`;
        case "done":
          return `  ${ui.success("✓")} ${name} ${ui.muted(step.duration ? `${step.duration.toFixed(1)}s` : "")}`;
        case "failed":
          return `  ${ui.error("✗")} ${name} ${ui.error("failed")}`;
      }
    });
  }
}

export function printFileList(
  files: { name: string; description: string }[]
) {
  console.log("  Files written:");
  for (const f of files) {
    console.log(
      `    ${f.name.padEnd(22)} ${ui.muted(f.description)}`
    );
  }
  console.log();
}

export function printSnippet(title: string, content: string) {
  console.log(`  ${title}:`);
  console.log(`  ┌${"─".repeat(50)}┐`);
  for (const line of content.split("\n").slice(0, 8)) {
    console.log(`  │ ${line.padEnd(49)}│`);
  }
  if (content.split("\n").length > 8) {
    console.log(`  │ ${"...".padEnd(49)}│`);
  }
  console.log(`  └${"─".repeat(50)}┘`);
  console.log();
}

export function printError(message: string) {
  console.log(`${ui.error("✗")} ${message}`);
}

export function printSuccess(message: string) {
  console.log(`${ui.success("✓")} ${message}`);
}
