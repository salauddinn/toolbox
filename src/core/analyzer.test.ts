import { describe, expect, it } from "vitest";
import { loadFixtureSnapshot } from "@/fixtures/load-fixture";
import { ExpressAnalyzer } from "@/server/analysis/express-analyzer";

describe("ExpressAnalyzer", () => {
  it("implements the CodebaseAnalyzer boundary", () => {
    const analyzer = new ExpressAnalyzer();
    expect(analyzer.id).toBe("express-mongoose-commonjs");
  });

  it("supports the controlled example", () => {
    const snapshot = loadFixtureSnapshot("controlled-example");
    const analyzer = new ExpressAnalyzer();
    const eligibility = analyzer.supports([...snapshot.files.values()]);
    expect(eligibility.eligible).toBe(true);
    if (eligibility.eligible) {
      expect(eligibility.entryPath).toBe("app.js");
      expect(eligibility.moduleSystem).toBe("commonjs");
    }
  });

  it("rejects unsupported ESM before analysis", () => {
    const snapshot = loadFixtureSnapshot("unsupported-esm");
    const analyzer = new ExpressAnalyzer();
    const eligibility = analyzer.supports([...snapshot.files.values()]);
    expect(eligibility.eligible).toBe(false);
    if (!eligibility.eligible) {
      expect(eligibility.rejections.some((r) => r.code === "ELIGIBILITY_ESM_MODULE")).toBe(true);
    }
  });
});
