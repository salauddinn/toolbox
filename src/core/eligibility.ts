import type { Evidence } from "./evidence";

/**
 * Stable reason codes for repository eligibility failures.
 * Shown to the developer; must not be softened to “best effort.”
 */
export type EligibilityReasonCode =
  | "ELIGIBILITY_NOT_PUBLIC_GITHUB"
  | "ELIGIBILITY_INVALID_URL"
  | "ELIGIBILITY_PRIVATE_REPOSITORY"
  | "ELIGIBILITY_MISSING_PACKAGE_JSON"
  | "ELIGIBILITY_UNSUPPORTED_PACKAGE_MANAGER"
  | "ELIGIBILITY_ESM_MODULE"
  | "ELIGIBILITY_MISSING_EXPRESS"
  | "ELIGIBILITY_MISSING_MONGOOSE"
  | "ELIGIBILITY_TYPESCRIPT_SOURCE"
  | "ELIGIBILITY_MONOREPO_OR_MULTI_ROOT"
  | "ELIGIBILITY_MISSING_ENTRY"
  | "ELIGIBILITY_MISSING_ROUTE_EVIDENCE"
  | "ELIGIBILITY_MISSING_MODEL_EVIDENCE"
  | "ELIGIBILITY_TOO_MANY_FILES"
  | "ELIGIBILITY_SOURCE_TOO_LARGE"
  | "ELIGIBILITY_UNSUPPORTED_SYNTAX_PROFILE";

export type EligibilityRejection = {
  code: EligibilityReasonCode;
  message: string;
  evidence: readonly Evidence[];
};

export type EligibilityResult =
  | {
      eligible: true;
      packageManager: "npm";
      /** Deterministic package-manager evidence with lockfile/config content omitted. */
      packageManagerEvidence: readonly Evidence[];
      moduleSystem: "commonjs";
      framework: "express";
      persistence: "mongoose";
      entryPath: string;
    }
  | {
      eligible: false;
      rejections: readonly EligibilityRejection[];
    };
