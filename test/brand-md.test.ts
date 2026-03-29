import { describe, it, expect } from "vitest";
import { renderBrandMd } from "../src/output/brand-md.js";
import type { BrandJson } from "../src/llm/schemas.js";

const mockBrand: BrandJson = {
  schemaVersion: 1,
  generatedAt: "2026-03-29T00:00:00.000Z",
  generatedBy: "gesso-cli",
  productName: "test-tool",
  archetype: "cli-tool",
  positioning: {
    oneLiner: "Test in one line",
    positioningStatement: "For devs who test",
    category: "testing",
    tagline: "Test better",
    elevatorPitch: "A tool for testing",
  },
  voice: {
    toneWords: ["direct", "clear", "helpful"],
    doList: ["be specific", "use examples"],
    dontList: ["be vague", "use jargon"],
    exampleSentences: ["Run tests fast.", "Check your results."],
    bannedWords: ["synergy", "leverage"],
    personality: "No-nonsense engineer",
  },
  copy: {
    heroHeadline: "Test Better",
    heroSubheadline: "Fast testing for fast teams",
    ogDescription: "A testing tool for developers",
    tweetLaunch: "Launching test-tool",
    launchPost: "We built a thing",
    readmeIntro: "# test-tool\nA test tool.",
  },
  visual: {
    palette: {
      primary: "#5BA4A4",
      secondary: "#3D7A7A",
      accent: "#E8B87D",
      background: "#FFFFFF",
      text: "#1A1A1A",
      muted: "#8B8B8B",
    },
    paletteName: "Teal Workshop",
    fontPairing: { heading: "Space Grotesk", body: "DM Sans" },
    archetype: "cli-tool",
  },
  seo: {
    keywords: ["testing", "cli"],
    metaTitle: "test-tool",
    metaDescription: "A testing tool",
    ogTitle: "test-tool",
    ogDescription: "A testing tool",
    structuredData: {
      type: "SoftwareSourceCode",
      name: "test-tool",
      description: "A testing tool",
    },
  },
  agentInstructions: {
    agentsMdSection: "## Brand",
    claudeMdSection: "## Brand",
  },
  brandScore: { before: 23, after: 78, breakdown: [] },
};

describe("renderBrandMd", () => {
  it("renders markdown with all sections", () => {
    const md = renderBrandMd(mockBrand);

    expect(md).toContain("# test-tool Brand Guide");
    expect(md).toContain("## Positioning");
    expect(md).toContain("Test in one line");
    expect(md).toContain("## Voice & Tone");
    expect(md).toContain("direct, clear, helpful");
    expect(md).toContain("## Copy");
    expect(md).toContain("Test Better");
    expect(md).toContain("## Visual Identity");
    expect(md).toContain("`#5BA4A4`");
    expect(md).toContain("Teal Workshop");
    expect(md).toContain("## SEO");
    expect(md).toContain("testing, cli");
  });

  it("includes font pairing info", () => {
    const md = renderBrandMd(mockBrand);
    expect(md).toContain("Space Grotesk");
    expect(md).toContain("DM Sans");
  });

  it("includes voice do/dont lists", () => {
    const md = renderBrandMd(mockBrand);
    expect(md).toContain("- be specific");
    expect(md).toContain("- be vague");
  });

  it("includes banned words", () => {
    const md = renderBrandMd(mockBrand);
    expect(md).toContain("synergy, leverage");
  });
});
