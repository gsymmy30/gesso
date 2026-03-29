import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  extractVisualDNA,
  detectMaturitySignals,
  extractVoiceSamples,
  extractExistingDescription,
} from "../src/analyze/repo-reader.js";

const TMP = join(process.env.TMPDIR ?? "/tmp", "gesso-test-signals");

beforeEach(() => {
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("extractVisualDNA", () => {
  it("extracts hex colors from CSS files", async () => {
    writeFileSync(
      join(TMP, "styles.css"),
      `:root {
  --brand-primary: #2563eb;
  --brand-accent: #f59e0b;
  --text: #1a1a1a;
}`
    );

    const result = await extractVisualDNA(TMP, ["styles.css"]);
    expect(result.detectedColors).toContain("#2563eb");
    expect(result.detectedColors).toContain("#f59e0b");
    // #1a1a1a is not in DEFAULT_COLORS so it should appear
    expect(result.detectedColors).toContain("#1a1a1a");
    expect(result.colorSource).toBe("styles.css");
  });

  it("ignores default colors", async () => {
    writeFileSync(
      join(TMP, "theme.css"),
      `body { color: #000000; background: #ffffff; accent: #ff5500; }`
    );

    const result = await extractVisualDNA(TMP, ["theme.css"]);
    expect(result.detectedColors).not.toContain("#000000");
    expect(result.detectedColors).not.toContain("#ffffff");
    expect(result.detectedColors).toContain("#ff5500");
  });

  it("ranks colors by occurrence count", async () => {
    writeFileSync(
      join(TMP, "app.css"),
      `.a { color: #aabbcc; } .b { color: #aabbcc; } .c { color: #ddeeff; }`
    );

    const result = await extractVisualDNA(TMP, ["app.css"]);
    expect(result.detectedColors[0]).toBe("#aabbcc");
  });

  it("returns empty for no CSS files", async () => {
    const result = await extractVisualDNA(TMP, ["index.ts"]);
    expect(result.detectedColors).toEqual([]);
    expect(result.colorSource).toBeNull();
  });

  it("detects logo files", async () => {
    writeFileSync(join(TMP, "logo.svg"), "<svg></svg>");
    const result = await extractVisualDNA(TMP, []);
    expect(result.hasLogo).toBe(true);
  });

  it("detects favicon files", async () => {
    writeFileSync(join(TMP, "favicon.ico"), "");
    const result = await extractVisualDNA(TMP, []);
    expect(result.hasFavicon).toBe(true);
  });

  it("detects logo in public directory", async () => {
    mkdirSync(join(TMP, "public"), { recursive: true });
    writeFileSync(join(TMP, "public/logo.png"), "");
    const result = await extractVisualDNA(TMP, []);
    expect(result.hasLogo).toBe(true);
  });
});

describe("detectMaturitySignals", () => {
  it("detects CI config", () => {
    mkdirSync(join(TMP, ".github/workflows"), { recursive: true });
    const result = detectMaturitySignals(TMP);
    expect(result.hasCI).toBe(true);
  });

  it("detects test directory", () => {
    mkdirSync(join(TMP, "test"), { recursive: true });
    const result = detectMaturitySignals(TMP);
    expect(result.hasTests).toBe(true);
  });

  it("detects CONTRIBUTING.md", () => {
    writeFileSync(join(TMP, "CONTRIBUTING.md"), "# Contributing");
    const result = detectMaturitySignals(TMP);
    expect(result.hasContributing).toBe(true);
  });

  it("extracts version from package.json", () => {
    writeFileSync(
      join(TMP, "package.json"),
      JSON.stringify({ name: "test", version: "1.2.3" })
    );
    const result = detectMaturitySignals(TMP);
    expect(result.version).toBe("1.2.3");
  });

  it("returns defaults for empty directory", () => {
    const result = detectMaturitySignals(TMP);
    expect(result.version).toBe("0.0.0");
    expect(result.hasCI).toBe(false);
    expect(result.hasTests).toBe(false);
    expect(result.hasContributing).toBe(false);
  });
});

describe("extractVoiceSamples", () => {
  it("extracts prose sentences from README", async () => {
    writeFileSync(
      join(TMP, "README.md"),
      `# My Tool

[![Build](https://badge.svg)](https://ci.com)

A fast, lightweight database migration tool for PostgreSQL.

It runs migrations in parallel without locking your tables.

## Install

\`\`\`bash
npm install my-tool
\`\`\`
`
    );

    const samples = await extractVoiceSamples(TMP);
    expect(samples.length).toBeGreaterThanOrEqual(2);
    expect(samples[0]).toContain("fast, lightweight database migration");
    expect(samples[1]).toContain("runs migrations in parallel");
  });

  it("skips headers, badges, and short lines", async () => {
    writeFileSync(
      join(TMP, "README.md"),
      `# Header
![badge](url)
short
This is a real sentence with enough words to qualify.`
    );

    const samples = await extractVoiceSamples(TMP);
    expect(samples).toHaveLength(1);
    expect(samples[0]).toContain("real sentence");
  });

  it("returns empty for missing README", async () => {
    const samples = await extractVoiceSamples(TMP);
    expect(samples).toEqual([]);
  });

  it("caps at 8 samples", async () => {
    const lines = Array.from(
      { length: 20 },
      (_, i) => `This is a sufficiently long sentence number ${i} for testing purposes.`
    );
    writeFileSync(join(TMP, "README.md"), lines.join("\n"));

    const samples = await extractVoiceSamples(TMP);
    expect(samples.length).toBeLessThanOrEqual(8);
  });
});

describe("extractExistingDescription", () => {
  it("extracts description from package.json", async () => {
    writeFileSync(
      join(TMP, "package.json"),
      JSON.stringify({ name: "my-tool", description: "A database migration tool" })
    );

    const desc = await extractExistingDescription(TMP);
    expect(desc).toBe("A database migration tool");
  });

  it("returns null for missing manifest", async () => {
    const desc = await extractExistingDescription(TMP);
    expect(desc).toBeNull();
  });

  it("returns null for empty description", async () => {
    writeFileSync(
      join(TMP, "package.json"),
      JSON.stringify({ name: "my-tool", description: "" })
    );

    const desc = await extractExistingDescription(TMP);
    expect(desc).toBeNull();
  });

  it("extracts from Cargo.toml", async () => {
    writeFileSync(
      join(TMP, "Cargo.toml"),
      `[package]
name = "my-tool"
version = "0.1.0"
description = "A fast CLI for managing secrets"
`
    );

    const desc = await extractExistingDescription(TMP);
    expect(desc).toBe("A fast CLI for managing secrets");
  });
});
