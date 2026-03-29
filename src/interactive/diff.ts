import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ui } from "../ui/colors.js";

export interface FileDiff {
  path: string;
  status: "create" | "update";
  preview: string;
}

export async function buildDiffs(
  root: string,
  files: { path: string; content: string }[]
): Promise<FileDiff[]> {
  const diffs: FileDiff[] = [];

  for (const file of files) {
    const fullPath = join(root, file.path);
    const exists = existsSync(fullPath);

    if (exists) {
      const existing = await readFile(fullPath, "utf-8");
      if (existing === file.content) continue; // No change
      diffs.push({
        path: file.path,
        status: "update",
        preview: truncatePreview(file.content),
      });
    } else {
      diffs.push({
        path: file.path,
        status: "create",
        preview: truncatePreview(file.content),
      });
    }
  }

  return diffs;
}

export function printDiffSummary(diffs: FileDiff[]) {
  const creates = diffs.filter((d) => d.status === "create");
  const updates = diffs.filter((d) => d.status === "update");

  console.log();
  console.log(ui.dim("  ── Files to write ────────────────────────────────"));
  console.log();

  for (const diff of creates) {
    console.log(`  ${ui.success("+")} ${diff.path}`);
  }
  for (const diff of updates) {
    console.log(`  ${ui.accent("~")} ${diff.path}`);
  }

  console.log();
  console.log(
    `  ${creates.length} new, ${updates.length} updated`
  );
  console.log();
}

function truncatePreview(content: string): string {
  const lines = content.split("\n");
  if (lines.length <= 10) return content;
  return lines.slice(0, 10).join("\n") + `\n... (${lines.length - 10} more lines)`;
}
