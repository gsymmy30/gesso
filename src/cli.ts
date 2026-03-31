#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { initLLM } from "./llm/client.js";
import { printHeader, printError } from "./ui/output.js";
import { runGenerate } from "./commands/generate.js";

// Auto-load .env from cwd (no dependency needed)
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

const pkg = JSON.parse(
  readFileSync(join(new URL(".", import.meta.url).pathname, "..", "package.json"), "utf-8")
);

const program = new Command();

program
  .name("gesso")
  .version(pkg.version)
  .description("Generate complete brand identity from your codebase")
  .addHelpText("after", `
Examples:
  $ gesso                          Analyze current directory
  $ gesso -r owner/repo            Analyze a GitHub repo
  $ gesso --yes --skip-brief       Non-interactive mode (CI/scripts)
  $ gesso score                    Check brand score without generating
`);

program
  .command("generate", { isDefault: true })
  .description("Analyze repo and generate brand assets")
  .option("-p, --path <dir>", "Path to local repo (default: cwd)")
  .option("-r, --repo <url>", "GitHub repo URL or owner/repo shorthand")
  .option("-y, --yes", "Accept all changes without review")
  .option("--skip-brief", "Skip the interactive brief questions")
  .action(async (opts) => {
    printHeader(pkg.version);

    try {
      initLLM();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      printError(msg);
      if (msg.includes("API key") || msg.includes("ANTHROPIC") || msg.includes("OPENAI")) {
        console.log();
        console.log("  To fix this, set one of these environment variables:");
        console.log("    export ANTHROPIC_API_KEY=sk-ant-...");
        console.log("    export OPENAI_API_KEY=sk-...");
        console.log();
        console.log("  Or create a .env file in your project root.");
      }
      process.exit(1);
    }

    try {
      await runGenerate(opts);
    } catch (e) {
      printError(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  });

program
  .command("score")
  .description("Check your repo's brand score without generating anything")
  .option("-p, --path <dir>", "Path to local repo (default: cwd)")
  .option("-r, --repo <url>", "GitHub repo URL or owner/repo shorthand")
  .action(async (opts) => {
    printHeader(pkg.version);

    try {
      initLLM();
    } catch (e) {
      printError(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }

    const { readRepo, cloneRepo, resolveRepoUrl } = await import("./analyze/repo-reader.js");
    const { scoreBrand } = await import("./analyze/brand-scorer.js");
    const { printBrandScore, printScanResult } = await import("./ui/output.js");

    let root: string;
    if (opts.repo) {
      const url = resolveRepoUrl(opts.repo);
      if (!url) {
        printError(`Invalid repo: ${opts.repo}`);
        process.exit(1);
      }
      console.log(`Cloning ${url}...`);
      root = await cloneRepo(url);
    } else {
      root = opts.path ?? process.cwd();
    }

    const repo = await readRepo(root);

    printScanResult({
      manifest: repo.manifest ?? "none",
      readme: repo.hasReadme,
      fileCount: repo.allFilePaths.length,
      detected: repo.manifest === "package.json"
        ? "Node.js / TypeScript"
        : repo.manifest ?? "Unknown",
    });

    const { total, maxTotal, items } = await scoreBrand(repo);
    printBrandScore(total, maxTotal, items);
  });

program.parse();
