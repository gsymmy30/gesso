import { generateStructured } from "../llm/client.js";
import {
  CopySchema,
  type Copy,
  type Analysis,
  type Positioning,
  type Voice,
} from "../llm/schemas.js";

export async function generateCopy(
  analysis: Analysis,
  positioning: Positioning,
  voice: Voice
): Promise<Copy> {
  return generateStructured({
    schema: CopySchema,
    schemaName: "copy",
    temperature: 0.5,
    system: `You are a developer marketing copywriter. Write copy that sounds like the product's voice.
Follow these voice guidelines strictly:
- Tone: ${voice.toneWords.join(", ")}
- Do: ${voice.doList.join("; ")}
- Don't: ${voice.dontList.join("; ")}
- Personality: ${voice.personality}

The hero headline should be 3-8 words. The OG description must be under 160 characters.
The tweet must be under 280 characters. The README intro should be 2-3 paragraphs of markdown.
The launch post should be suitable for Hacker News or Reddit (technical, not salesy).`,
    prompt: `Write copy for:

Product: ${analysis.productName}
One-liner: ${positioning.oneLiner}
Positioning: ${positioning.positioningStatement}
Tagline: ${positioning.tagline}
Key features: ${analysis.keyFeatures.join(", ")}
Target audience: ${analysis.targetAudience}`,
    maxTokens: 2048,
  });
}
