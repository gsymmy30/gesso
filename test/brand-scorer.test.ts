import { describe, it, expect } from "vitest";
import { projectScore } from "../src/analyze/brand-scorer.js";
import type { BrandScoreItem } from "../src/llm/schemas.js";

describe("projectScore", () => {
  it("projects maximum improvement for missing items", () => {
    const items: BrandScoreItem[] = [
      { name: "Tagline", score: 0, maxScore: 10, reason: "none" },
      { name: "Visual identity", score: 0, maxScore: 10, reason: "none" },
      { name: "Meta/OG tags", score: 0, maxScore: 10, reason: "none" },
      { name: "Brand guide", score: 0, maxScore: 10, reason: "none" },
      { name: "No banned words", score: 10, maxScore: 10, reason: "clean" },
      { name: "README clarity", score: 5, maxScore: 15, reason: "basic" },
      { name: "Tone consistency", score: 3, maxScore: 15, reason: "weak" },
      { name: "Feature naming", score: 7, maxScore: 10, reason: "ok" },
      { name: "Error voice", score: 4, maxScore: 10, reason: "ok" },
    ];

    const projected = projectScore(items);

    // Tagline: 10, Visual: 10, OG: 10, Brand guide: 10
    // Banned words: 10 (stays), README: min(5+10, 15)=15, Tone: min(3+10, 15)=13
    // Feature naming: 7 (stays), Error voice: 4 (stays)
    expect(projected).toBe(10 + 10 + 10 + 10 + 10 + 15 + 13 + 7 + 4);
  });

  it("caps projected scores at maxScore", () => {
    const items: BrandScoreItem[] = [
      { name: "README clarity", score: 12, maxScore: 15, reason: "good" },
      { name: "Tone consistency", score: 14, maxScore: 15, reason: "strong" },
    ];

    const projected = projectScore(items);
    // README: min(12+10, 15) = 15, Tone: min(14+10, 15) = 15
    expect(projected).toBe(30);
  });

  it("returns 0 for empty items", () => {
    expect(projectScore([])).toBe(0);
  });
});
