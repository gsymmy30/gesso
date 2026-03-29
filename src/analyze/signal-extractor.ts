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

  return generateStructured({
    schema: AnalysisSchema,
    schemaName: "analysis",
    temperature: 0,
    system: `You are a product analyst specializing in developer tools and open-source projects.
Analyze the provided codebase files and extract structured information about the product.

Be specific and concrete. Base your analysis on actual code and documentation signals, not assumptions.
For the one-liner, write a clear, specific description of what this product does. Avoid buzzwords.
For the archetype, pick the closest match based on the actual product function.
For target audience, be specific (e.g., "frontend developers building React apps" not "developers").`,
    prompt: `Analyze this repository and extract product signals.
${briefContext}

Repository contents (${repo.files.length} files sampled):

${fileContext}`,
    maxTokens: 2048,
  });
}
