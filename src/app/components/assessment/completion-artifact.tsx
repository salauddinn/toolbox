"use client";

import { useId } from "react";
import type { Presentation } from "./presentation-state";

export type CompletionValidationAttemptSummary = {
  attempt: number;
  passed: boolean;
  checkCount?: number;
  failedCheckIds?: readonly string[];
};

export type CompletionValidationReportSummary = {
  stageId: string;
  changeSetId: string;
  finalOutcome: string;
  externalTestsLabel?: string | null;
  attempts?: readonly CompletionValidationAttemptSummary[];
};

export type CompletionArtifactProps = {
  presentation: Presentation;
  sourceLabel?: string;
  selectedCandidateName?: string;
  acceptedChangeSetCount: number;
  validationReports?: readonly CompletionValidationReportSummary[] | null;
  /** Only render download when the API exposes both fields. */
  downloadAvailable?: boolean;
  downloadPath?: string | null;
  busy?: boolean;
  confirmingEnd: boolean;
  onConfirmingEndChange: (value: boolean) => void;
  onEndRun: () => void;
  endError?: string | null;
};

const EXPECTED_ZIP_ENTRIES = [
  "repository/ — accepted snapshot only (promoted Change Sets)",
  "toolbox-validation-report.json — Validation Report summaries for accepted stages",
] as const;

function reportExternalLabel(
  reports: readonly CompletionValidationReportSummary[] | null | undefined,
): string | null {
  if (!reports || reports.length === 0) return null;
  const labels = reports
    .map((report) => report.externalTestsLabel)
    .filter((label): label is string => Boolean(label));
  if (labels.some((label) => label === "not_executed")) return "not_executed";
  return labels[0] ?? null;
}

/**
 * Completion / artifact screen. Renders only completed public-view fields.
 * Never claims browser access to the full snapshot or automatic Runtime Validation.
 */
export function CompletionArtifact({
  presentation,
  sourceLabel,
  selectedCandidateName,
  acceptedChangeSetCount,
  validationReports = [],
  downloadAvailable = false,
  downloadPath = null,
  busy = false,
  confirmingEnd,
  onConfirmingEndChange,
  onEndRun,
  endError = null,
}: CompletionArtifactProps) {
  const headingId = useId();
  const reports = validationReports ?? [];
  const canDownload = Boolean(downloadAvailable && downloadPath);
  const externalLabel = reportExternalLabel(reports);

  return (
    <section className="space-y-4" data-testid="completion-artifact" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
            completion artifact
          </p>
          <h2 id={headingId} className="text-[15px] font-semibold text-ink">
            {presentation.heading}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
            {presentation.explanation}
          </p>
        </div>
        <span className="tb-chip tb-chip-ok" data-testid="completion-status-chip">
          completed
        </span>
      </div>

      <div
        className="space-y-3 rounded-lg border border-accent/40 bg-accent-soft/30 p-4"
        data-testid="completion-summary"
      >
        <p
          className="text-[13px] leading-relaxed text-text-secondary"
          data-testid="completion-count"
        >
          Modernization Sequence completed with{" "}
          <span className="font-semibold text-ink">{acceptedChangeSetCount}</span> accepted Change
          Set{acceptedChangeSetCount === 1 ? "" : "s"}. Only developer-accepted, Static-validated
          Change Sets are in the accepted snapshot.
        </p>

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
              <dd className="mt-0.5 text-text-secondary" data-testid="completion-candidate">
                {selectedCandidateName}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
              accepted change sets
            </dt>
            <dd className="mt-0.5 text-text-secondary" data-testid="completion-accepted-count">
              {acceptedChangeSetCount}
            </dd>
          </div>
          <div>
            <dt className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
              validation reports
            </dt>
            <dd className="mt-0.5 text-text-secondary" data-testid="completion-report-count">
              {reports.length}
            </dd>
          </div>
        </dl>

        <p className="text-[12px] text-text-quiet" data-testid="completion-honesty-note">
          Completion does not mean Runtime Validation of a live application, business sign-off, or
          automatic acceptance of any unreviewed Change Set. The browser does not render the full
          accepted repository snapshot.
        </p>
      </div>

      <section className="space-y-2" aria-labelledby="completion-reports-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
              per-stage summaries
            </p>
            <h3 id="completion-reports-heading" className="text-[14px] font-semibold text-ink">
              Validation Report summaries
            </h3>
          </div>
          {externalLabel ? (
            <span className="tb-chip" data-testid="completion-external-tests">
              external generated tests:{" "}
              {externalLabel === "not_executed" ? "not executed" : externalLabel}
            </span>
          ) : (
            <span className="tb-chip" data-testid="completion-external-tests">
              external generated tests: not executed
            </span>
          )}
        </div>

        {reports.length === 0 ? (
          <div
            className="rounded-md border border-border-subtle px-3 py-3 text-[13px] text-text-secondary"
            data-testid="completion-reports-empty"
          >
            No per-stage Validation Report summaries were exposed on this completed public view.
          </div>
        ) : (
          <ul className="space-y-2" data-testid="completion-reports-list">
            {reports.map((report) => {
              const attempts = report.attempts ?? [];
              return (
                <li
                  key={`${report.stageId}:${report.changeSetId}`}
                  className="tb-terminal overflow-hidden"
                  data-testid={`completion-report-${report.stageId}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-terminal-border bg-surface-terminal-raised px-3 py-2">
                    <div className="min-w-0">
                      <p className="tb-mono text-[10px] uppercase tracking-wide text-terminal-fg-muted">
                        stage {report.stageId}
                      </p>
                      <p className="truncate text-[12px] font-medium text-terminal-fg">
                        change set {report.changeSetId}
                      </p>
                    </div>
                    <span className="tb-mono shrink-0 rounded border border-terminal-border px-1.5 py-0.5 text-[10px] text-terminal-fg-muted">
                      {report.finalOutcome}
                    </span>
                  </div>
                  <pre className="overflow-x-auto p-3 tb-mono text-[11px] leading-relaxed text-terminal-fg whitespace-pre-wrap">
                    {[
                      `final_outcome: ${report.finalOutcome}`,
                      ...attempts.map((attempt) => {
                        const failed = attempt.failedCheckIds?.length ?? 0;
                        const checkCount = attempt.checkCount;
                        const base = `attempt ${attempt.attempt}: ${attempt.passed ? "passed" : "failed"}`;
                        if (checkCount === undefined) return base;
                        return `${base} (checks=${checkCount}${failed > 0 ? `, failed_ids=${attempt.failedCheckIds?.join(",")}` : ""})`;
                      }),
                      report.externalTestsLabel
                        ? `external_generated_tests: ${report.externalTestsLabel}`
                        : "external_generated_tests: not_executed",
                      "note: summaries only — detailed checks live in the downloaded report",
                    ].join("\n")}
                  </pre>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section
        className="space-y-3 rounded-lg border border-border-strong bg-surface-paper p-4"
        aria-labelledby="completion-zip-heading"
        data-testid="completion-download-panel"
      >
        <div>
          <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
            downloadable artifact
          </p>
          <h3 id="completion-zip-heading" className="text-[14px] font-semibold text-ink">
            Result ZIP structure
          </h3>
        </div>
        <ul className="space-y-1.5 text-[13px] text-text-secondary">
          {EXPECTED_ZIP_ENTRIES.map((entry) => (
            <li key={entry} className="flex gap-2">
              <span className="tb-mono text-text-quiet" aria-hidden="true">
                ·
              </span>
              <span>{entry}</span>
            </li>
          ))}
        </ul>
        <p className="text-[12px] text-text-quiet">
          The ZIP is built from accepted snapshot state only. Rolled-back or rejected candidate
          output is never packaged.
        </p>

        {canDownload ? (
          <a
            href={downloadPath!}
            className="tb-btn tb-btn-primary inline-flex"
            data-testid="download-result-zip"
          >
            Download result ZIP
          </a>
        ) : (
          <p className="text-[13px] text-text-secondary" data-testid="download-unavailable">
            Download is unavailable until the completed public view provides a download path. No
            alternate browser snapshot is offered.
          </p>
        )}
      </section>

      <div className="space-y-3" data-testid="completion-end-run">
        <div className="rounded-md border border-border-subtle bg-surface-inset/60 px-3 py-2">
          <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
            next safe action
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
            Download the artifact if available, then end the run to release in-memory state and
            return to repository start.
          </p>
        </div>

        {endError ? (
          <div
            className="rounded-md border border-danger/40 bg-surface-inset/80 px-3 py-2"
            role="alert"
            data-testid="completion-end-error"
          >
            <p className="text-[13px] font-medium text-danger">End run did not complete</p>
            <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
              The completed run and download link remain available. Retry ending the run after
              reviewing the error. Failed deletion does not remove the artifact path from this
              session.
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
            data-testid="completion-end-confirm"
          >
            <p className="text-[13px] leading-relaxed text-text-secondary">
              End this completed run and return to repository start? Download the ZIP first if you
              still need it. Ending releases in-memory run state on this host.
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
                data-testid="completion-end-confirm-submit"
              >
                {endError ? "Retry end run" : "Confirm end run"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onConfirmingEndChange(false)}
                className="tb-btn tb-btn-ghost"
                data-testid="completion-end-confirm-cancel"
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
            data-testid="completion-end-run-button"
          >
            {endError ? "Retry end run / Start over" : "End run / Start over"}
          </button>
        )}
      </div>
    </section>
  );
}
