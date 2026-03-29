import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, extname, basename } from "node:path";
import { execFileSync } from "node:child_process";
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

export interface MaturitySignals {
  version: string;
  hasCI: boolean;
  hasTests: boolean;
  hasContributing: boolean;
}

export interface ExistingVisuals {
  detectedColors: string[];
  hasLogo: boolean;
  hasFavicon: boolean;
  colorSource: string | null;
}

export interface RepoInfo {
  root: string;
  files: RepoFile[];
  allFilePaths: string[];
  manifest: string | null;
  hasReadme: boolean;
  isCloned: boolean;
  maturitySignals: MaturitySignals;
  existingVisuals: ExistingVisuals;
  candidateVoiceSamples: string[];
  existingDescription: string | null;
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
    execFileSync(
      "git",
      ["clone", "--depth", "1", "--single-branch", url, tmpDir],
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

// ── Signal extraction helpers ──────────────────────────────

const DEFAULT_COLORS = new Set([
  "#000000", "#ffffff", "#f5f5f5", "#333333", "#666666",
  "#999999", "#cccccc", "#111111", "#222222", "#eeeeee",
]);

const HEX_REGEX = /#([0-9a-fA-F]{6})\b/g;

export async function extractVisualDNA(root: string, allPaths: string[]): Promise<ExistingVisuals> {
  const colorFiles = allPaths.filter((p) => {
    const name = basename(p);
    return (
      name.startsWith("tailwind.config") ||
      p.endsWith(".css") ||
      name.startsWith("theme.") ||
      name.startsWith("tokens.")
    );
  });

  const colorCounts = new Map<string, number>();
  let colorSource: string | null = null;

  for (const relPath of colorFiles.slice(0, 10)) {
    try {
      const content = await readFile(join(root, relPath), "utf-8");
      let match: RegExpExecArray | null;
      HEX_REGEX.lastIndex = 0;
      while ((match = HEX_REGEX.exec(content)) !== null) {
        const hex = `#${match[1].toLowerCase()}`;
        if (!DEFAULT_COLORS.has(hex)) {
          colorCounts.set(hex, (colorCounts.get(hex) ?? 0) + 1);
          if (!colorSource) colorSource = relPath;
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  const detectedColors = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([hex]) => hex);

  const hasLogo =
    existsSync(join(root, "logo.svg")) ||
    existsSync(join(root, "logo.png")) ||
    existsSync(join(root, "public/logo.svg")) ||
    existsSync(join(root, "public/logo.png"));

  const hasFavicon =
    existsSync(join(root, "favicon.ico")) ||
    existsSync(join(root, "favicon.svg")) ||
    existsSync(join(root, "public/favicon.ico")) ||
    existsSync(join(root, "public/favicon.svg"));

  return { detectedColors, hasLogo, hasFavicon, colorSource };
}

export function detectMaturitySignals(root: string): MaturitySignals {
  const hasCI =
    existsSync(join(root, ".github/workflows")) ||
    existsSync(join(root, ".gitlab-ci.yml")) ||
    existsSync(join(root, ".circleci"));

  const hasTests =
    existsSync(join(root, "test")) ||
    existsSync(join(root, "tests")) ||
    existsSync(join(root, "__tests__")) ||
    existsSync(join(root, "spec"));

  const hasContributing =
    existsSync(join(root, "CONTRIBUTING.md")) ||
    existsSync(join(root, "contributing.md"));

  let version = "0.0.0";
  try {
    const pkg = JSON.parse(
      require("node:fs").readFileSync(join(root, "package.json"), "utf-8")
    );
    if (pkg.version) version = pkg.version;
  } catch {
    try {
      const cargo = require("node:fs").readFileSync(join(root, "Cargo.toml"), "utf-8");
      const vMatch = cargo.match(/^version\s*=\s*"([^"]+)"/m);
      if (vMatch) version = vMatch[1];
    } catch {
      // No version found
    }
  }

  return { version, hasCI, hasTests, hasContributing };
}

export async function extractVoiceSamples(root: string): Promise<string[]> {
  const readmePaths = ["README.md", "readme.md", "Readme.md"];
  let readmeContent: string | null = null;

  for (const name of readmePaths) {
    try {
      readmeContent = await readFile(join(root, name), "utf-8");
      break;
    } catch {
      // Try next
    }
  }

  if (!readmeContent) return [];

  const lines = readmeContent.split("\n");
  const samples: string[] = [];

  for (const line of lines) {
    if (samples.length >= 8) break;
    const trimmed = line.trim();
    // Skip headers, badges, code blocks, empty lines, links-only lines
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("```")) continue;
    if (trimmed.startsWith("![")) continue;
    if (trimmed.startsWith("[![")) continue;
    if (trimmed.startsWith("|")) continue;
    if (trimmed.startsWith("-") && trimmed.length < 30) continue;
    if (trimmed.length < 20) continue;
    // Must look like a prose sentence (contains spaces, reasonable length)
    if (trimmed.split(" ").length < 4) continue;
    samples.push(trimmed);
  }

  return samples;
}

export async function extractExistingDescription(root: string): Promise<string | null> {
  // Try package.json
  try {
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf-8"));
    if (pkg.description && pkg.description.length > 5) return pkg.description;
  } catch { /* skip */ }

  // Try Cargo.toml
  try {
    const cargo = await readFile(join(root, "Cargo.toml"), "utf-8");
    const match = cargo.match(/^description\s*=\s*"([^"]+)"/m);
    if (match) return match[1];
  } catch { /* skip */ }

  // Try pyproject.toml
  try {
    const pyproject = await readFile(join(root, "pyproject.toml"), "utf-8");
    const match = pyproject.match(/^description\s*=\s*"([^"]+)"/m);
    if (match) return match[1];
  } catch { /* skip */ }

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

  // Extract enrichment signals (parallel, outside LLM token budget)
  const [maturitySignals, existingVisuals, candidateVoiceSamples, existingDescription] =
    await Promise.all([
      Promise.resolve(detectMaturitySignals(root)),
      extractVisualDNA(root, filtered),
      extractVoiceSamples(root),
      extractExistingDescription(root),
    ]);

  return {
    root,
    files,
    allFilePaths: filtered,
    manifest,
    hasReadme,
    isCloned: false,
    maturitySignals,
    existingVisuals,
    candidateVoiceSamples,
    existingDescription,
  };
}
