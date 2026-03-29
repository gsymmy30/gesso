import { z } from "zod";

// ── Analysis ────────────────────────────────────────────────

export const AnalysisSchema = z.object({
  productName: z.string(),
  oneLiner: z.string(),
  archetype: z.enum([
    "cli-tool",
    "sdk-library",
    "api-service",
    "data-infra",
    "web-app",
    "devtool",
  ]),
  techStack: z.array(z.string()),
  primaryLanguage: z.string(),
  repoSize: z.object({
    files: z.number(),
    linesOfCode: z.number(),
  }),
  existingBrand: z.object({
    hasTagline: z.boolean(),
    hasLogo: z.boolean(),
    hasOgTags: z.boolean(),
    hasBrandGuide: z.boolean(),
    readmeQuality: z.enum(["none", "minimal", "basic", "good", "excellent"]),
  }),
  targetAudience: z.string(),
  productCategory: z.string(),
  keyFeatures: z.array(z.string()),
  competitorHints: z.array(z.string()),

  // Signal enrichment fields (anti-slop)
  uniqueApproach: z.string(),
  architecturePattern: z.enum([
    "monolith",
    "microservice",
    "serverless",
    "library",
    "cli",
    "framework",
    "plugin",
    "monorepo",
  ]),
  maturityStage: z.enum([
    "prototype",
    "alpha",
    "beta",
    "stable",
    "mature",
  ]),
  problemStatement: z.string(),
  competitiveAngle: z.string(),
  writingStyle: z.object({
    tone: z.string(),
    samples: z.array(z.string()).min(1).max(3),
    formality: z.enum(["casual", "conversational", "technical", "formal"]),
  }),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

// ── Brand Score ─────────────────────────────────────────────

export const BrandScoreItemSchema = z.object({
  name: z.string(),
  score: z.number(),
  maxScore: z.number(),
  reason: z.string(),
});

export const BrandScoreLLMSchema = z.object({
  readmePositioning: z.object({
    score: z.number().min(0).max(15),
    reason: z.string(),
  }),
  toneConsistency: z.object({
    score: z.number().min(0).max(15),
    reason: z.string(),
  }),
  featureNaming: z.object({
    score: z.number().min(0).max(10),
    reason: z.string(),
  }),
  errorVoice: z.object({
    score: z.number().min(0).max(10),
    reason: z.string(),
  }),
});

export type BrandScoreItem = z.infer<typeof BrandScoreItemSchema>;
export type BrandScoreLLM = z.infer<typeof BrandScoreLLMSchema>;

export const SpecificityScoreSchema = z.object({
  onlyWeTest: z.number().min(0).max(10),
  repeatability: z.number().min(0).max(10),
  categoryGeneric: z.boolean(),
  evidence: z.string(),
  reason: z.string(),
});

export type SpecificityScore = z.infer<typeof SpecificityScoreSchema>;

// ── Generation outputs ──────────────────────────────────────

export const PositioningSchema = z.object({
  oneLiner: z.string(),
  positioningStatement: z.string(),
  category: z.string(),
  tagline: z.string(),
  elevatorPitch: z.string(),
});

export type Positioning = z.infer<typeof PositioningSchema>;

export const VoiceSchema = z.object({
  toneWords: z.array(z.string()).min(3).max(5),
  doList: z.array(z.string()).min(3).max(6),
  dontList: z.array(z.string()).min(3).max(6),
  exampleSentences: z.array(z.string()).min(2).max(4),
  bannedWords: z.array(z.string()),
  personality: z.string(),
});

export type Voice = z.infer<typeof VoiceSchema>;

export const CopySchema = z.object({
  heroHeadline: z.string(),
  heroSubheadline: z.string(),
  ogDescription: z.string().max(160),
  tweetLaunch: z.string().max(280),
  launchPost: z.string(),
  readmeIntro: z.string(),
});

export type Copy = z.infer<typeof CopySchema>;

export const VisualSchema = z.object({
  palette: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
    text: z.string(),
    muted: z.string(),
  }),
  paletteName: z.string(),
  fontPairing: z.object({
    heading: z.string(),
    body: z.string(),
  }),
  archetype: z.string(),
});

export type Visual = z.infer<typeof VisualSchema>;

export const SEOSchema = z.object({
  keywords: z.array(z.string()).min(5).max(15),
  metaTitle: z.string().max(60),
  metaDescription: z.string().max(160),
  ogTitle: z.string().max(60),
  ogDescription: z.string().max(160),
  structuredData: z.object({
    type: z.string(),
    name: z.string(),
    description: z.string(),
    url: z.string().optional(),
  }),
});

export type SEO = z.infer<typeof SEOSchema>;

export const AgentInstructionsSchema = z.object({
  agentsMdSection: z.string(),
  claudeMdSection: z.string(),
});

export type AgentInstructions = z.infer<typeof AgentInstructionsSchema>;

// ── Brand JSON (canonical output) ───────────────────────────

export const BrandJsonSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  generatedBy: z.string(),
  productName: z.string(),
  archetype: z.string(),
  positioning: PositioningSchema,
  voice: VoiceSchema,
  copy: CopySchema,
  visual: VisualSchema,
  seo: SEOSchema,
  agentInstructions: AgentInstructionsSchema,
  brandScore: z.object({
    before: z.number(),
    after: z.number(),
    breakdown: z.array(BrandScoreItemSchema),
  }),
});

export type BrandJson = z.infer<typeof BrandJsonSchema>;

// ── Brand Tokens ────────────────────────────────────────────

export const BrandTokensSchema = z.object({
  cssCustomProperties: z.record(z.string(), z.string()),
  tailwind: z.object({
    colors: z.record(z.string(), z.string()),
    fontFamily: z.record(z.string(), z.array(z.string())),
  }),
});

export type BrandTokens = z.infer<typeof BrandTokensSchema>;
