import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const START_DELIMITER = "<!-- gesso:brand-start -->";
const END_DELIMITER = "<!-- gesso:brand-end -->";

export async function writeAgentsMd(
  root: string,
  section: string
): Promise<{ path: string; created: boolean }> {
  const filePath = join(root, "AGENTS.md");
  const wrapped = `${START_DELIMITER}\n${section.trim()}\n${END_DELIMITER}`;

  if (existsSync(filePath)) {
    const existing = await readFile(filePath, "utf-8");
    const updated = replaceOrAppend(existing, wrapped);
    await writeFile(filePath, updated, "utf-8");
    return { path: filePath, created: false };
  }

  await writeFile(filePath, `# AGENTS.md\n\n${wrapped}\n`, "utf-8");
  return { path: filePath, created: true };
}

export async function writeClaudeMd(
  root: string,
  section: string
): Promise<{ path: string; created: boolean }> {
  const filePath = join(root, "CLAUDE.md");
  const wrapped = `${START_DELIMITER}\n${section.trim()}\n${END_DELIMITER}`;

  if (existsSync(filePath)) {
    const existing = await readFile(filePath, "utf-8");
    const updated = replaceOrAppend(existing, wrapped);
    await writeFile(filePath, updated, "utf-8");
    return { path: filePath, created: false };
  }

  await writeFile(filePath, `# CLAUDE.md\n\n${wrapped}\n`, "utf-8");
  return { path: filePath, created: true };
}

function replaceOrAppend(content: string, wrapped: string): string {
  const startIdx = content.indexOf(START_DELIMITER);
  const endIdx = content.indexOf(END_DELIMITER);

  if (startIdx !== -1 && endIdx !== -1) {
    // Replace existing gesso section
    return (
      content.slice(0, startIdx) +
      wrapped +
      content.slice(endIdx + END_DELIMITER.length)
    );
  }

  // Append
  return content.trimEnd() + "\n\n" + wrapped + "\n";
}
