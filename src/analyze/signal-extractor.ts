import { generateStructured } from "../llm/client.js";
import { AnalysisSchema, type Analysis } from "../llm/schemas.js";
import type { RepoInfo } from "./repo-reader.js";

export async function analyzeRepo(
  repo: RepoInfo,
  userBrief?: { audience?: string; problem?: string; differentiator?: string }
): Promise<Analysis> {
  const fileContext = repo.files
    .map((f) => `--- ${f.path} (${f.lines} lines) ---\n${f.content}`)
    .join("\n\n");

  const briefContext = userBrief
    ? `\nUser-provided context:
- Target audience: ${userBrief.audience || "(not provided)"}
- Problem solved: ${userBrief.problem || "(not provided)"}
- Differentiator: ${userBrief.differentiator || "(not provided)"}`
    : "";

  const maturityContext = `
Maturity signals (filesystem-detected):
- Version: ${repo.maturitySignals.version}
- Has CI: ${repo.maturitySignals.hasCI}
- Has tests: ${repo.maturitySignals.hasTests}
- Has CONTRIBUTING.md: ${repo.maturitySignals.hasContributing}`;

  const voiceSamplesContext = repo.candidateVoiceSamples.length > 0
    ? `\nVoice samples from README (select 1-3 that best represent the project's tone):
${repo.candidateVoiceSamples.map((s, i) => `${i + 1}. "${s}"`).join("\n")}`
    : "\nNo README prose found. For writingStyle.samples, describe what tone the code comments suggest.";

  return generateStructured({
    schema: AnalysisSchema,
    schemaName: "analysis",
    temperature: 0,
    system: `You are a product analyst specializing in developer tools and open-source projects.
Analyze the provided codebase files and extract structured information about the product.

Be specific and concrete. Base your analysis on actual code and documentation signals, not assumptions.
For the one-liner, write a clear, specific description of what this product does. Avoid buzzwords.
For the archetype, pick the closest match based on the actual product function.
For target audience, be specific (e.g., "frontend developers building React apps" not "developers").

ANTI-SLOP RULES — these fields must be project-specific, not category-generic:
- uniqueApproach: What does THIS project do differently at the CODE level? Reference actual patterns, libraries, or architectural decisions you see in the files. "Uses X instead of Y" or "Takes approach Z which is unusual because..." Do NOT write generic descriptions like "provides a simple interface."
- problemStatement: What specific pain does this solve? Extract from README or infer from the code's structure. "Database migrations break silently in CI" not "helps with databases."
- competitiveAngle: What makes this different from alternatives? Reference concrete technical choices. "Zero dependencies" or "Uses SQLite instead of Redis" or "Single-binary deployment." NOT "better developer experience."
- writingStyle: Detect the actual tone from the README and code comments. Select samples from the candidates provided. If the README is terse and technical, say so. If it's warm and tutorial-like, say so. Match reality, don't invent.`,
    prompt: `Analyze this repository and extract product signals.
${briefContext}
${maturityContext}
${voiceSamplesContext}

Repository contents (${repo.files.length} files sampled):

${fileContext}`,
    maxTokens: 4096,
  });
}
