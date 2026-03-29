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
    system: `You are a developer marketing copywriter who writes like a builder, not a marketer. Your copy should sound like it was written by someone who actually uses the product.

VOICE GUIDELINES (follow strictly):
- Tone: ${voice.toneWords.join(", ")}
- Do: ${voice.doList.join("; ")}
- Don't: ${voice.dontList.join("; ")}
- Personality: ${voice.personality}

COPYWRITING PRINCIPLES:
- Clarity over cleverness. If it sounds smart but could apply to 50 companies, it is weak.
- Write from the customer's outcome, not your internal mechanism.
- The best homepage pairing: headline (sharp positioning) + subhead (concrete explanation).
- Use the "user repeats it" test: if someone can't naturally paraphrase it to a friend, it's too abstract.

HERO HEADLINE (3-8 words):
- This is the sharpest expression of your positioning. One idea, one line.
- Lean into one angle: speed, simplicity, control, leverage, or transformation.
- Good shapes: "Do X, without Y" / "The fastest way to X" / "X for Y" / "Turn X into Y"
- Example pairs (structure, not content): "Cut cloud waste automatically" + "AI agents find idle resources and ship savings without manual audits."

HERO SUBHEADLINE:
- The concrete explanation the headline earns. What it does, how, for whom.
- One sentence, not a paragraph.

BANNED WORDS: seamless, unlock, reimagine, empower, next-generation, cutting-edge, revolutionize, robust, delve, leverage, supercharge, turbocharge, game-changing, disruptive, innovative. These signal generic B2B. Rewrite if any appear.

OG DESCRIPTION: Under 160 characters. Literal and useful, not clever. Someone sees this in a link preview and decides whether to click.

TWEET (under 280 chars): Write like a real person announcing something they built. No hashtag spam. No "excited to announce." Say what it does and why it matters.

README INTRO: 2-3 paragraphs of markdown. Technical audience. Start with what it does in one sentence. Then why it exists (the pain). Then how it works at a high level. No sales language.

LAUNCH POST: Suitable for Hacker News or dev Reddit. Technical, specific, honest about tradeoffs. Explain what you built, why, and what's interesting about the approach. HN readers smell marketing from miles away.`,
    prompt: `Write copy for:

Product: ${analysis.productName}
One-liner: ${positioning.oneLiner}
Positioning: ${positioning.positioningStatement}
Tagline: ${positioning.tagline}
Key features: ${analysis.keyFeatures.join(", ")}
Target audience: ${analysis.targetAudience}

Core problem this solves: ${analysis.problemStatement}
Unique approach (from code): ${analysis.uniqueApproach}
Competitive angle: ${analysis.competitiveAngle}

Voice samples from their docs:
${analysis.writingStyle.samples.map((s) => `- "${s}"`).join("\n")}

Reference the specific technical approach and problem statement in the copy. The hero headline should be about THIS product's unique angle, not a generic category claim.`,
    maxTokens: 2048,
  });
}
