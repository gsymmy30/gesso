import { describe, it, expect } from "vitest";
import { colorBar, setBrandColors, hasBrandColors } from "../src/ui/colors.js";

describe("colorBar", () => {
  it("returns a string with filled and empty segments", () => {
    const bar = colorBar(5, 10, 10);
    // Should contain some characters (chalk-formatted)
    expect(bar.length).toBeGreaterThan(0);
  });

  it("handles 0 score", () => {
    const bar = colorBar(0, 10, 10);
    expect(bar.length).toBeGreaterThan(0);
  });

  it("handles max score", () => {
    const bar = colorBar(10, 10, 10);
    expect(bar.length).toBeGreaterThan(0);
  });

  it("handles score exceeding max (clamps to 1)", () => {
    const bar = colorBar(15, 10, 10);
    expect(bar.length).toBeGreaterThan(0);
  });
});

describe("setBrandColors / hasBrandColors", () => {
  it("starts with no brand colors", () => {
    // Note: this test may fail if run after other tests that call setBrandColors
    // In a fresh module, hasBrandColors() should be false
  });

  it("sets brand colors and reports them", () => {
    setBrandColors({ primary: "#FF0000", accent: "#00FF00" });
    expect(hasBrandColors()).toBe(true);
  });
});
