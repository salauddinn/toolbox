import { describe, expect, it } from "vitest";
import { buildTransformationReadiness, type ReadinessRuleResult } from "./readiness";
import { assertNormalizedPath } from "./paths";

function pass(ruleId: ReadinessRuleResult["ruleId"]): ReadinessRuleResult {
  return {
    ruleId,
    passed: true,
    summary: "ok",
    evidence: [],
  };
}

function fail(ruleId: ReadinessRuleResult["ruleId"]): ReadinessRuleResult {
  return {
    ruleId,
    passed: false,
    summary: "failed",
    evidence: [
      {
        ruleId,
        message: "blocked",
        severity: "critical",
        file: assertNormalizedPath("routes/orders.js"),
        line: 1,
        snippet: "Order.find()",
      },
    ],
  };
}

describe("buildTransformationReadiness", () => {
  it("marks ready only when every rule passed", () => {
    const readiness = buildTransformationReadiness("orders", [
      pass("READINESS_STABLE_ROUTE_GROUP"),
      pass("READINESS_SINGLE_WRITABLE_PRIMARY_MODEL"),
      pass("READINESS_EXCLUSIVE_WRITE_OWNERSHIP"),
      pass("READINESS_NO_FOREIGN_MODEL_ACCESS"),
      pass("READINESS_EXISTING_TEST_HARNESS"),
      pass("READINESS_STATIC_ROUTES"),
      pass("READINESS_NO_DYNAMIC_LOADING"),
      pass("READINESS_NO_UNSUPPORTED_GLOBAL_WRITES"),
      pass("READINESS_WITHIN_GENERATION_LIMITS"),
      pass("READINESS_SUPPORTED_CYCLES_ONLY"),
      pass("READINESS_NO_UNSUPPORTED_BLOCKER"),
    ]);
    expect(readiness.ready).toBe(true);
    if (readiness.ready) {
      expect(readiness.rules.every((r) => r.passed)).toBe(true);
    }
  });

  it("cannot represent ready with a failed rule", () => {
    const readiness = buildTransformationReadiness("orders", [
      pass("READINESS_STABLE_ROUTE_GROUP"),
      fail("READINESS_EXISTING_TEST_HARNESS"),
    ]);
    expect(readiness.ready).toBe(false);
    if (!readiness.ready) {
      expect(readiness.failedRules).toHaveLength(1);
      expect(readiness.failedRules[0]?.ruleId).toBe("READINESS_EXISTING_TEST_HARNESS");
    }
  });
});
