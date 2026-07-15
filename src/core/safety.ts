import type { Evidence } from "./evidence";

/**
 * Safety Screening rejects supported risk signals before analysis or AI use.
 * Passing is not malware certification (ADR-0014).
 */
export type SafetyReasonCode =
  | "SAFETY_PATH_TRAVERSAL"
  | "SAFETY_SYMLINK"
  | "SAFETY_BINARY_OR_EXECUTABLE"
  | "SAFETY_SENSITIVE_FILE"
  | "SAFETY_OBFUSCATED_OR_MINIFIED"
  | "SAFETY_DYNAMIC_CODE_EXECUTION"
  | "SAFETY_SUSPICIOUS_LIFECYCLE_SCRIPT"
  | "SAFETY_ARCHIVE_LIMIT"
  | "SAFETY_NORMALIZED_PATH_COLLISION";

export type SafetyRejection = {
  code: SafetyReasonCode;
  message: string;
  evidence: readonly Evidence[];
};

export type SafetyScreeningResult =
  { passed: true } | { passed: false; rejections: readonly SafetyRejection[] };
