import { generateStructured } from "../llm/client.js";
import {
  BrandScoreLLMSchema,
  SpecificityScoreSchema,
  type BrandScoreItem,
  type BrandScoreLLM,
  type SpecificityScore,
  type Analysis,
  type Positioning,
  type Copy,
} from "../llm/schemas.js";
import type { RepoInfo } from "./repo-reader.js";

// Heuristic checks (fast, free, no LLM)
function heuristicChecks(repo: RepoInfo): BrandScoreItem[] {
  const items: BrandScoreItem[] = [];

  // Has tagline/description in manifest (10 pts)
  const manifest = repo.files.find(
    (f) =>
      f.path === "package.json" ||
      f.path === "Cargo.toml" ||
      f.path === "pyproject.toml"
  );
  let taglineScore = 0;
  if (manifest) {
    const hasDesc =
      manifest.content.includes('"description"') ||
      manifest.content.includes("description =");
    taglineScore = hasDesc ? 10 : 0;
  }
  items.push({
    name: "Tagline",
    score: taglineScore,
    maxScore: 10,
    reason: taglineScore > 0 ? "Found description in manifest" : "No description in manifest",
  });

  // Has visual identity (10 pts)
  const allContent = repo.files.map((f) => f.content).join("\n");
  const hasLogo =
    allContent.includes("logo") ||
    repo.allFilePaths.some((p) => p.includes("logo"));
  const hasColors = /(?:#[0-9a-fA-F]{6}|rgb\(|hsl\()/.test(allContent);
  const visualScore = (hasLogo ? 5 : 0) + (hasColors ? 5 : 0);
  items.push({
    name: "Visual identity",
    score: visualScore,
    maxScore: 10,
    reason: hasLogo && hasColors ? "Logo + colors found" : hasLogo ? "Logo ref found" : hasColors ? "Color values found" : "No visual identity signals",
  });

  // Has meta/OG tags (10 pts)
  const hasOg = allContent.includes("og:image") || allContent.includes("og:description");
  const hasMeta = allContent.includes("<meta") || allContent.includes("meta:");
  const ogScore = (hasOg ? 7 : 0) + (hasMeta ? 3 : 0);
  items.push({
    name: "Meta/OG tags",
    score: Math.min(ogScore, 10),
    maxScore: 10,
    reason: hasOg ? "OG tags found" : "No OG tags",
  });

  // No banned words (10 pts)
  const bannedWords = [
    "seamless",
    "seamlessly",
    "cutting-edge",
    "best-in-class",
    "world-class",
    "game-changing",
    "revolutionary",
    "disruptive",
    "synergy",
    "leverage",
    "paradigm",
    "holistic",
    "streamline",
    "empower",
  ];
  const readme = repo.files.find(
    (f) => f.path.toLowerCase() === "readme.md"
  );
  const readmeContent = (readme?.content ?? "").toLowerCase();
  const foundBanned = bannedWords.filter((w) => readmeContent.includes(w));
  const bannedScore = foundBanned.length === 0 ? 10 : Math.max(0, 10 - foundBanned.length * 2);
  items.push({
    name: "No banned words",
    score: bannedScore,
    maxScore: 10,
    reason:
      foundBanned.length === 0
        ? "Clean copy"
        : `Found: ${foundBanned.join(", ")}`,
  });

  // Has brand guide (10 pts)
  const brandFiles = ["brand.md", "BRANDING.md", "style-guide.md", "DESIGN.md"];
  const hasBrandGuide = repo.allFilePaths.some((p) =>
    brandFiles.some((b) => p.toLowerCase().endsWith(b.toLowerCase()))
  );
  items.push({
    name: "Brand guide",
    score: hasBrandGuide ? 10 : 0,
    maxScore: 10,
    reason: hasBrandGuide ? "Brand/style guide found" : "No brand guide",
  });

  return items;
}

// LLM checks (batched into one call)
async function llmChecks(repo: RepoInfo): Promise<BrandScoreItem[]> {
  const readme = repo.files.find((f) => f.path.toLowerCase() === "readme.md");
  const otherDocs = repo.files.filter(
    (f) => f.path.endsWith(".md") && f.path.toLowerCase() !== "readme.md"
  );
  const sourceFiles = repo.files.filter(
    (f) => !f.path.endsWith(".md") && !f.path.endsWith(".json")
  );

  // Sample error strings from source
  const errorSamples = sourceFiles
    .flatMap((f) => {
      const lines = f.content.split("\n");
      return lines.filter(
        (l) =>
          l.includes("Error(") ||
          l.includes("throw") ||
          l.includes("console.error") ||
          l.includes("panic!(") ||
          l.includes("raise ")
      );
    })
    .slice(0, 10);

  try {
    const result = await generateStructured({
      schema: BrandScoreLLMSchema,
      schemaName: "brand_score_llm",
      temperature: 0,
      system: `You are a brand consistency evaluator. Score each dimension based on the evidence provided.
Be fair but honest. A score of 0 means the signal is completely absent.`,
      prompt: `Evaluate this repository's brand consistency.

README.md:
${readme?.content ?? "(no README found)"}

Other docs (${otherDocs.length} files):
${otherDocs.map((d) => `--- ${d.path} ---\n${d.content.slice(0, 500)}`).join("\n")}

Error message samples:
${errorSamples.length > 0 ? errorSamples.join("\n") : "(no error messages found)"}

Score each dimension:
1. README positioning (0-15): Does README explain what this is and who it's for? Not just install instructions.
2. Tone consistency (0-15): Compare tone of README vs other .md files. Consistent voice?
3. Feature naming (0-10): Are commands/features named consistently? Follow a convention?
4. Error voice (0-10): Do error messages have a consistent, helpful tone?`,
      maxTokens: 1024,
      timeoutMs: 15_000,
    });

    return [
      {
        name: "README clarity",
        score: result.readmePositioning.score,
        maxScore: 15,
        reason: result.readmePositioning.reason,
      },
      {
        name: "Tone consistency",
        score: result.toneConsistency.score,
        maxScore: 15,
        reason: result.toneConsistency.reason,
      },
      {
        name: "Feature naming",
        score: result.featureNaming.score,
        maxScore: 10,
        reason: result.featureNaming.reason,
      },
      {
        name: "Error voice",
        score: result.errorVoice.score,
        maxScore: 10,
        reason: result.errorVoice.reason,
      },
    ];
  } catch {
    // LLM check failed, return zeros
    return [
      { name: "README clarity", score: 0, maxScore: 15, reason: "Check failed" },
      { name: "Tone consistency", score: 0, maxScore: 15, reason: "Check failed" },
      { name: "Feature naming", score: 0, maxScore: 10, reason: "Check failed" },
      { name: "Error voice", score: 0, maxScore: 10, reason: "Check failed" },
    ];
  }
}

export async function scoreBrand(
  repo: RepoInfo
): Promise<{ total: number; maxTotal: number; items: BrandScoreItem[] }> {
  // Run heuristic first (instant), then LLM
  const heuristic = heuristicChecks(repo);
  const llm = await llmChecks(repo);

  const items = [...heuristic, ...llm];
  const total = items.reduce((sum, i) => sum + i.score, 0);
  const maxTotal = items.reduce((sum, i) => sum + i.maxScore, 0);

  return { total, maxTotal, items };
}

export async function scoreSpecificity(
  analysis: Analysis,
  positioning: Positioning,
  copy: Copy
): Promise<SpecificityScore> {
  try {
    return await generateStructured({
      schema: SpecificityScoreSchema,
      schemaName: "specificity_score",
      temperature: 0,
      system: `You are a brand quality evaluator. Your job is to detect generic AI slop vs project-specific output.

Score these dimensions:
- onlyWeTest (0-10): Could a competitor swap their logo onto these lines? 0 = any company could use this. 10 = references specific architecture, approach, or tradeoff unique to this product.
- repeatability (0-10): Could someone naturally paraphrase this to a friend? 0 = abstract jargon. 10 = clear, memorable, and specific.
- categoryGeneric: true if the output uses common patterns for the product category without adding anything specific.
- evidence: What specific detail does the output reference? Quote the most project-specific phrase.
- reason: One sentence explaining the score.

Be strict. Most AI-generated brand copy scores 3-5. Only score 8+ if the output references concrete technical decisions, specific problems, or unique approaches.`,
      prompt: `Evaluate the specificity of this generated brand output:

Product: ${analysis.productName}
Archetype: ${analysis.archetype}
Unique approach: ${analysis.uniqueApproach}

Generated one-liner: ${positioning.oneLiner}
Generated tagline: ${positioning.tagline}
Generated hero headline: ${copy.heroHeadline}
Generated hero subheadline: ${copy.heroSubheadline}
Generated positioning: ${positioning.positioningStatement}`,
      maxTokens: 512,
      timeoutMs: 15_000,
    });
  } catch {
    return {
      onlyWeTest: 0,
      repeatability: 0,
      categoryGeneric: true,
      evidence: "Scoring failed",
      reason: "Could not evaluate specificity",
    };
  }
}

export function projectScore(
  currentItems: BrandScoreItem[]
): number {
  // After gesso runs, assume: tagline 10, visual 10, OG tags 10, brand guide 10,
  // banned words stays same, README +10, tone +10, feature naming stays, error voice stays
  let projected = 0;
  for (const item of currentItems) {
    switch (item.name) {
      case "Tagline":
        projected += 10;
        break;
      case "Visual identity":
        projected += 10;
        break;
      case "Meta/OG tags":
        projected += 10;
        break;
      case "Brand guide":
        projected += 10;
        break;
      case "README clarity":
        projected += Math.min(item.score + 10, item.maxScore);
        break;
      case "Tone consistency":
        projected += Math.min(item.score + 10, item.maxScore);
        break;
      default:
        projected += item.score;
    }
  }
  return projected;
}
