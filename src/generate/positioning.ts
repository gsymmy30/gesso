import { generateStructured } from "../llm/client.js";
import { PositioningSchema, type Positioning, type Analysis } from "../llm/schemas.js";

export async function generatePositioning(
  analysis: Analysis,
  brief?: { audience?: string; problem?: string; differentiator?: string }
): Promise<Positioning> {
  const briefContext = brief
    ? `\nUser-provided context:
- Target audience: ${brief.audience || "(not provided)"}
- Problem solved: ${brief.problem || "(not provided)"}
- Differentiator: ${brief.differentiator || "(not provided)"}`
    : "";

  return generateStructured({
    schema: PositioningSchema,
    schemaName: "positioning",
    temperature: 0.3,
    system: `You are a product positioning expert. Write clear, specific positioning for developer tools.
No buzzwords. No "seamless" or "cutting-edge". Write like a human who actually uses the tool.
The one-liner should be tweetable. The positioning statement should follow: For [audience] who [need], [product] is a [category] that [benefit].`,
    prompt: `Generate positioning for this product:

Product: ${analysis.productName}
Category: ${analysis.productCategory}
Archetype: ${analysis.archetype}
Target audience: ${analysis.targetAudience}
Key features: ${analysis.keyFeatures.join(", ")}
Competitor hints: ${analysis.competitorHints.join(", ")}
Current one-liner: ${analysis.oneLiner}
${briefContext}`,
    maxTokens: 1024,
  });
}
