"use client";

import { useId } from "react";
import type { Presentation } from "./presentation-state";

/** Client-safe Validation Report fields already projected on terminal sequence phases. */
export type OutcomeValidationAttempt = {
  attempt: number;
  passed: boolean;
  checks?: readonly {
    id?: string;
    kind?: string;
    title?: string;
    outcome?: string;
  }[];
};

export type OutcomeValidationReport = {
  stageId: string;
  changeSetId: string;
  finalOutcome: string;
  externalTestsLabel?: string | null;
  attempts?: readonly OutcomeValidationAttempt[];
};

export type SequenceStopReason =
  "developer_rejected" | "validation_rollback" | "manual_stop" | string;

export type SequenceOutcomeKind = "stage_failed_rolled_back" | "sequence_stopped";

export type SequenceOutcomeProps = {
  kind: SequenceOutcomeKind;
  presentation: Presentation;
  sourceLabel?: string;
  selectedCandidateName?: string;
  currentStageTitle?: string;
  acceptedChangeSetCount: number;
  /** Present on rolled-back stages and some stop reasons. */
  validationReport?: OutcomeValidationReport | null;
  /** Required for sequence_stopped; ignored for rollback. */
  stopReason?: SequenceStopReason;
  busy?: boolean;
  confirmingEnd: boolean;
  onConfirmingEndChange: (value: boolean) => void;
  onEndRun: () => void;
  /** When end/delete failed, keep the outcome visible and offer retry. */
  endError?: string | null;
};

function stopReasonCopy(reason: SequenceStopReason | undefined): {
  label: string;
  explanation: string;
} {
  switch (reason) {
    case "developer_rejected":
      return {
        label: "Developer rejected the Change Set",
        explanation:
          "You chose Reject and stop. The unaccepted candidate snapshot was discarded. Previously accepted Change Sets remain in the current snapshot.",
      };
    case "validation_rollback":
      return {
        label: "Validation rollback after stage failure",
        explanation:
          "Static Validation failed on both attempts. The failed candidate output was rolled back and never promoted. Previously accepted Change Sets remain retained.",
      };
    case "manual_stop":
      return {
        label: "Sequence stopped manually",
        explanation:
          "The Modernization Sequence stopped without promoting unaccepted output. Previously accepted Change Sets remain retained.",
      };
    default:
      return {
        label: reason ? String(reason) : "Unspecified stop reason",
        explanation:
          "The Modernization Sequence stopped. Unaccepted output was not promoted. Previously accepted Change Sets remain retained when present.",
      };
  }
}

function attemptSummary(attempt: OutcomeValidationAttempt): string {
  const checks = attempt.checks ?? [];
  const failed = checks.filter((check) => check.outcome === "failed").length;
  const passed = checks.filter((check) => check.outcome === "passed").length;
  const status = attempt.passed ? "passed" : "failed";
  if (checks.length === 0) {
    return `attempt ${attempt.attempt}: ${status}`;
  }
  return `attempt ${attempt.attempt}: ${status} (passed=${passed}, failed=${failed}, total=${checks.length})`;
}

function ValidationSummary({ report }: { report: OutcomeValidationReport }) {
  const attempts = report.attempts ?? [];
  return (
    <div className="tb-terminal overflow-hidden" data-testid="outcome-validation-summary">
      <div className="flex items-center justify-between gap-3 border-b border-terminal-border bg-surface-terminal-raised px-3 py-2">
        <div className="min-w-0">
          <p className="tb-mono text-[10px] uppercase tracking-wide text-terminal-fg-muted">
            validation report
          </p>
          <p className="truncate text-[12px] font-medium text-terminal-fg">
            stage {report.stageId} · change set {report.changeSetId}
          </p>
        </div>
        <span
          className="tb-mono shrink-0 rounded border border-terminal-border px-1.5 py-0.5 text-[10px] text-terminal-fg-muted"
          data-testid="outcome-validation-final"
        >
          final: {report.finalOutcome}
        </span>
      </div>
      <pre className="overflow-x-auto p-3 tb-mono text-[11px] leading-relaxed text-terminal-fg whitespace-pre-wrap">
        {[
          `final_outcome: ${report.finalOutcome}`,
          ...attempts.map(attemptSummary),
          report.externalTestsLabel
            ? `external_generated_tests: ${report.externalTestsLabel}`
            : null,
          "note: Static Validation examines repository artifacts only",
          "note: this screen does not claim Runtime Validation of the live application",
          "note: failed candidate output was not accepted",
        ]
          .filter(Boolean)
          .join("\n")}
      </pre>
    </div>
  );
}

function EndRunControls({
  busy,
  confirmingEnd,
  onConfirmingEndChange,
  onEndRun,
  endError,
  retainedCount,
}: {
  busy: boolean;
  confirmingEnd: boolean;
  onConfirmingEndChange: (value: boolean) => void;
  onEndRun: () => void;
  endError?: string | null;
  retainedCount: number;
}) {
  return (
    <div className="space-y-3" data-testid="outcome-end-run">
      <div className="rounded-md border border-border-subtle bg-surface-inset/60 px-3 py-2">
        <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
          next safe action
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
          End this run to release in-memory state and return to repository start.{" "}
          {retainedCount > 0
            ? `${retainedCount} accepted Change Set${retainedCount === 1 ? "" : "s"} stay in the current snapshot until the run ends — they are not downloadable from a stopped or rolled-back outcome.`
            : "No accepted Change Sets were retained. There is no downloadable artifact from this outcome."}
        </p>
      </div>

      {endError ? (
        <div
          className="rounded-md border border-danger/40 bg-surface-inset/80 px-3 py-2"
          role="alert"
          data-testid="outcome-end-error"
        >
          <p className="text-[13px] font-medium text-danger">End run did not complete</p>
          <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
            The current outcome is preserved. Review the error, then confirm again to retry
            deletion. No accepted or rolled-back state was altered by the failed request.
          </p>
          <pre className="mt-2 overflow-x-auto tb-mono text-[11px] text-text-secondary whitespace-pre-wrap">
            {endError}
          </pre>
        </div>
      ) : null}

      {confirmingEnd ? (
        <div
          className="space-y-3 rounded-md border border-border-strong bg-surface-inset/50 p-3"
          role="group"
          aria-label="Confirm end run"
          data-testid="outcome-end-confirm"
        >
          <p className="text-[13px] leading-relaxed text-text-secondary">
            End this run and return to repository start? In-memory evidence for this run will be
            released. This does not download an artifact and does not reverse accepted snapshot
            history outside this host process.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onConfirmingEndChange(false);
                onEndRun();
              }}
              className="tb-btn tb-btn-primary"
              data-testid="outcome-end-confirm-submit"
            >
              {endError ? "Retry end run" : "Confirm end run"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onConfirmingEndChange(false)}
              className="tb-btn tb-btn-ghost"
              data-testid="outcome-end-confirm-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => onConfirmingEndChange(true)}
          className="tb-btn tb-btn-secondary"
          data-testid="outcome-end-run-button"
        >
          {endError ? "Retry end run / Start over" : "End run / Start over"}
        </button>
      )}
    </div>
  );
}

/**
 * Honest terminal outcomes for rolled-back stages and stopped sequences.
 * Never presents rejected or rolled-back output as accepted, and never offers download.
 */
export function SequenceOutcome({
  kind,
  presentation,
  sourceLabel,
  selectedCandidateName,
  currentStageTitle,
  acceptedChangeSetCount,
  validationReport,
  stopReason,
  busy = false,
  confirmingEnd,
  onConfirmingEndChange,
  onEndRun,
  endError = null,
}: SequenceOutcomeProps) {
  const headingId = useId();
  const isRollback = kind === "stage_failed_rolled_back";
  const reason = isRollback
    ? {
        label: "Second Static Validation failure",
        explanation:
          "Both generation attempts failed Static Validation. The failed candidate Change Set was rolled back. The current accepted snapshot was retained unchanged.",
      }
    : stopReasonCopy(stopReason);

  const statusLabel = isRollback ? "rolled back" : "stopped";
  const toneChip = isRollback ? "tb-chip tb-chip-warn" : "tb-chip tb-chip-warn";
  const outcomeCode = isRollback ? "stage_failed_rolled_back" : "sequence_stopped";

  return (
    <section
      className="space-y-4"
      data-testid="sequence-outcome"
      data-outcome-kind={kind}
      aria-labelledby={headingId}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
            sequence outcome
          </p>
          <h2 id={headingId} className="text-[15px] font-semibold text-ink">
            {presentation.heading}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
            {presentation.explanation}
          </p>
        </div>
        <span className={toneChip} data-testid="outcome-status-chip">
          {statusLabel}
        </span>
      </div>

      <div
        className="space-y-3 rounded-lg border border-border-strong bg-surface-paper p-4"
        data-testid={isRollback ? "rollback-status" : "stopped-status"}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border-subtle px-3 py-2">
            <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">outcome</p>
            <p className="mt-1 tb-mono text-[12px] text-text-primary" data-testid="outcome-code">
              {outcomeCode}
            </p>
          </div>
          <div className="rounded-md border border-border-subtle px-3 py-2">
            <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">why</p>
            <p className="mt-1 text-[13px] text-text-primary" data-testid="outcome-reason-label">
              {reason.label}
            </p>
          </div>
        </div>

        <p className="text-[13px] leading-relaxed text-text-secondary" data-testid="outcome-why">
          {reason.explanation}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div
            className="rounded-md border border-success/40 bg-surface-inset/70 px-3 py-2"
            data-testid="outcome-preserved"
          >
            <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">preserved</p>
            <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
              Current accepted snapshot retained
              {acceptedChangeSetCount > 0
                ? ` (${acceptedChangeSetCount} accepted Change Set${
                    acceptedChangeSetCount === 1 ? "" : "s"
                  })`
                : " (no accepted Change Sets yet)"}
              . Rejected or rolled-back candidate output was not promoted.
            </p>
          </div>
          <div
            className="rounded-md border border-danger/40 bg-surface-inset/70 px-3 py-2"
            data-testid="outcome-not-promoted"
          >
            <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
              not promoted
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
              {isRollback
                ? "Failed candidate Change Set after both Static Validation attempts."
                : stopReason === "developer_rejected"
                  ? "Unaccepted candidate Change Set rejected by the developer."
                  : "Unaccepted candidate output from the stopped sequence."}
            </p>
          </div>
        </div>

        <dl className="grid gap-2 text-[12px] sm:grid-cols-2">
          {sourceLabel ? (
            <div>
              <dt className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
                source
              </dt>
              <dd className="mt-0.5 text-text-secondary">{sourceLabel}</dd>
            </div>
          ) : null}
          {selectedCandidateName ? (
            <div>
              <dt className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
                domain candidate
              </dt>
              <dd className="mt-0.5 text-text-secondary">{selectedCandidateName}</dd>
            </div>
          ) : null}
          {currentStageTitle ? (
            <div>
              <dt className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
                stage plan
              </dt>
              <dd className="mt-0.5 text-text-secondary">{currentStageTitle}</dd>
            </div>
          ) : null}
          <div>
            <dt className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
              accepted change sets retained
            </dt>
            <dd className="mt-0.5 text-text-secondary" data-testid="outcome-accepted-count">
              {acceptedChangeSetCount}
            </dd>
          </div>
          {!isRollback && stopReason ? (
            <div>
              <dt className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
                stop reason code
              </dt>
              <dd className="mt-0.5 tb-mono text-text-secondary" data-testid="outcome-stop-reason">
                {stopReason}
              </dd>
            </div>
          ) : null}
        </dl>

        <div
          className="tb-terminal overflow-hidden"
          data-testid={isRollback ? "rollback-terminal" : "stopped-terminal"}
        >
          <pre className="overflow-x-auto p-3 tb-mono text-[11px] leading-relaxed text-terminal-fg">
            {`outcome: ${outcomeCode}
accepted_change_sets_retained: ${acceptedChangeSetCount}
${isRollback ? "rollback: failed_candidate_not_promoted" : `reason: ${stopReason ?? "unspecified"}`}
acceptance: not_granted
download: unavailable
note: rejected or rolled-back output never appears accepted`}
          </pre>
        </div>
      </div>

      {validationReport ? <ValidationSummary report={validationReport} /> : null}

      <p className="text-[12px] text-text-quiet" data-testid="outcome-honesty-note">
        No automatic acceptance occurred. This outcome is not a completed Modernization Sequence and
        does not offer a result ZIP. External generated tests remain not executed unless a separate
        Validation Report field says otherwise.
      </p>

      <EndRunControls
        busy={busy}
        confirmingEnd={confirmingEnd}
        onConfirmingEndChange={onConfirmingEndChange}
        onEndRun={onEndRun}
        endError={endError}
        retainedCount={acceptedChangeSetCount}
      />
    </section>
  );
}
