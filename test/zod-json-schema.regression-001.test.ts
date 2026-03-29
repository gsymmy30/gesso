import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  AnalysisSchema,
  BrandScoreLLMSchema,
  PositioningSchema,
  VoiceSchema,
  CopySchema,
  VisualSchema,
  SEOSchema,
  AgentInstructionsSchema,
} from "../src/llm/schemas.js";

// Regression: ISSUE-001 — zodToJsonSchema used Zod v3 internals (def.typeName)
// which don't exist in Zod v4 (uses def.type instead). Every schema conversion
// silently returned { type: "string" }, making all LLM calls produce garbage.
// Found by /qa on 2026-03-29
// Report: .gstack/qa-reports/qa-report-gesso-cli-2026-03-29.md

describe("Zod schemas produce valid JSON Schema (Zod v4 regression)", () => {
  const schemas = {
    AnalysisSchema,
    BrandScoreLLMSchema,
    PositioningSchema,
    VoiceSchema,
    CopySchema,
    VisualSchema,
    SEOSchema,
    AgentInstructionsSchema,
  };

  for (const [name, schema] of Object.entries(schemas)) {
    it(`${name} converts to valid JSON Schema with correct type`, () => {
      const jsonSchema = (schema as any).toJSONSchema();

      // Must be an object type at the top level
      expect(jsonSchema.type).toBe("object");
      // Must have properties
      expect(jsonSchema.properties).toBeDefined();
      expect(Object.keys(jsonSchema.properties).length).toBeGreaterThan(0);
      // Must have required array
      expect(Array.isArray(jsonSchema.required)).toBe(true);
    });
  }

  it("preserves number constraints (min/max)", () => {
    const schema = BrandScoreLLMSchema;
    const jsonSchema = (schema as any).toJSONSchema();
    const scoreSchema = jsonSchema.properties.readmePositioning.properties.score;
    expect(scoreSchema.type).toBe("number");
    expect(scoreSchema.minimum).toBe(0);
    expect(scoreSchema.maximum).toBe(15);
  });

  it("preserves string constraints (maxLength)", () => {
    const schema = CopySchema;
    const jsonSchema = (schema as any).toJSONSchema();
    expect(jsonSchema.properties.ogDescription.maxLength).toBe(160);
  });

  it("preserves array constraints (min/max items)", () => {
    const schema = VoiceSchema;
    const jsonSchema = (schema as any).toJSONSchema();
    expect(jsonSchema.properties.toneWords.minItems).toBe(3);
    expect(jsonSchema.properties.toneWords.maxItems).toBe(5);
  });

  it("preserves enum values", () => {
    const schema = AnalysisSchema;
    const jsonSchema = (schema as any).toJSONSchema();
    expect(jsonSchema.properties.archetype.enum).toEqual(
      expect.arrayContaining(["cli-tool", "sdk-library", "api-service"])
    );
  });

  it("preserves literal values", () => {
    const schema = z.object({ version: z.literal(1) });
    const jsonSchema = (schema as any).toJSONSchema();
    expect(jsonSchema.properties.version.const).toBe(1);
  });
});
