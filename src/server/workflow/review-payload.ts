import type { FileOperation } from "@/core/changes";
import type { RunState } from "@/core/run-state";
import type { ValidationCheck, ValidationReport } from "@/core/validation";
import { isIgnoredPath } from "@/server/github/ignore";
import { isForbiddenProtectedPath, pathAllowedInEnvelope } from "@/server/validation/envelope";

/** Maximum number of changed paths included in a browser review. */
export const MAX_REVIEW_PATHS = 20;
/** Maximum UTF-8 bytes shown for either side of one changed file. */
export const MAX_REVIEW_PREVIEW_BYTES = 512;
/** Maximum UTF-8 bytes shown in one validation-check detail. */
export const MAX_REVIEW_CHECK_DETAIL_BYTES = 512;
export const MAX_REVIEW_CHECKS = 100;

export type ReviewTruncationLabel =
  | "paths_truncated"
  | "previews_truncated"
  | "validation_checks_truncated"
  | "validation_details_truncated";

export type ClientSafeValidationReport = {
  stageId: string;
  changeSetId: string;
  finalOutcome: ValidationReport["finalOutcome"];
  externalTestsLabel?: "not_executed";
  attempts: readonly {
    attempt: 1 | 2;
    passed: boolean;
    checks: readonly {
      id: string;
      kind: ValidationCheck["kind"];
      title: string;
      outcome: ValidationCheck["outcome"];
      detail?: string;
    }[];
  }[];
};

/**
 * Deliberately bounded review projection. It is derived from the server-held
 * snapshots, never accepted from the browser, and is not a repository export.
 */
export type ReviewPayload = {
  changeSetId: string;
  attempt: 1 | 2;
  totals: { created: number; updated: number; deleted: number };
  files: readonly {
    path: string;
    kind: FileOperation["type"];
    /** Present for create/update operations only. */
    bytes?: number;
    beforePreview?: string;
    afterPreview?: string;
  }[];
  validationReport: ClientSafeValidationReport;
  truncationLabels: readonly ReviewTruncationLabel[];
};

type AwaitingAcceptanceRun = Extract<RunState, { phase: "awaiting_acceptance" }>;

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

/** Redact common credential-bearing syntax before any browser projection. */
function redactSecrets(value: string): string {
  return value
    .replace(
      /\b(api[_-]?key|access[_-]?token|auth(?:orization)?|credential|password|secret|token)\b(\s*[:=]\s*)([^\s,;)}\]\n]+)/gi,
      "$1$2[REDACTED]",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, "$1[REDACTED]@");
}

function prefixWithinBytes(value: string, limit: number): string {
  let result = "";
  let used = 0;
  for (const character of value) {
    const bytes = byteLength(character);
    if (used + bytes > limit) break;
    result += character;
    used += bytes;
  }
  return result;
}

/**
 * A preview always omits at least one code point from a non-empty file. This
 * prevents a small changed file from becoming an accidental full-file body.
 */
function partialPreview(value: string): { text?: string; truncated: boolean } {
  const redacted = redactSecrets(value);
  const characters = [...redacted];
  if (characters.length === 0) return { truncated: false };
  const withoutLastCharacter = characters.slice(0, -1).join("");
  const text = prefixWithinBytes(withoutLastCharacter, MAX_REVIEW_PREVIEW_BYTES);
  return { text: text || undefined, truncated: true };
}

function clientSafeDetail(value: string): { text: string; truncated: boolean } {
  const redacted = redactSecrets(value);
  const text = prefixWithinBytes(redacted, MAX_REVIEW_CHECK_DETAIL_BYTES);
  return { text, truncated: text !== redacted };
}

function isAllowlistedOperation(run: AwaitingAcceptanceRun, operation: FileOperation): boolean {
  return (
    !isIgnoredPath(operation.path) &&
    !isForbiddenProtectedPath(operation.path) &&
    pathAllowedInEnvelope(operation, run.currentStage.pathEnvelope).ok
  );
}

/** A malformed or stale server state must not be rendered as an accept-ready review. */
export function hasCurrentValidatedReview(run: RunState): run is AwaitingAcceptanceRun {
  if (run.phase !== "awaiting_acceptance") return false;
  if (
    run.changeSet.status !== "validated" ||
    run.validationReport.finalOutcome !== "passed" ||
    run.validationReport.changeSetId !== run.changeSet.id ||
    run.validationReport.stageId !== run.changeSet.stageId ||
    !run.validationReport.attempts.some(
      (attempt) => attempt.attempt === run.changeSet.attempt && attempt.passed,
    )
  ) {
    return false;
  }
  return run.changeSet.operations.every((operation) => isAllowlistedOperation(run, operation));
}

function buildSafeValidationReport(
  report: ValidationReport,
  labels: Set<ReviewTruncationLabel>,
): ClientSafeValidationReport {
  let remainingChecks = MAX_REVIEW_CHECKS;
  let checksTruncated = false;
  const attempts = report.attempts.map((attempt) => {
    const checks = attempt.checks.slice(0, remainingChecks).map((check) => {
      if (check.detail === undefined) {
        return { id: check.id, kind: check.kind, title: check.title, outcome: check.outcome };
      }
      const detail = clientSafeDetail(check.detail);
      if (detail.truncated) labels.add("validation_details_truncated");
      return {
        id: check.id,
        kind: check.kind,
        title: check.title,
        outcome: check.outcome,
        detail: detail.text,
      };
    });
    remainingChecks -= checks.length;
    if (checks.length < attempt.checks.length) checksTruncated = true;
    return { attempt: attempt.attempt, passed: attempt.passed, checks };
  });
  if (checksTruncated) labels.add("validation_checks_truncated");
  return {
    stageId: report.stageId,
    changeSetId: report.changeSetId,
    finalOutcome: report.finalOutcome,
    externalTestsLabel: report.externalTestsLabel,
    attempts,
  };
}

/**
 * Build the only review body exposed to a client. Returns null for non-review
 * phases and for stale/invalid state, rather than trying to repair it from a
 * client-supplied body.
 */
export function buildReviewPayload(run: RunState): ReviewPayload | null {
  if (!hasCurrentValidatedReview(run)) return null;

  const labels = new Set<ReviewTruncationLabel>();
  const operations = run.changeSet.operations.slice(0, MAX_REVIEW_PATHS);
  if (operations.length < run.changeSet.operations.length) labels.add("paths_truncated");

  const files = operations.map((operation) => {
    const before = run.snapshot.files.get(operation.path)?.content;
    const after = run.candidateSnapshot.files.get(operation.path)?.content;
    const beforePreview = before === undefined ? undefined : partialPreview(before);
    const afterPreview = after === undefined ? undefined : partialPreview(after);
    if (beforePreview?.truncated || afterPreview?.truncated) labels.add("previews_truncated");
    return {
      path: operation.path,
      kind: operation.type,
      ...(operation.type === "delete" ? {} : { bytes: byteLength(operation.content) }),
      ...(beforePreview?.text === undefined ? {} : { beforePreview: beforePreview.text }),
      ...(afterPreview?.text === undefined ? {} : { afterPreview: afterPreview.text }),
    };
  });

  let created = 0;
  let updated = 0;
  let deleted = 0;
  for (const path of new Set(run.changeSet.operations.map((operation) => operation.path))) {
    const before = run.snapshot.files.get(path);
    const after = run.candidateSnapshot.files.get(path);
    if (!before && after) created += 1;
    else if (before && !after) deleted += 1;
    else if (before && after && before.content !== after.content) updated += 1;
  }

  return {
    changeSetId: run.changeSet.id,
    attempt: run.changeSet.attempt,
    totals: { created, updated, deleted },
    files,
    validationReport: buildSafeValidationReport(run.validationReport, labels),
    truncationLabels: [...labels].sort(),
  };
}
