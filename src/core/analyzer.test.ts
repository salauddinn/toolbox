import { describe, expect, it } from "vitest";
import { ExpressAnalyzer } from "./analyzer";

describe("ExpressAnalyzer shell", () => {
  it("implements the CodebaseAnalyzer boundary", () => {
    const analyzer = new ExpressAnalyzer();
    expect(analyzer.id).toBe("express-mongoose-commonjs");
    const eligibility = analyzer.supports([]);
    expect(eligibility.eligible).toBe(false);
  });

  it("does not silently invent analysis results", async () => {
    const analyzer = new ExpressAnalyzer();
    await expect(analyzer.analyze([])).rejects.toThrow(/not implemented/);
  });
});
