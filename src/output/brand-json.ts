import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  BrandJson,
  Analysis,
  Positioning,
  Voice,
  Copy,
  Visual,
  SEO,
  AgentInstructions,
  BrandScoreItem,
} from "../llm/schemas.js";

interface BrandJsonInput {
  analysis: Analysis;
  positioning: Positioning;
  voice: Voice;
  copy: Copy;
  visual: Visual;
  seo: SEO;
  agentInstructions: AgentInstructions;
  brandScore: { before: number; after: number; breakdown: BrandScoreItem[] };
}

export function buildBrandJson(input: BrandJsonInput): BrandJson {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    generatedBy: "gesso-cli",
    productName: input.analysis.productName,
    archetype: input.analysis.archetype,
    positioning: input.positioning,
    voice: input.voice,
    copy: input.copy,
    visual: input.visual,
    seo: input.seo,
    agentInstructions: input.agentInstructions,
    brandScore: input.brandScore,
  };
}

export async function writeBrandJson(
  root: string,
  brandJson: BrandJson
): Promise<string> {
  const filePath = join(root, "brand.json");
  await writeFile(filePath, JSON.stringify(brandJson, null, 2) + "\n", "utf-8");
  return filePath;
}
