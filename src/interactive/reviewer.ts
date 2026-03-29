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
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const accepted: FileDiff[] = [];
  const skipped: FileDiff[] = [];

  const ask = (question: string): Promise<string> =>
    new Promise((resolve) => rl.question(question, resolve));

  console.log();
  console.log(
    ui.dim("  Review each file. [y]es / [n]o / [a]ll / [q]uit")
  );
  console.log();

  let acceptAll = false;

  for (const diff of diffs) {
    if (acceptAll) {
      accepted.push(diff);
      continue;
    }

    const status =
      diff.status === "create"
        ? ui.success("NEW")
        : ui.accent("UPDATE");

    console.log(`  ${status} ${diff.path}`);
    printSnippet("Preview", diff.preview);

    const answer = await ask(`  Write this file? [y/n/a/q] `);
    const choice = answer.trim().toLowerCase();

    switch (choice) {
      case "y":
      case "yes":
        accepted.push(diff);
        break;
      case "a":
      case "all":
        accepted.push(diff);
        acceptAll = true;
        break;
      case "q":
      case "quit":
        rl.close();
        return { accepted, skipped: [...skipped, ...diffs.slice(diffs.indexOf(diff))] };
      default:
        skipped.push(diff);
    }
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
