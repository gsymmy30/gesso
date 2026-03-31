import { generateStructured } from "../llm/client.js";
import { VisualSchema, type Visual, type Analysis, type Positioning } from "../llm/schemas.js";
import type { ExistingVisuals } from "../analyze/repo-reader.js";
import { loadArchetype } from "../templates/archetypes/index.js";

export async function generateVisual(
  analysis: Analysis,
  positioning: Positioning,
  existingVisuals?: ExistingVisuals
): Promise<Visual> {
  const archetype = loadArchetype(analysis.archetype);

  // Build archetype context for the LLM
  let archetypeContext = "";
  if (archetype) {
    const paletteSummary = archetype.palettes
      .map((p, i) => `  ${i + 1}. "${p.name}" — primary: ${p.primary}, accent: ${p.accent}`)
      .join("\n");
    const fontSummary = archetype.fontPairings
      .map((f, i) => `  ${i + 1}. ${f.heading} / ${f.body}`)
      .join("\n");
    archetypeContext = `
Curated options for "${analysis.archetype}" archetype:

Palettes (use as starting points — adapt, don't copy verbatim):
${paletteSummary}

Font pairings (choose one or derive from these):
${fontSummary}

You may use one of these palettes directly if it fits, modify colors to better match the product, or create a new palette inspired by the archetype's direction. The font pairings are tested combinations — prefer them unless the product's personality demands something different.`;
  }

  return generateStructured({
    schema: VisualSchema,
    schemaName: "visual",
    temperature: 0.3,
    system: `You are a brand designer specializing in developer tools and SaaS products. Generate a visual identity grounded in real industry patterns.

Research context (analysis of 128 SaaS/tech logos):
- 93% of tech companies use sans-serif typography
- 51% use monochrome/black logos. Among colored: blue (18%), orange (10%), green (8%)
- Tech logos favor minimal color and clean geometry vs consumer brands
- 42% lowercase wordmarks, 48% title case, only 10% all-caps
- Two-word names always written as one word (e.g., "NetSpring" not "Net Spring")

Use these patterns as a baseline, not a cage. Break the pattern only when the product's personality genuinely calls for it (e.g., a creative tool might warrant warmer colors or a display font).

Color palette rules:
- primary: the main brand color for links, buttons, headings. Should be distinctive but not garish. Consider whether monochrome (black/dark gray) fits the product's seriousness.
- secondary: complements primary. Used for hover states, secondary actions.
- accent: a pop color for highlights, badges, success states. High contrast with primary.
- background: page background. Light mode: near-white. Dark mode: near-black.
- text: main text color. Must have 4.5:1+ contrast ratio with background.
- muted: secondary text, borders. Must be readable but clearly subordinate.

All colors must be hex values (#RRGGBB).
Font pairing: choose from these bundled fonts ONLY: Space Grotesk, Inter, JetBrains Mono, IBM Plex Sans, DM Sans. These are the fonts available for logo rendering — picking anything else will cause a fallback to system fonts.
Palette name should be evocative (2-3 words, like "Arctic Depth" or "Sunset Workshop").${archetypeContext}`,
    prompt: `Generate visual identity for:

Product: ${analysis.productName}
Archetype: ${analysis.archetype}
Category: ${positioning.category}
Target audience: ${analysis.targetAudience}
Positioning: ${positioning.positioningStatement}
Tech stack: ${analysis.techStack.slice(0, 5).join(", ")}
${existingVisuals && existingVisuals.detectedColors.length > 0
  ? `\nExisting brand colors detected in codebase (from ${existingVisuals.colorSource}): ${existingVisuals.detectedColors.join(", ")}
Build a palette that harmonizes with these existing colors. Use them as a starting point, not a constraint.`
  : ""}
${existingVisuals?.hasLogo ? "\nNote: Project already has a logo file. The palette should complement existing brand assets." : ""}`,
    maxTokens: 1024,
  });
}
