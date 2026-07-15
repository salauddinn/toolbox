/**
 * Validation Report records checks actually performed (ADR-0005).
 * Static Validation examines artifacts without executing application code.
 * Runtime Validation is limited to the controlled bundled example.
 */

export type ValidationCheckKind = "static" | "runtime";

export type ValidationCheckOutcome = "passed" | "failed" | "skipped" | "not_executed";

export type ValidationCheck = {
  id: string;
  kind: ValidationCheckKind;
  title: string;
  outcome: ValidationCheckOutcome;
  detail?: string;
};

export type ValidationAttempt = {
  attempt: 1 | 2;
  checks: readonly ValidationCheck[];
  passed: boolean;
  /** Structured errors sent to a single repair call when attempt 1 fails. */
  structuredErrors?: readonly string[];
};

export type ValidationReport = {
  stageId: string;
  changeSetId: string;
  attempts: readonly ValidationAttempt[];
  finalOutcome: "passed" | "failed_rolled_back" | "failed_awaiting_repair";
  /** Explicit note for external generated tests. */
  externalTestsLabel?: "not_executed";
};
