import { describe, it, expect } from "vitest";
import { SEOSchema, AnalysisSchema } from "../src/llm/schemas.js";

describe("OpenAI strict mode compatibility", () => {
  it("SEO schema handles optional url field", () => {
    const jsonSchema = (SEOSchema as any).toJSONSchema();
    delete jsonSchema.$schema;
    const sd = jsonSchema.properties.structuredData;

    // Optional fields in strict mode: either not in required,
    // or present with a compatible type
    expect(sd.type).toBe("object");
    expect(sd.properties.url).toBeDefined();
  });

  it("Analysis schema has additionalProperties: false at all levels", () => {
    const jsonSchema = (AnalysisSchema as any).toJSONSchema();
    delete jsonSchema.$schema;

    // Top level
    expect(jsonSchema.additionalProperties).toBe(false);
    // Nested objects
    expect(jsonSchema.properties.repoSize.additionalProperties).toBe(false);
    expect(jsonSchema.properties.existingBrand.additionalProperties).toBe(false);
  });
});
