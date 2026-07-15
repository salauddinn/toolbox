import { describe, expect, it } from "vitest";
import { loadFixtureSnapshot } from "@/fixtures/load-fixture";
import { ExpressAnalyzer } from "@/server/analysis/express-analyzer";
import { rankDomainCandidates } from "./candidates";
import {
  evaluateAllCandidateReadiness,
  evaluateCandidateReadiness,
  isAssessmentOnly,
} from "./readiness";

describe("ranking and readiness", () => {
  it("ranks Orders among candidates for the controlled example", async () => {
    const snapshot = loadFixtureSnapshot("controlled-example");
    const analysis = await new ExpressAnalyzer().analyze([...snapshot.files.values()]);
    const ranking = rankDomainCandidates(analysis);
    expect(ranking.candidates.length).toBeGreaterThan(0);
    expect(ranking.candidates.length).toBeLessThanOrEqual(3);
    expect(ranking.safestTechnicalCandidateId).toBeTruthy();
    const names = ranking.candidates.map((c) => c.name.toLowerCase());
    expect(names.some((n) => n.includes("order"))).toBe(true);
  });

  it("marks controlled-example Orders ready when harness and ownership hold", async () => {
    const snapshot = loadFixtureSnapshot("controlled-example");
    const files = [...snapshot.files.values()];
    const analysis = await new ExpressAnalyzer().analyze(files);
    const ranking = rankDomainCandidates(analysis);
    const readiness = evaluateAllCandidateReadiness(ranking.candidates, analysis, files);
    expect(isAssessmentOnly(readiness)).toBe(false);

    const orders = ranking.candidates.find((c) => c.id.includes("order") || c.name === "Orders");
    expect(orders).toBeTruthy();
    if (!orders) return;
    const result = evaluateCandidateReadiness(orders, analysis, files);
    expect(result.ready).toBe(true);
  });

  it("assessment-only for no-ready-candidate fixture", async () => {
    const snapshot = loadFixtureSnapshot("no-ready-candidate");
    const files = [...snapshot.files.values()];
    const analysis = await new ExpressAnalyzer().analyze(files);
    const ranking = rankDomainCandidates(analysis);
    const readiness = evaluateAllCandidateReadiness(ranking.candidates, analysis, files);
    expect(isAssessmentOnly(readiness)).toBe(true);
    for (const value of readiness.values()) {
      expect(value.ready).toBe(false);
      if (!value.ready) {
        expect(value.failedRules.some((r) => r.ruleId === "READINESS_EXISTING_TEST_HARNESS")).toBe(
          true,
        );
      }
    }
  });

  it("is reproducible for the same snapshot", async () => {
    const snapshot = loadFixtureSnapshot("controlled-example");
    const files = [...snapshot.files.values()];
    const analyzer = new ExpressAnalyzer();
    const a = await analyzer.analyze(files);
    const b = await analyzer.analyze(files);
    const ra = rankDomainCandidates(a);
    const rb = rankDomainCandidates(b);
    expect(ra.candidates.map((c) => c.id)).toEqual(rb.candidates.map((c) => c.id));
    expect(ra.candidates.map((c) => c.technicalScore)).toEqual(
      rb.candidates.map((c) => c.technicalScore),
    );
  });
});
