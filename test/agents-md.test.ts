import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeAgentsMd, writeClaudeMd } from "../src/output/agents-md.js";
import { readFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const tmpDir = join(process.env.TMPDIR ?? "/tmp", `gesso-test-${Date.now()}`);

beforeEach(async () => {
  await mkdir(tmpDir, { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("writeAgentsMd", () => {
  it("creates AGENTS.md with gesso delimiters when file does not exist", async () => {
    const { path, created } = await writeAgentsMd(tmpDir, "## Brand Voice\nBe direct.");

    expect(created).toBe(true);
    const content = await readFile(path, "utf-8");
    expect(content).toContain("<!-- gesso:brand-start -->");
    expect(content).toContain("## Brand Voice");
    expect(content).toContain("<!-- gesso:brand-end -->");
  });

  it("replaces existing gesso section on second write", async () => {
    await writeAgentsMd(tmpDir, "## First version");
    const { created } = await writeAgentsMd(tmpDir, "## Second version");

    expect(created).toBe(false);
    const content = await readFile(join(tmpDir, "AGENTS.md"), "utf-8");
    expect(content).toContain("## Second version");
    expect(content).not.toContain("## First version");
    // Should only have one pair of delimiters
    const starts = content.split("<!-- gesso:brand-start -->").length - 1;
    expect(starts).toBe(1);
  });
});

describe("writeClaudeMd", () => {
  it("creates CLAUDE.md with gesso delimiters", async () => {
    const { path, created } = await writeClaudeMd(tmpDir, "## Brand\nWrite clearly.");

    expect(created).toBe(true);
    const content = await readFile(path, "utf-8");
    expect(content).toContain("<!-- gesso:brand-start -->");
    expect(content).toContain("## Brand");
    expect(content).toContain("<!-- gesso:brand-end -->");
  });
});
