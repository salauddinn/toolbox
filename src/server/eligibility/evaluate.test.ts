import { describe, expect, it } from "vitest";
import { loadFixtureSnapshot } from "@/fixtures/load-fixture";
import { evaluateEligibility } from "./evaluate";

describe("evaluateEligibility", () => {
  it("accepts the controlled example", () => {
    const snapshot = loadFixtureSnapshot("controlled-example");
    const result = evaluateEligibility(snapshot);
    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.entryPath).toBe("app.js");
      expect(result.framework).toBe("express");
      expect(result.persistence).toBe("mongoose");
    }
  });

  it("rejects ESM with a stable reason code", () => {
    const snapshot = loadFixtureSnapshot("unsupported-esm");
    const result = evaluateEligibility(snapshot);
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.rejections.map((r) => r.code)).toContain("ELIGIBILITY_ESM_MODULE");
    }
  });

  it("rejects missing mongoose", () => {
    const snapshot = loadFixtureSnapshot("missing-mongoose");
    const result = evaluateEligibility(snapshot);
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.rejections.map((r) => r.code)).toContain("ELIGIBILITY_MISSING_MONGOOSE");
    }
  });

  it("accepts no-ready-candidate for eligibility (readiness is separate)", () => {
    const snapshot = loadFixtureSnapshot("no-ready-candidate");
    const result = evaluateEligibility(snapshot);
    expect(result.eligible).toBe(true);
  });
});
