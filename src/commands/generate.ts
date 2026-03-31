import * as readline from "node:readline";
import pLimit from "p-limit";
import { readRepo, cloneRepo, resolveRepoUrl, type RepoInfo } from "../analyze/repo-reader.js";
import { analyzeRepo } from "../analyze/signal-extractor.js";
import { scoreBrand, projectScore, scoreSpecificity } from "../analyze/brand-scorer.js";
import { generatePositioning } from "../generate/positioning.js";
import { generateVoice } from "../generate/voice.js";
import { generateCopy } from "../generate/copy.js";
import { generateVisual } from "../generate/visual.js";
import { generateSEO } from "../generate/seo.js";
import { generateAgentInstructions } from "../generate/agent-instructions.js";
import { generateLogo, type LogoResult } from "../generate/logo.js";
import { generateOgImage } from "../generate/og-image.js";
import { generateReadme } from "../generate/readme.js";
import { buildBrandJson, writeBrandJson } from "../output/brand-json.js";
import { writeBrandMd } from "../output/brand-md.js";
import { writeAgentsMd, writeClaudeMd } from "../output/agents-md.js";
import { writeAssets } from "../output/assets.js";
import { buildDiffs, printDiffSummary, type FileDiff } from "../interactive/diff.js";
import { reviewFiles } from "../interactive/reviewer.js";
import { renderBrandMd } from "../output/brand-md.js";
import { setBrandColors } from "../ui/colors.js";
import { brandSwatchLine } from "../ui/colors.js";
import {
  printScanResult,
  printBrandScore,
  printProjectedScore,
  formatAnalysisPreview,
  printPartialSuccess,
  printStageHeader,
  ProgressDisplay,
  printFileList,
  printSnippet,
  printError,
  printSuccess,
} from "../ui/output.js";
import { ui } from "../ui/colors.js";
import type {
  Analysis,
  Positioning,
  Voice,
  Copy,
  Visual,
  SEO,
  AgentInstructions,
  BrandScoreItem,
} from "../llm/schemas.js";

export interface GenerateOptions {
  path?: string;
  repo?: string;
  yes?: boolean;
  skipBrief?: boolean;
}

export async function runGenerate(opts: GenerateOptions) {
  // ── Stage 1: Scan ──────────────────────────────────────────
  printStageHeader("Scan");

  let root: string;
  let isCloned = false;

  if (opts.repo) {
    const url = resolveRepoUrl(opts.repo);
    if (!url) {
      printError(`Invalid repo: ${opts.repo}`);
      process.exit(1);
    }
    console.log(`  Cloning ${url}...`);
    root = await cloneRepo(url);
    isCloned = true;
  } else {
    root = opts.path ?? process.cwd();
  }

  const repo = await readRepo(root);

  printScanResult({
    manifest: repo.manifest ?? "none",
    readme: repo.hasReadme,
    fileCount: repo.allFilePaths.length,
    detected: detectStack(repo),
  });

  // ── Stage 2: Brand Score ───────────────────────────────────
  printStageHeader("Brand Score");

  const { total, maxTotal, items: scoreItems } = await scoreBrand(repo);
  printBrandScore(total, maxTotal, scoreItems);

  // ── Stage 3: Brief (optional) ──────────────────────────────
  let brief: { audience?: string; problem?: string; differentiator?: string } | undefined;

  if (!opts.skipBrief) {
    printStageHeader("Brief");
    brief = await collectBrief();
  }

  // ── Stage 4: Generate ──────────────────────────────────────
  printStageHeader("Generating");

  const progress = new ProgressDisplay([
    "Analysis",
    "Positioning",
    "Voice & Tone",
    "Copy",
    "Visual Identity",
    "SEO",
    "Agent Instructions",
    "README",
    "Logo",
    "OG Image",
  ]);

  progress.start();
  const limit = pLimit(3);

  // Track step results for partial success summary
  const stepResults: { name: string; status: "done" | "failed"; error?: string }[] = [];

  // Phase 1: Analysis (must complete first)
  progress.update("Analysis", "running");
  const t0 = Date.now();
  let analysis: Analysis;
  try {
    analysis = await analyzeRepo(repo, brief);
    progress.update("Analysis", "done", (Date.now() - t0) / 1000);
    stepResults.push({ name: "Analysis", status: "done" });
  } catch (e) {
    progress.update("Analysis", "failed");
    progress.stopAndClear();
    printError(`Analysis failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  // Show analysis preview via progress.log() so it doesn't interleave
  progress.log(formatAnalysisPreview({
    archetype: analysis.archetype,
    techStack: analysis.techStack,
    repoSize: analysis.repoSize,
    sampledFiles: repo.files.map((f) => f.path),
    hasBrief: !!brief,
    briefAnswers: brief
      ? [brief.audience, brief.problem, brief.differentiator].filter(Boolean).length
      : 0,
  }));

  // Phase 2: Positioning (needs analysis)
  progress.update("Positioning", "running");
  const t1 = Date.now();
  let positioning: Positioning;
  try {
    positioning = await generatePositioning(analysis, brief);
    progress.update("Positioning", "done", (Date.now() - t1) / 1000);
    stepResults.push({ name: "Positioning", status: "done" });
  } catch (e) {
    progress.update("Positioning", "failed");
    progress.stopAndClear();
    printError(`Positioning failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  // Phase 3: Parallel generation (voice + visual)
  let voice: Voice | null = null;
  let visual: Visual | null = null;

  const parallelResults = await Promise.allSettled([
    limit(async () => {
      progress.update("Voice & Tone", "running");
      const t = Date.now();
      const result = await generateVoice(analysis, positioning);
      progress.update("Voice & Tone", "done", (Date.now() - t) / 1000);
      voice = result;
      return result;
    }),
    limit(async () => {
      progress.update("Visual Identity", "running");
      const t = Date.now();
      const result = await generateVisual(analysis, positioning, repo.existingVisuals);
      progress.update("Visual Identity", "done", (Date.now() - t) / 1000);
      visual = result;
      return result;
    }),
  ]);

  if (parallelResults[0].status === "rejected") {
    progress.update("Voice & Tone", "failed");
    stepResults.push({ name: "Voice & Tone", status: "failed", error: "generation error" });
  } else {
    stepResults.push({ name: "Voice & Tone", status: "done" });
  }
  if (parallelResults[1].status === "rejected") {
    progress.update("Visual Identity", "failed");
    stepResults.push({ name: "Visual Identity", status: "failed", error: "generation error" });
  } else {
    stepResults.push({ name: "Visual Identity", status: "done" });
  }

  if (!voice || !visual) {
    progress.stopAndClear();
    printError("Required generation steps failed. Cannot continue.");
    process.exit(1);
    return;
  }

  const confirmedVoice: Voice = voice;
  const confirmedVisual: Visual = visual;

  // ── Brand-color-switch moment ──────────────────────────────
  setBrandColors({
    primary: confirmedVisual.palette.primary,
    accent: confirmedVisual.palette.accent,
  });
  progress.log(brandSwatchLine(confirmedVisual.palette));

  // Phase 4: Copy, SEO, Agent instructions (parallel)
  let copy: Copy | null = null;
  let seo: SEO | null = null;
  let agentInstructions: AgentInstructions | null = null;

  const phase4 = await Promise.allSettled([
    limit(async () => {
      progress.update("Copy", "running");
      const t = Date.now();
      const result = await generateCopy(analysis, positioning, confirmedVoice);
      progress.update("Copy", "done", (Date.now() - t) / 1000);
      copy = result;
      return result;
    }),
    limit(async () => {
      progress.update("SEO", "running");
      const t = Date.now();
      const result = await generateSEO(analysis, positioning, {
        heroHeadline: "",
        heroSubheadline: "",
        ogDescription: positioning.oneLiner,
        tweetLaunch: "",
        launchPost: "",
        readmeIntro: "",
      });
      progress.update("SEO", "done", (Date.now() - t) / 1000);
      seo = result;
      return result;
    }),
    limit(async () => {
      progress.update("Agent Instructions", "running");
      const t = Date.now();
      const result = await generateAgentInstructions(analysis, positioning, confirmedVoice);
      progress.update("Agent Instructions", "done", (Date.now() - t) / 1000);
      agentInstructions = result;
      return result;
    }),
  ]);

  if (phase4[0].status === "rejected") {
    progress.update("Copy", "failed");
    stepResults.push({ name: "Copy", status: "failed", error: "timeout" });
  } else {
    stepResults.push({ name: "Copy", status: "done" });
  }
  if (phase4[1].status === "rejected") {
    progress.update("SEO", "failed");
    stepResults.push({ name: "SEO", status: "failed", error: "rate limited" });
  } else {
    stepResults.push({ name: "SEO", status: "done" });
  }
  if (phase4[2].status === "rejected") {
    progress.update("Agent Instructions", "failed");
    stepResults.push({ name: "Agent Instructions", status: "failed", error: "failed" });
  } else {
    stepResults.push({ name: "Agent Instructions", status: "done" });
  }

  // Regenerate SEO with full copy context if available
  if (copy && seo && phase4[0].status === "fulfilled") {
    try {
      seo = await generateSEO(analysis, positioning, copy);
    } catch {
      // Keep original SEO
    }
  }

  // Apply fallbacks for failed steps
  if (!copy) {
    copy = {
      heroHeadline: analysis.productName,
      heroSubheadline: positioning.oneLiner,
      ogDescription: positioning.oneLiner.slice(0, 160),
      tweetLaunch: positioning.oneLiner.slice(0, 280),
      launchPost: positioning.elevatorPitch,
      readmeIntro: positioning.positioningStatement,
    };
  }
  if (!seo) {
    seo = {
      keywords: [],
      metaTitle: analysis.productName,
      metaDescription: positioning.oneLiner.slice(0, 160),
      ogTitle: analysis.productName,
      ogDescription: positioning.oneLiner.slice(0, 160),
      structuredData: {
        type: "SoftwareSourceCode",
        name: analysis.productName,
        description: positioning.oneLiner,
      },
    };
  }
  if (!agentInstructions) {
    agentInstructions = {
      agentsMdSection: "",
      claudeMdSection: "",
    };
  }

  // Phase 5: Logo, OG image, README (parallel)
  let logoResult: LogoResult | undefined;
  let ogImageBuf: Buffer | undefined;
  let readmeContent: string | undefined;

  let existingReadme: string | null = null;
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    for (const name of ["README.md", "readme.md", "Readme.md"]) {
      try {
        existingReadme = await readFile(join(root, name), "utf-8");
        break;
      } catch { /* try next */ }
    }
  } catch { /* no readme */ }

  let repoUrl: string | null = null;
  if (opts.repo) {
    const url = resolveRepoUrl(opts.repo);
    repoUrl = url?.replace(/\.git$/, "") ?? null;
  } else {
    try {
      const { execFileSync } = await import("node:child_process");
      const remote = execFileSync("git", ["remote", "get-url", "origin"], { cwd: root, stdio: "pipe" }).toString().trim();
      repoUrl = remote.replace(/\.git$/, "").replace(/^git@github\.com:/, "https://github.com/");
    } catch { /* not a git repo or no remote */ }
  }

  const phase5 = await Promise.allSettled([
    limit(async () => {
      progress.update("Logo", "running");
      const t = Date.now();
      const result = await generateLogo({
        analysis,
        positioning,
        visual: confirmedVisual,
      });
      progress.update("Logo", "done", (Date.now() - t) / 1000);
      logoResult = result;
    }),
    limit(async () => {
      progress.update("OG Image", "running");
      const t = Date.now();
      const result = await generateOgImage({
        productName: analysis.productName,
        tagline: positioning.tagline,
        palette: confirmedVisual.palette,
      });
      progress.update("OG Image", "done", (Date.now() - t) / 1000);
      ogImageBuf = result;
    }),
    limit(async () => {
      progress.update("README", "running");
      const t = Date.now();
      const result = await generateReadme({
        analysis,
        positioning,
        voice: confirmedVoice,
        copy: copy!,
        visual: confirmedVisual,
        seo: seo!,
        existingReadme,
        repoUrl,
        hasLogo: true,
      });
      progress.update("README", "done", (Date.now() - t) / 1000);
      readmeContent = result;
    }),
  ]);

  if (phase5[0].status === "rejected") {
    progress.update("Logo", "failed");
    stepResults.push({ name: "Logo", status: "failed", error: "failed" });
  } else {
    stepResults.push({ name: "Logo", status: "done" });
  }
  if (phase5[1].status === "rejected") {
    progress.update("OG Image", "failed");
    stepResults.push({ name: "OG Image", status: "failed", error: "failed" });
  } else {
    stepResults.push({ name: "OG Image", status: "done" });
  }
  if (phase5[2].status === "rejected") {
    progress.update("README", "failed");
    stepResults.push({ name: "README", status: "failed", error: "failed" });
  } else {
    stepResults.push({ name: "README", status: "done" });
  }

  // ── Clear progress, show results ──────────────────────────
  progress.stopAndClear();

  // Show partial success if any steps failed
  const failedSteps = stepResults.filter((s) => s.status === "failed");
  if (failedSteps.length > 0) {
    printPartialSuccess(stepResults);
  }

  // ── Stage 5: Review ────────────────────────────────────────
  printStageHeader("Review");

  const projected = projectScore(scoreItems);
  printProjectedScore(total, projected);
  console.log();

  // Specificity scoring
  const specificity = await scoreSpecificity(analysis, positioning, copy);
  const specificityTotal = specificity.onlyWeTest + specificity.repeatability;
  if (specificityTotal < 14) {
    console.log(
      `  ${ui.muted("Specificity:")} ${specificityTotal}/20 ${ui.error("⚠")} Output may be too generic.`
    );
  } else {
    console.log(
      `  ${ui.muted("Specificity:")} ${specificityTotal}/20 ${ui.success("✓")} ${specificity.evidence}`
    );
  }
  console.log();

  // Build brand.json
  const brandJson = buildBrandJson({
    analysis,
    positioning,
    voice,
    copy,
    visual,
    seo,
    agentInstructions,
    brandScore: { before: total, after: projected, breakdown: scoreItems },
  });

  // Preview key outputs
  if (repo.existingDescription) {
    printSnippet("Before", repo.existingDescription);
    console.log();
  }
  printSnippet("One-liner", positioning.oneLiner);
  console.log();
  printSnippet("Tagline", positioning.tagline);
  console.log();

  // Build file list for review
  const brandMdContent = renderBrandMd(brandJson, repo.existingDescription);
  const filesToWrite: { path: string; content: string }[] = [
    { path: "brand.json", content: JSON.stringify(brandJson, null, 2) + "\n" },
    { path: "brand.md", content: brandMdContent },
  ];

  if (agentInstructions.agentsMdSection) {
    filesToWrite.push({ path: "AGENTS.md", content: agentInstructions.agentsMdSection });
  }
  if (agentInstructions.claudeMdSection) {
    filesToWrite.push({ path: "CLAUDE.md", content: agentInstructions.claudeMdSection });
  }
  if (readmeContent) {
    filesToWrite.push({ path: "README.md", content: readmeContent });
  }

  const diffs = await buildDiffs(root, filesToWrite);
  printDiffSummary(diffs);

  // ── Stage 6: Write ─────────────────────────────────────────
  if (opts.yes) {
    await writeAllFiles(root, brandJson, agentInstructions, logoResult, ogImageBuf, repo.existingDescription, readmeContent);
    const assetPaths = await writeAssets(root, brandJson, logoResult, ogImageBuf);

    const allWritten = [
      "brand.json",
      "brand.md",
      ...assetPaths.map((p) => p.replace(root + "/", "")),
    ];
    for (const f of allWritten) {
      console.log(`  ${ui.success("✓")} wrote ${f}`);
    }
    console.log();

    printStageHeader("Done");
    printSuccess(`Brand identity generated.`);
    console.log();
    printProjectedScore(total, projected);
    console.log();
    printFileList([
      { name: "brand.json", description: "canonical spec" },
      { name: "brand.md", description: "human-readable guide" },
      ...assetPaths.map((p) => ({
        name: p.replace(root + "/", ""),
        description: describeAsset(p),
      })),
    ]);
    console.log();
    printNextSteps(allWritten);
    console.log();
  } else {
    const { accepted, skipped } = await reviewFiles(diffs);

    if (accepted.length === 0) {
      console.log("  No files written.");
      return;
    }

    // Write accepted files
    const writtenPaths: string[] = [];
    for (const diff of accepted) {
      if (diff.path === "brand.json") {
        await writeBrandJson(root, brandJson);
      } else if (diff.path === "brand.md") {
        await writeBrandMd(root, brandJson, repo.existingDescription);
      } else if (diff.path === "AGENTS.md" && agentInstructions.agentsMdSection) {
        await writeAgentsMd(root, agentInstructions.agentsMdSection);
      } else if (diff.path === "CLAUDE.md" && agentInstructions.claudeMdSection) {
        await writeClaudeMd(root, agentInstructions.claudeMdSection);
      } else if (diff.path === "README.md" && readmeContent) {
        const { writeFile } = await import("node:fs/promises");
        const { join } = await import("node:path");
        await writeFile(join(root, "README.md"), readmeContent, "utf-8");
      }
      console.log(`  ${ui.success("✓")} wrote ${diff.path}`);
      writtenPaths.push(diff.path);
    }

    // Write assets if any file was accepted
    if (accepted.length > 0) {
      const assetPaths = await writeAssets(root, brandJson, logoResult, ogImageBuf);
      for (const p of assetPaths) {
        const rel = p.replace(root + "/", "");
        console.log(`  ${ui.success("✓")} wrote ${rel}`);
        writtenPaths.push(rel);
      }
      console.log();

      printStageHeader("Done");
      printSuccess(`${accepted.length} files written, ${skipped.length} skipped.`);
      console.log();
      printProjectedScore(total, projected);
      console.log();
      printFileList([
        ...accepted.map((d) => ({
          name: d.path,
          description: d.status === "create" ? "new" : "updated",
        })),
        ...assetPaths.map((p) => ({
          name: p.replace(root + "/", ""),
          description: describeAsset(p),
        })),
      ]);
      console.log();
      printNextSteps(writtenPaths);
      console.log();
    }
  }
}

async function writeAllFiles(
  root: string,
  brandJson: any,
  agentInstructions: AgentInstructions,
  logoResult?: LogoResult,
  ogImageBuf?: Buffer,
  existingDescription?: string | null,
  readmeContent?: string
) {
  await writeBrandJson(root, brandJson);
  await writeBrandMd(root, brandJson, existingDescription);
  if (agentInstructions.agentsMdSection) {
    await writeAgentsMd(root, agentInstructions.agentsMdSection);
  }
  if (agentInstructions.claudeMdSection) {
    await writeClaudeMd(root, agentInstructions.claudeMdSection);
  }
  if (readmeContent) {
    const { writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    await writeFile(join(root, "README.md"), readmeContent, "utf-8");
  }
}

async function collectBrief(): Promise<{
  audience?: string;
  problem?: string;
  differentiator?: string;
}> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  console.log(ui.dim("  Answer to sharpen results. Press Enter to skip. Ctrl+C to quit."));
  console.log();

  const audience = await ask(`  ${ui.muted("→")} Who is this for? `);
  const problem = await ask(`  ${ui.muted("→")} What problem does it solve? `);
  const differentiator = await ask(`  ${ui.muted("→")} What makes it different? `);

  rl.close();

  return {
    audience: audience.trim() || undefined,
    problem: problem.trim() || undefined,
    differentiator: differentiator.trim() || undefined,
  };
}

function detectStack(repo: RepoInfo): string {
  if (repo.manifest === "package.json") return "Node.js / TypeScript";
  if (repo.manifest === "Cargo.toml") return "Rust";
  if (repo.manifest === "pyproject.toml" || repo.manifest === "setup.py") return "Python";
  if (repo.manifest === "go.mod") return "Go";
  if (repo.manifest === "build.gradle" || repo.manifest === "pom.xml") return "Java";
  return "Unknown";
}

function printNextSteps(writtenFiles: string[]) {
  const files = writtenFiles.join(" ");
  console.log(`  ${ui.muted("Next steps:")}`);
  console.log();
  console.log(`    ${ui.dim("git add")} ${files}`);
  console.log(`    ${ui.dim('git commit -m "Add brand identity"')}`);
}

function describeAsset(path: string): string {
  if (path.endsWith("brand-tokens.css")) return "CSS custom properties";
  if (path.endsWith("tailwind-brand.js")) return "Tailwind config";
  if (path.endsWith("logo-light.svg")) return "logo (light)";
  if (path.endsWith("logo-dark.svg")) return "logo (dark)";
  if (path.endsWith("og-image.png")) return "OG image (1200x630)";
  return "";
}
