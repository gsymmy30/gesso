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
    system: `You are a product positioning expert who has studied April Dunford's positioning framework and Anthony Pierri's homepage messaging work.

POSITIONING RULES:
- Positioning is the foundation. Every word must pass the "only we" test: could a competitor swap their logo onto this line? If yes, keep going.
- Write from the customer's outcome, not the internal mechanism. "AI-native orchestration for distributed workflows" is worse than "Automate the messy work between tools."
- Be specific enough to feel real. Anchor to: what it helps you do, who it is for, what pain it removes, or what makes it different.

ONE-LINER:
- Must make someone understand the category, value, or feeling in a few seconds.
- Should pass the "user repeats it" test: easy to paraphrase to someone else.
- Use one of these proven shapes if they fit naturally:
  "Do X, without Y" / "The fastest way to X" / "X for Y" / "Turn X into Y" / "Finally, a better way to X"
- Lean into one winning angle: speed, simplicity, control, leverage, or transformation.

TAGLINE:
- Taglines are for intrigue and positioning, not full explanation. Let the one-liner do the heavier lift.
- For early-stage/unknown products: be more literal, nobody knows you yet.
- Pick one tone and commit. Don't mix enterprise seriousness with Twitter cleverness.

BANNED WORDS: seamless, unlock, reimagine, empower, next-generation, cutting-edge, revolutionize, robust, delve, leverage (as a verb), supercharge, turbocharge, game-changing, disruptive, innovative, scalable (unless literally about infrastructure).
These signal "generic B2B tech company." If the line sounds like it could be on any startup's landing page, rewrite it.

POSITIONING STATEMENT: Follow the format: "For [specific audience] who [specific pain], [product] is a [concrete category] that [specific benefit] unlike [alternative/status quo]."

Process: write the raw truth in one sentence. Strip jargon. Make it shorter. Add sharpness, not complexity.`,
    prompt: `Generate positioning for this product:

Product: ${analysis.productName}
Category: ${analysis.productCategory}
Archetype: ${analysis.archetype}
Target audience: ${analysis.targetAudience}
Key features: ${analysis.keyFeatures.join(", ")}
Competitor hints: ${analysis.competitorHints.join(", ")}
Current one-liner: ${analysis.oneLiner}

Unique approach (from code analysis): ${analysis.uniqueApproach}
Competitive angle: ${analysis.competitiveAngle}
Core problem: ${analysis.problemStatement}
Architecture: ${analysis.architecturePattern}
Maturity: ${analysis.maturityStage}

Use these specific details from the codebase to make positioning concrete and project-specific. Do not write generic category-level descriptions.
${briefContext}`,
    maxTokens: 1024,
  });
}
