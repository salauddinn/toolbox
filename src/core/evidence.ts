import type { NormalizedPath } from "./paths";

export type EvidenceSeverity = "info" | "warning" | "critical";

/** Code evidence attached to findings, readiness rules, and eligibility failures. */
export type Evidence = {
  ruleId: string;
  message: string;
  severity: EvidenceSeverity;
  file: NormalizedPath;
  line: number;
  snippet: string;
};

export type FindingRemediationKind = "automatable" | "developer_decision_required";

/**
 * Evidence-backed condition that affects modernization.
 * Detection does not imply remediation.
 */
export type ModernizationFinding = {
  id: string;
  title: string;
  summary: string;
  remediation: FindingRemediationKind;
  evidence: readonly Evidence[];
};
