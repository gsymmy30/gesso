import { describe, it, expect } from "vitest";
import { buildBrandJson } from "../src/output/brand-json.js";

describe("buildBrandJson", () => {
  it("builds a valid brand.json structure with schemaVersion 1", () => {
    const result = buildBrandJson({
      analysis: {
        productName: "test-tool",
        oneLiner: "A test tool",
        archetype: "cli-tool",
        techStack: ["TypeScript"],
        primaryLanguage: "TypeScript",
        repoSize: { files: 10, linesOfCode: 500 },
        existingBrand: {
          hasTagline: false,
          hasLogo: false,
          hasOgTags: false,
          hasBrandGuide: false,
          readmeQuality: "basic",
        },
        targetAudience: "developers",
        productCategory: "developer tools",
        keyFeatures: ["fast"],
        competitorHints: [],
      },
      positioning: {
        oneLiner: "Test in one line",
        positioningStatement: "For devs who test",
        category: "testing",
        tagline: "Test better",
        elevatorPitch: "A tool for testing",
      },
      voice: {
        toneWords: ["direct", "clear", "helpful"],
        doList: ["be specific"],
        dontList: ["be vague"],
        exampleSentences: ["Run tests fast."],
        bannedWords: ["synergy"],
        personality: "No-nonsense engineer",
      },
      copy: {
        heroHeadline: "Test Better",
        heroSubheadline: "Fast testing for fast teams",
        ogDescription: "A testing tool",
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
        agentsMdSection: "## Brand\nBe direct.",
        claudeMdSection: "## Brand\nBe direct.",
      },
      brandScore: {
        before: 23,
        after: 78,
        breakdown: [],
      },
    });

    expect(result.schemaVersion).toBe(1);
    expect(result.productName).toBe("test-tool");
    expect(result.generatedBy).toBe("gesso-cli");
    expect(result.generatedAt).toBeTruthy();
    expect(result.positioning.oneLiner).toBe("Test in one line");
    expect(result.visual.palette.primary).toBe("#5BA4A4");
    expect(result.brandScore.before).toBe(23);
    expect(result.brandScore.after).toBe(78);
  });
});
