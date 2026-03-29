import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, extname, basename } from "node:path";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const SKIP_DIRS = new Set([
  "node_modules",
  "vendor",
  "dist",
  "build",
  ".git",
  ".next",
  ".nuxt",
  "__pycache__",
  ".cache",
  "coverage",
  ".turbo",
]);

const SKIP_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "Cargo.lock",
  "Gemfile.lock",
  "poetry.lock",
  "composer.lock",
  "bun.lockb",
]);

const BINARY_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp3",
  ".mp4",
  ".webm",
  ".zip",
  ".tar",
  ".gz",
  ".pdf",
  ".wasm",
]);

const MAX_FILE_SIZE = 50_000; // 50KB
const MAX_FILES = 50;
const MAX_LINES_PER_FILE = 500;
const TOKEN_BUDGET = 16_000; // ~4 chars per token

// Priority tiers for sampling (lower = higher priority)
const PRIORITY: Record<string, number> = {
  "README.md": 0,
  "readme.md": 0,
  "package.json": 1,
  "Cargo.toml": 1,
  "pyproject.toml": 1,
  "go.mod": 1,
  "setup.py": 1,
  "build.gradle": 1,
  "pom.xml": 1,
};

function getFilePriority(filePath: string): number {
  const name = basename(filePath);
  if (PRIORITY[name] !== undefined) return PRIORITY[name];
  if (name.endsWith(".md")) return 5; // docs
  if (filePath.includes("test") || filePath.includes("spec")) return 6;
  // src/ entry points
  if (
    name === "index.ts" ||
    name === "index.js" ||
    name === "main.ts" ||
    name === "main.js" ||
    name === "cli.ts" ||
    name === "cli.js" ||
    name === "app.ts" ||
    name === "app.js" ||
    name === "mod.rs" ||
    name === "lib.rs" ||
    name === "main.go" ||
    name === "main.py"
  ) {
    return 2;
  }
  // Other source files
  return 4;
}

export interface RepoFile {
  path: string;
  content: string;
  lines: number;
}

export interface RepoInfo {
  root: string;
  files: RepoFile[];
  allFilePaths: string[];
  manifest: string | null;
  hasReadme: boolean;
  isCloned: boolean;
}

function isGessoIgnored(filePath: string, ignorePatterns: string[]): boolean {
  const name = basename(filePath);
  // Auto-exclude secrets
  const secretPatterns = [
    ".env",
    "credentials",
    ".pem",
    ".key",
    ".secret",
    ".p12",
    ".pfx",
  ];
  for (const pat of secretPatterns) {
    if (name.includes(pat)) return true;
  }
  for (const pattern of ignorePatterns) {
    if (filePath.includes(pattern) || name === pattern) return true;
  }
  return false;
}

async function loadGessoIgnore(root: string): Promise<string[]> {
  const ignorePath = join(root, ".gessoignore");
  try {
    const content = await readFile(ignorePath, "utf-8");
    return content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  } catch {
    return [];
  }
}

async function collectFiles(dir: string, root: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".gessoignore") continue;
      const fullPath = join(current, entry.name);

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(fullPath);
      } else {
        const relPath = relative(root, fullPath);
        if (SKIP_FILES.has(entry.name)) continue;
        if (BINARY_EXTS.has(extname(entry.name).toLowerCase())) continue;
        results.push(relPath);
      }
    }
  }

  await walk(dir);
  return results;
}

export async function cloneRepo(url: string): Promise<string> {
  const tmpDir = join(
    process.env.TMPDIR ?? "/tmp",
    `gesso-clone-${Date.now()}`
  );
  try {
    execSync(
      `git clone --depth 1 --single-branch ${url} ${tmpDir}`,
      { stdio: "pipe", timeout: 60_000 }
    );
  } catch (e: any) {
    if (e.message?.includes("Authentication") || e.stderr?.toString().includes("Authentication")) {
      throw new Error(
        "This looks like a private repo. Set GITHUB_TOKEN to continue."
      );
    }
    throw new Error(`Failed to clone: ${e.message}`);
  }
  return tmpDir;
}

export function resolveRepoUrl(input: string): string | null {
  // owner/repo shorthand
  if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(input)) {
    return `https://github.com/${input}.git`;
  }
  // Full URL
  if (input.startsWith("https://") || input.startsWith("git@")) {
    return input.endsWith(".git") ? input : input + ".git";
  }
  return null;
}

export async function readRepo(root: string): Promise<RepoInfo> {
  const ignorePatterns = await loadGessoIgnore(root);
  const allPaths = await collectFiles(root, root);
  const filtered = allPaths.filter((p) => !isGessoIgnored(p, ignorePatterns));

  // Sort by priority then alphabetically (deterministic)
  filtered.sort((a, b) => {
    const pa = getFilePriority(a);
    const pb = getFilePriority(b);
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });

  // Sample files within budget
  const files: RepoFile[] = [];
  let totalChars = 0;
  const charBudget = TOKEN_BUDGET * 4;

  for (const relPath of filtered) {
    if (files.length >= MAX_FILES) break;
    if (totalChars >= charBudget) break;

    const fullPath = join(root, relPath);
    try {
      const fileStat = await stat(fullPath);
      if (fileStat.size > MAX_FILE_SIZE) continue;

      let content = await readFile(fullPath, "utf-8");
      const lines = content.split("\n");
      if (lines.length > MAX_LINES_PER_FILE) {
        content = lines.slice(0, MAX_LINES_PER_FILE).join("\n");
      }

      if (totalChars + content.length > charBudget) {
        // Truncate to fit
        content = content.slice(0, charBudget - totalChars);
      }

      files.push({
        path: relPath,
        content,
        lines: content.split("\n").length,
      });
      totalChars += content.length;
    } catch {
      // Skip unreadable files
    }
  }

  // Detect manifest
  const manifests = [
    "package.json",
    "Cargo.toml",
    "pyproject.toml",
    "go.mod",
    "setup.py",
    "build.gradle",
    "pom.xml",
  ];
  const manifest = manifests.find((m) => existsSync(join(root, m))) ?? null;
  const hasReadme = existsSync(join(root, "README.md")) || existsSync(join(root, "readme.md"));

  return {
    root,
    files,
    allFilePaths: filtered,
    manifest,
    hasReadme,
    isCloned: false,
  };
}
