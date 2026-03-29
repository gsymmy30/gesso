import { describe, it, expect } from "vitest";
import { initLLM, getProvider } from "../src/llm/client.js";

describe("initLLM", () => {
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
  const originalOpenaiKey = process.env.OPENAI_API_KEY;

  it("throws when no API key is set", () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;

    expect(() => initLLM()).toThrow("Set ANTHROPIC_API_KEY or OPENAI_API_KEY");

    // Restore
    if (originalAnthropicKey) process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
    if (originalOpenaiKey) process.env.OPENAI_API_KEY = originalOpenaiKey;
  });

  it("prefers Anthropic when both keys are set", () => {
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.OPENAI_API_KEY = "test-openai-key";

    const provider = initLLM();
    expect(provider).toBe("anthropic");

    // Restore
    if (originalAnthropicKey) {
      process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
    if (originalOpenaiKey) {
      process.env.OPENAI_API_KEY = originalOpenaiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  it("falls back to OpenAI when only OpenAI key is set", () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = "test-openai-key";

    const provider = initLLM();
    expect(provider).toBe("openai");

    // Restore
    if (originalAnthropicKey) process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
    if (originalOpenaiKey) {
      process.env.OPENAI_API_KEY = originalOpenaiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });
});
