import type { Evidence } from "./evidence";

/**
 * Deterministic Transformation Readiness rules (ADR-0010).
 * Separate from repository eligibility (ADR-0009).
 * AI cannot waive a failed rule.
 */
export type ReadinessRuleId =
  | "READINESS_STABLE_ROUTE_GROUP"
  | "READINESS_SINGLE_WRITABLE_PRIMARY_MODEL"
  | "READINESS_EXCLUSIVE_WRITE_OWNERSHIP"
  | "READINESS_NO_FOREIGN_MODEL_ACCESS"
  | "READINESS_EXISTING_TEST_HARNESS"
  | "READINESS_STATIC_ROUTES"
  | "READINESS_NO_DYNAMIC_LOADING"
  | "READINESS_NO_UNSUPPORTED_GLOBAL_WRITES"
  | "READINESS_WITHIN_GENERATION_LIMITS"
  | "READINESS_SUPPORTED_CYCLES_ONLY"
  | "READINESS_NO_UNSUPPORTED_BLOCKER";

export type ReadinessRuleResult = {
  ruleId: ReadinessRuleId;
  passed: boolean;
  evidence: readonly Evidence[];
  summary: string;
};

type ReadinessBase = {
  candidateId: string;
  rules: readonly ReadinessRuleResult[];
};

/**
 * Ready only when every rule passed.
 * The ready branch cannot carry failed rules.
 */
export type TransformationReadiness =
  | (ReadinessBase & {
      ready: true;
      rules: readonly (ReadinessRuleResult & { passed: true })[];
    })
  | (ReadinessBase & {
      ready: false;
      failedRules: readonly ReadinessRuleResult[];
    });

/**
 * Build readiness from evaluated rules.
 * Enforces the invariant: ready ⇔ all rules passed.
 */
export function buildTransformationReadiness(
  candidateId: string,
  rules: readonly ReadinessRuleResult[],
): TransformationReadiness {
  const failedRules = rules.filter((rule) => !rule.passed);
  if (failedRules.length === 0) {
    return {
      ready: true,
      candidateId,
      rules: rules as readonly (ReadinessRuleResult & { passed: true })[],
    };
  }
  return {
    ready: false,
    candidateId,
    rules,
    failedRules,
  };
}

export function isCandidateReady(readiness: TransformationReadiness): boolean {
  return readiness.ready;
}
