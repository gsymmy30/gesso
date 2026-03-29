import { generateStructured } from "../llm/client.js";
import { VisualSchema, type Visual, type Analysis, type Positioning } from "../llm/schemas.js";

export async function generateVisual(
  analysis: Analysis,
  positioning: Positioning
): Promise<Visual> {
  return generateStructured({
    schema: VisualSchema,
    schemaName: "visual",
    temperature: 0.3,
    system: `You are a brand designer specializing in developer tools. Generate a visual identity.

Color palette rules:
- primary: the main brand color, used for links, buttons, headings. Should be distinctive.
- secondary: complements primary. Used for hover states, secondary actions.
- accent: a pop color for highlights, badges, success states. High contrast with primary.
- background: page background. Light mode: near-white. Dark mode: near-black.
- text: main text color. Must have 4.5:1+ contrast ratio with background.
- muted: secondary text, borders. Must be readable but clearly subordinate.

All colors must be hex values (#RRGGBB).
Font pairing: choose real, freely available Google Fonts. Heading font should match the brand personality. Body font should be highly readable.
Palette name should be evocative (2-3 words, like "Arctic Depth" or "Sunset Workshop").`,
    prompt: `Generate visual identity for:

Product: ${analysis.productName}
Archetype: ${analysis.archetype}
Category: ${positioning.category}
Target audience: ${analysis.targetAudience}
Positioning: ${positioning.positioningStatement}
Tech stack: ${analysis.techStack.slice(0, 5).join(", ")}`,
    maxTokens: 1024,
  });
}
