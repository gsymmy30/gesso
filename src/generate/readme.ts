import { generateStructured } from "../llm/client.js";
import {
  ReadmeSchema,
  type ReadmeOutput,
  type Analysis,
  type Positioning,
  type Voice,
  type Copy,
  type Visual,
  type SEO,
} from "../llm/schemas.js";

interface ReadmeOptions {
  analysis: Analysis;
  positioning: Positioning;
  voice: Voice;
  copy: Copy;
  visual: Visual;
  seo: SEO;
  existingReadme: string | null;
  repoUrl: string | null;
  hasLogo: boolean;
}

export async function generateReadme(opts: ReadmeOptions): Promise<string> {
  const {
    analysis,
    positioning,
    voice,
    copy,
    visual,
    seo,
    existingReadme,
    repoUrl,
    hasLogo,
  } = opts;

  const mode = existingReadme ? "update" : "create";

  const result = await generateStructured({
    schema: ReadmeSchema,
    schemaName: "readme",
    temperature: 0.4,
    system: `You are a technical writer who creates excellent open-source README files. You write for developers — clear, scannable, no fluff.

VOICE (follow strictly):
- Tone: ${voice.toneWords.join(", ")}
- Do: ${voice.doList.join("; ")}
- Don't: ${voice.dontList.join("; ")}
- Banned words: ${voice.bannedWords.join(", ")}

README STRUCTURE (in this order):
1. Logo image (if available): \`<p align="center"><img src=".gesso/logo.svg" alt="${analysis.productName}" width="280"></p>\`
2. Product name as H1 with tagline beneath
3. Badges row (placeholder format — user fills in URLs later): build status, npm/crate version, license
4. One-liner description (1 sentence, what it does)
5. "Why" section — the pain this solves, 2-3 sentences max
6. Quick demo or screenshot placeholder if relevant
7. Install section with actual install command based on the tech stack
8. Quick start / usage section with a realistic code example or CLI command
9. Features list — bullet points, each feature in bold with 1-line explanation
10. Configuration section if the tool has config options
11. How it works — 2-3 sentences on the technical approach, link to docs if they exist
12. Contributing section (brief, link to CONTRIBUTING.md if it exists)
13. License line

RULES:
- ${mode === "update" ? "You are UPDATING an existing README. Preserve any sections the user clearly wrote themselves (custom examples, detailed API docs, migration guides). Improve structure, add missing sections, sharpen the intro. Do NOT delete content that has no equivalent in the generated version." : "You are creating a README from scratch."}
- Use real install commands for the detected tech stack (npm, cargo, pip, go get, etc.)
- Code blocks must have language tags (\`\`\`bash, \`\`\`ts, etc.)
- Keep it under 200 lines. Longer READMEs get skimmed, not read.
- No marketing language. No "powerful", "elegant", "blazing fast" unless it's literally about benchmarks.
- The README should make someone understand what this is and get started in under 60 seconds.
- Include the logo image tag ONLY if hasLogo is true.
- Do NOT wrap the entire output in markdown code fences. Return raw markdown.`,
    prompt: `${mode === "update" ? "Update this" : "Create a"} README for:

Product: ${analysis.productName}
Type: ${analysis.archetype}
Tech stack: ${analysis.techStack.join(", ")}
Primary language: ${analysis.primaryLanguage}
Key features: ${analysis.keyFeatures.join(", ")}
Target audience: ${analysis.targetAudience}
Category: ${analysis.productCategory}

Positioning: ${positioning.oneLiner}
Tagline: ${positioning.tagline}
Elevator pitch: ${positioning.elevatorPitch}
Problem: ${analysis.problemStatement}
Unique approach: ${analysis.uniqueApproach}
Competitive angle: ${analysis.competitiveAngle}

Hero headline: ${copy.heroHeadline}
Hero subheadline: ${copy.heroSubheadline}
README intro (generated copy): ${copy.readmeIntro}

SEO keywords: ${seo.keywords.join(", ")}
Repo URL: ${repoUrl ?? "unknown"}
Has logo: ${hasLogo}
License: MIT

${existingReadme ? `EXISTING README TO IMPROVE:\n---\n${existingReadme.slice(0, 8000)}\n---` : "No existing README."}`,
    maxTokens: 4096,
    timeoutMs: 30_000,
  });

  return result.content;
}
