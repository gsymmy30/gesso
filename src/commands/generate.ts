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
import { generateLogo } from "../generate/logo.js";
import { generateOgImage } from "../generate/og-image.js";
import { generateReadme } from "../generate/readme.js";
import { buildBrandJson, writeBrandJson } from "../output/brand-json.js";
import { writeBrandMd } from "../output/brand-md.js";
import { writeAgentsMd, writeClaudeMd } from "../output/agents-md.js";
import { writeAssets } from "../output/assets.js";
import { buildDiffs, printDiffSummary, type FileDiff } from "../interactive/diff.js";
import { reviewFiles, confirmAction } from "../interactive/reviewer.js";
import { renderBrandMd } from "../output/brand-md.js";
import { setBrandColors } from "../ui/colors.js";
import {
  printScanResult,
  printBrandScore,
  printProjectedScore,
  printAnalysisPreview,
  ProgressDisplay,
  printFileList,
  printSnippet,
  printError,
  printSuccess,
} from "../ui/output.js";
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
  let root: string;
  let isCloned = false;

  if (opts.repo) {
    const url = resolveRepoUrl(opts.repo);
    if (!url) {
      printError(`Invalid repo: ${opts.repo}`);
      process.exit(1);
    }
    console.log(`Cloning ${url}...`);
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
  const { total, maxTotal, items: scoreItems } = await scoreBrand(repo);
  printBrandScore(total, maxTotal, scoreItems);

  // ── Stage 3: Brief (optional) ──────────────────────────────
  let brief: { audience?: string; problem?: string; differentiator?: string } | undefined;

  if (!opts.skipBrief) {
    brief = await collectBrief();
  }

  // ── Stage 4: Generate ──────────────────────────────────────
  console.log("Generating brand identity...");
  console.log();

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

  // Phase 1: Analysis (must complete first)
  progress.update("Analysis", "running");
  const t0 = Date.now();
  let analysis: Analysis;
  try {
    analysis = await analyzeRepo(repo, brief);
    progress.update("Analysis", "done", (Date.now() - t0) / 1000);
  } catch (e) {
    progress.update("Analysis", "failed");
    progress.stop();
    printError(`Analysis failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  // Show analysis preview
  printAnalysisPreview({
    archetype: analysis.archetype,
    techStack: analysis.techStack,
    repoSize: analysis.repoSize,
    sampledFiles: repo.files.map((f) => f.path),
    hasBrief: !!brief,
    briefAnswers: brief
      ? [brief.audience, brief.problem, brief.differentiator].filter(Boolean).length
      : 0,
  });

  // Phase 2: Positioning (needs analysis)
  progress.update("Positioning", "running");
  const t1 = Date.now();
  let positioning: Positioning;
  try {
    positioning = await generatePositioning(analysis, brief);
    progress.update("Positioning", "done", (Date.now() - t1) / 1000);
  } catch (e) {
    progress.update("Positioning", "failed");
    progress.stop();
    printError(`Positioning failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  // Phase 3: Parallel generation (voice, visual, seo need positioning; copy needs voice)
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
  }
  if (parallelResults[1].status === "rejected") {
    progress.update("Visual Identity", "failed");
  }

  if (!voice || !visual) {
    progress.stop();
    printError("Required generation steps failed. Cannot continue.");
    process.exit(1);
    return; // unreachable, helps TS narrow
  }

  const confirmedVoice: Voice = voice;
  const confirmedVisual: Visual = visual;

  // Brand-color-switch moment
  setBrandColors({
    primary: confirmedVisual.palette.primary,
    accent: confirmedVisual.palette.accent,
  });

  // Phase 4: Copy, SEO, Agent instructions (parallel, depend on voice/positioning)
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
    printError(`Copy: ${(phase4[0] as PromiseRejectedResult).reason?.message ?? phase4[0].reason}`);
  }
  if (phase4[1].status === "rejected") {
    progress.update("SEO", "failed");
    printError(`SEO: ${(phase4[1] as PromiseRejectedResult).reason?.message ?? phase4[1].reason}`);
  }
  if (phase4[2].status === "rejected") {
    progress.update("Agent Instructions", "failed");
    printError(`Agent Instructions: ${(phase4[2] as PromiseRejectedResult).reason?.message ?? phase4[2].reason}`);
  }

  // Once we have copy, regenerate SEO with full copy context if first attempt used placeholder
  if (copy && seo && phase4[0].status === "fulfilled") {
    try {
      seo = await generateSEO(analysis, positioning, copy);
    } catch {
      // Keep original SEO
    }
  }

  // Apply fallbacks for failed Phase 4 steps BEFORE Phase 5 needs them
  if (!copy) {
    printError("Copy generation failed. Proceeding with partial results.");
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
    printError("SEO generation failed. Skipping SEO metadata.");
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
    printError("Agent instructions generation failed. Skipping.");
    agentInstructions = {
      agentsMdSection: "",
      claudeMdSection: "",
    };
  }

  // Phase 5: Logo, OG image, README (parallel, need visual + copy)
  let logoSvg: string | undefined;
  let ogImageBuf: Buffer | undefined;
  let readmeContent: string | undefined;

  // Read existing README for update mode
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

  // Resolve repo URL for README links
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
      logoSvg = result;
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
    printError(`Logo: ${(phase5[0] as PromiseRejectedResult).reason?.message ?? phase5[0].reason}`);
  }
  if (phase5[1].status === "rejected") {
    progress.update("OG Image", "failed");
    printError(`OG Image: ${(phase5[1] as PromiseRejectedResult).reason?.message ?? phase5[1].reason}`);
  }
  if (phase5[2].status === "rejected") {
    progress.update("README", "failed");
    printError(`README: ${(phase5[2] as PromiseRejectedResult).reason?.message ?? phase5[2].reason}`);
  }

  progress.stop();
  console.log();

  // ── Stage 5: Review ────────────────────────────────────────
  const projected = projectScore(scoreItems);
  printProjectedScore(total, projected);

  // Specificity scoring (anti-slop metric)
  const specificity = await scoreSpecificity(analysis, positioning, copy);
  const specificityTotal = specificity.onlyWeTest + specificity.repeatability;
  if (specificityTotal < 14) {
    console.log(
      `  Specificity: ${specificityTotal}/20 ⚠ Output may be too generic. Try \`--brief\` or improve your README.`
    );
  } else {
    console.log(`  Specificity: ${specificityTotal}/20 ✓ ${specificity.evidence}`);
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

  // Preview key outputs (with before/after if available)
  if (repo.existingDescription) {
    printSnippet("Before", repo.existingDescription);
  }
  printSnippet("One-liner", positioning.oneLiner);
  printSnippet("Tagline", positioning.tagline);
  printSnippet("Hero", `${copy.heroHeadline}\n${copy.heroSubheadline}`);

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
    // Auto-accept all
    await writeAllFiles(root, brandJson, agentInstructions, logoSvg, ogImageBuf, repo.existingDescription, readmeContent);
    printSuccess("All files written.");
  } else {
    const { accepted, skipped } = await reviewFiles(diffs);

    if (accepted.length === 0) {
      console.log("No files written.");
      return;
    }

    // Write accepted files
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
    }

    // Always write assets if any file was accepted
    if (accepted.length > 0) {
      const assetPaths = await writeAssets(root, brandJson, logoSvg, ogImageBuf);
      printFileList(
        assetPaths.map((p) => ({
          name: p.replace(root + "/", ""),
          description: describeAsset(p),
        }))
      );
    }

    printSuccess(
      `${accepted.length} files written, ${skipped.length} skipped.`
    );
  }

  console.log();
  printSuccess(`Brand score: ${total} → ${projected}/100`);
  console.log();
}

async function writeAllFiles(
  root: string,
  brandJson: any,
  agentInstructions: AgentInstructions,
  logoSvg?: string,
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
  await writeAssets(root, brandJson, logoSvg, ogImageBuf);
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

  console.log("Quick brief (press Enter to skip any question):");
  console.log();

  const audience = await ask("  Who is this for? ");
  const problem = await ask("  What problem does it solve? ");
  const differentiator = await ask("  What makes it different? ");

  rl.close();
  console.log();

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

function describeAsset(path: string): string {
  if (path.endsWith("brand-tokens.css")) return "CSS custom properties";
  if (path.endsWith("tailwind-brand.js")) return "Tailwind config";
  if (path.endsWith("logo.svg")) return "SVG wordmark";
  if (path.endsWith("og-image.png")) return "OG image (1200x630)";
  return "";
}
