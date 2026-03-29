#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { initLLM } from "./llm/client.js";
import { printHeader, printError } from "./ui/output.js";
import { runGenerate } from "./commands/generate.js";

const pkg = JSON.parse(
  readFileSync(join(new URL(".", import.meta.url).pathname, "..", "package.json"), "utf-8")
);

const program = new Command();

program
  .name("gesso")
  .version(pkg.version)
  .description("Generate complete brand identity from your codebase");

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
      printError(e instanceof Error ? e.message : String(e));
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
