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
Tone words should be specific (not "professional" or "friendly" — those mean nothing).
Do/Don't lists should be actionable for someone writing docs or error messages.
Example sentences should demonstrate the voice in realistic product contexts (error messages, docs, changelogs).
Banned words should include overused tech marketing words that don't fit this brand.`,
    prompt: `Define the brand voice for:

Product: ${analysis.productName}
Positioning: ${positioning.positioningStatement}
Archetype: ${analysis.archetype}
Target audience: ${analysis.targetAudience}
Category: ${positioning.category}`,
    maxTokens: 1024,
  });
}
