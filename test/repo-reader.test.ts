import { describe, it, expect } from "vitest";
import { resolveRepoUrl } from "../src/analyze/repo-reader.js";

describe("resolveRepoUrl", () => {
  it("resolves owner/repo shorthand to GitHub URL", () => {
    expect(resolveRepoUrl("vercel/next.js")).toBe(
      "https://github.com/vercel/next.js.git"
    );
  });

  it("appends .git to https URLs without it", () => {
    expect(resolveRepoUrl("https://github.com/vercel/next.js")).toBe(
      "https://github.com/vercel/next.js.git"
    );
  });

  it("leaves .git URLs unchanged", () => {
    expect(resolveRepoUrl("https://github.com/vercel/next.js.git")).toBe(
      "https://github.com/vercel/next.js.git"
    );
  });

  it("handles git@ SSH URLs", () => {
    expect(resolveRepoUrl("git@github.com:vercel/next.js")).toBe(
      "git@github.com:vercel/next.js.git"
    );
  });

  it("returns null for invalid input", () => {
    expect(resolveRepoUrl("not a url")).toBeNull();
    expect(resolveRepoUrl("just-a-word")).toBeNull();
    expect(resolveRepoUrl("")).toBeNull();
  });

  it("handles owner/repo with dots and hyphens", () => {
    expect(resolveRepoUrl("my-org/my-repo.js")).toBe(
      "https://github.com/my-org/my-repo.js.git"
    );
  });
});
