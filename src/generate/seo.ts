import { generateStructured } from "../llm/client.js";
import {
  SEOSchema,
  type SEO,
  type Analysis,
  type Positioning,
  type Copy,
} from "../llm/schemas.js";

export async function generateSEO(
  analysis: Analysis,
  positioning: Positioning,
  copy: Copy
): Promise<SEO> {
  return generateStructured({
    schema: SEOSchema,
    schemaName: "seo",
    temperature: 0,
    system: `You are an SEO specialist for developer tools and open-source projects.
Generate search-optimized metadata.

Rules:
- Keywords should be specific, long-tail where useful (e.g. "react state management library" not just "react")
- Meta title: under 60 chars, include product name and primary keyword
- Meta description: under 160 chars, include a call-to-action
- OG title/description: optimized for social sharing (can differ from meta)
- Structured data: use schema.org SoftwareApplication or SoftwareSourceCode as appropriate`,
    prompt: `Generate SEO metadata for:

Product: ${analysis.productName}
One-liner: ${positioning.oneLiner}
Category: ${positioning.category}
Keywords context: ${analysis.keyFeatures.join(", ")}
Target audience: ${analysis.targetAudience}
Tech stack: ${analysis.techStack.join(", ")}
OG description from copy: ${copy.ogDescription}`,
    maxTokens: 1024,
  });
}
