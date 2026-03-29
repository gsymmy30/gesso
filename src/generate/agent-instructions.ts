import { generateStructured } from "../llm/client.js";
import {
  AgentInstructionsSchema,
  type AgentInstructions,
  type Analysis,
  type Positioning,
  type Voice,
} from "../llm/schemas.js";

export async function generateAgentInstructions(
  analysis: Analysis,
  positioning: Positioning,
  voice: Voice
): Promise<AgentInstructions> {
  return generateStructured({
    schema: AgentInstructionsSchema,
    schemaName: "agent_instructions",
    temperature: 0.2,
    system: `You are an expert at writing AI agent instructions for codebases (AGENTS.md, CLAUDE.md).
These instructions tell AI coding assistants how to write code and copy that matches the project's brand.

Write concise, actionable instructions. Not a brand document — a coding style guide extension.
Include: voice guidelines, naming conventions, error message style, doc tone, banned words.
Use markdown format. Keep each section under 200 words.`,
    prompt: `Generate AI agent brand instructions for:

Product: ${analysis.productName}
Positioning: ${positioning.oneLiner}
Voice tone: ${voice.toneWords.join(", ")}
Voice dos: ${voice.doList.join("; ")}
Voice don'ts: ${voice.dontList.join("; ")}
Personality: ${voice.personality}
Banned words: ${voice.bannedWords.join(", ")}
Example sentences: ${voice.exampleSentences.join(" | ")}
Archetype: ${analysis.archetype}
Primary language: ${analysis.primaryLanguage}

Format the agentsMdSection for AGENTS.md and claudeMdSection for CLAUDE.md.
Wrap each section with <!-- gesso:brand-start --> and <!-- gesso:brand-end --> delimiters.`,
    maxTokens: 2048,
  });
}
