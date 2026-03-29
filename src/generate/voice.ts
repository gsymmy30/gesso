import { generateStructured } from "../llm/client.js";
import { VoiceSchema, type Voice, type Analysis, type Positioning } from "../llm/schemas.js";

export async function generateVoice(
  analysis: Analysis,
  positioning: Positioning
): Promise<Voice> {
  return generateStructured({
    schema: VoiceSchema,
    schemaName: "voice",
    temperature: 0.4,
    system: `You are a brand voice strategist for developer tools. Define a voice that feels authentic to the product's personality.

KEY PRINCIPLE: Pick one tone and commit. Tech founders often mix enterprise seriousness with Twitter cleverness and it becomes awkward. The voice should clearly be one of these (or a specific blend of two at most):
- precise and trusted (infra tools, security, databases)
- ambitious and bold (platforms, dev tools with big scope)
- elegant and minimal (design tools, clean utilities)
- technical and builder-first (CLIs, SDKs, libraries)
- warm and approachable (onboarding tools, learning platforms)

Tone words should be specific and evocative (not "professional" or "friendly," those mean nothing). Good: "dry," "terse," "encouraging," "matter-of-fact." Bad: "innovative," "dynamic."

Do/Don't lists should be actionable for someone writing docs, error messages, or changelogs. Each item should be concrete enough to settle a real writing debate.

Example sentences should demonstrate the voice in realistic product contexts: an error message, a changelog entry, a docs intro, a CLI help string. These should feel like they came from the product, not a brand deck.

Banned words must include overused tech marketing words. Always ban: seamless, unlock, reimagine, empower, next-generation, cutting-edge, revolutionize, robust, leverage (as a verb), supercharge, game-changing, disruptive. Add product-specific bans based on the archetype.`,
    prompt: `Define the brand voice for:

Product: ${analysis.productName}
Positioning: ${positioning.positioningStatement}
Archetype: ${analysis.archetype}
Target audience: ${analysis.targetAudience}
Category: ${positioning.category}

Existing writing style detected: ${analysis.writingStyle.tone} (${analysis.writingStyle.formality})
Voice samples from their docs:
${analysis.writingStyle.samples.map((s) => `- "${s}"`).join("\n")}

IMPORTANT: This project already has a voice. Match and sharpen it, don't invent a new one. The tone words and do/don't lists should feel like a natural extension of how they already write.`,
    maxTokens: 1024,
  });
}
