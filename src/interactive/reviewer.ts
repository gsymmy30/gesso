import * as readline from "node:readline";
import { ui } from "../ui/colors.js";
import { printSnippet } from "../ui/output.js";
import type { FileDiff } from "./diff.js";

export type ReviewDecision = "accept" | "skip" | "quit";

interface ReviewResult {
  accepted: FileDiff[];
  skipped: FileDiff[];
}

export async function reviewFiles(diffs: FileDiff[]): Promise<ReviewResult> {
  if (diffs.length === 0) {
    return { accepted: [], skipped: [] };
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const accepted: FileDiff[] = [];
  const skipped: FileDiff[] = [];

  const ask = (question: string): Promise<string> =>
    new Promise((resolve) => rl.question(question, resolve));

  console.log(
    ui.dim("  [y] write  [n] skip  [a] write all  [q] quit")
  );
  console.log();

  let acceptAll = false;
  const total = diffs.length;

  for (let i = 0; i < diffs.length; i++) {
    const diff = diffs[i];

    if (acceptAll) {
      accepted.push(diff);
      continue;
    }

    // Section header with index
    const idx = `[${i + 1}/${total}]`;
    const cols = process.stdout.columns ?? 80;
    const innerWidth = Math.min(cols - 4, 60);
    const nameAndIdx = ` ${diff.path} ${"─".repeat(2)} ${idx} `;
    const dashCount = Math.max(innerWidth - nameAndIdx.length - 2, 4);
    console.log(ui.muted(`  ── ${diff.path} ${"─".repeat(dashCount)} ${idx} ──`));
    console.log();

    const status =
      diff.status === "create"
        ? ui.success("NEW")
        : ui.accent("UPDATE");

    console.log(`  ${status}`);
    console.log();
    printSnippet("Preview", diff.preview);
    console.log();

    const answer = await ask(`  ${ui.muted("→")} Write this file? `);
    const choice = answer.trim().toLowerCase();

    switch (choice) {
      case "y":
      case "yes":
        accepted.push(diff);
        console.log(`  ${ui.success("✓")} accepted`);
        break;
      case "a":
      case "all":
        accepted.push(diff);
        acceptAll = true;
        console.log(`  ${ui.success("✓")} accepted all remaining`);
        break;
      case "q":
      case "quit":
        skipped.push(...diffs.slice(i));
        rl.close();
        console.log(`  ${ui.dim("─")} quit`);
        return { accepted, skipped };
      default:
        skipped.push(diff);
        console.log(`  ${ui.dim("─")} skipped`);
    }
    console.log();
  }

  rl.close();
  return { accepted, skipped };
}

export async function confirmAction(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`  ${prompt} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}
