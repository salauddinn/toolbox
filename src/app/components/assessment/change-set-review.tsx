"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { ReviewPayload, ReviewTruncationLabel } from "@/server/workflow/review-payload";
import type { Presentation, ReviewReadiness } from "./presentation-state";
import { reviewReadinessCopy } from "./stage-plan-view";

export type ChangeSetReviewFile = ReviewPayload["files"][number];
export type ChangeSetReviewPayload = ReviewPayload;

export type ChangeSetReviewProps = {
  presentation: Presentation;
  review: ReviewReadiness;
  /** Bounded recoverable payload; null/undefined means incomplete. */
  reviewPayload?: ChangeSetReviewPayload | null;
  currentStageTitle?: string;
  canAccept: boolean;
  canReject: boolean;
  busy?: boolean;
  onAccept: () => void;
  onReject: () => void;
  /** Same-origin GET recovery for stale/incomplete/missing payloads. */
  onRefreshReview?: () => void;
};

function formatBytes(value: number | undefined): string | null {
  if (value === undefined) return null;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KiB`;
  return `${value} B`;
}

function truncationCopy(label: ReviewTruncationLabel | string): string {
  switch (label) {
    case "paths_truncated":
      return "Changed paths truncated — only allowlisted paths in this review are shown.";
    case "previews_truncated":
      return "File previews truncated — full file bodies are never exposed in the browser.";
    case "validation_checks_truncated":
      return "Validation checks truncated — remaining checks stay server-side.";
    case "validation_details_truncated":
      return "Validation check details truncated for browser safety.";
    default:
      return String(label);
  }
}

function operationKindLabel(kind: ChangeSetReviewFile["kind"]): string {
  switch (kind) {
    case "create":
      return "created";
    case "update":
      return "updated";
    case "delete":
      return "deleted";
    default:
      return String(kind);
  }
}

function operationChipClass(kind: ChangeSetReviewFile["kind"]): string {
  switch (kind) {
    case "create":
      return "tb-chip tb-chip-ok";
    case "update":
      return "tb-chip tb-chip-accent";
    case "delete":
      return "tb-chip tb-chip-warn";
    default:
      return "tb-chip";
  }
}

function outcomeChipClass(outcome: string): string {
  if (outcome === "passed") return "tb-chip tb-chip-ok";
  if (outcome === "failed") return "tb-chip tb-chip-warn";
  return "tb-chip";
}

function focusableElements(root: HTMLElement): HTMLElement[] {
  const nodes = root.querySelectorAll<HTMLElement>(
    [
      "a[href]",
      "button:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled]):not([type='hidden'])",
      "select:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(","),
  );
  return [...nodes].filter((el) => {
    if (el.getAttribute("aria-hidden") === "true") return false;
    const style = window.getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  });
}

function RejectConfirmDialog({
  open,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => document.removeEventListener("keydown", onDocumentKeyDown);
  }, [open, onCancel]);

  const handleBackdropMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onCancel();
  };

  const handlePanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusables = focusableElements(panelRef.current);
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey) {
      if (active === first || !panelRef.current.contains(active)) {
        event.preventDefault();
        last.focus();
      }
      return;
    }
    if (active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
      data-testid="reject-confirm-backdrop"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
        className="w-full max-w-md rounded-lg border border-border-strong bg-surface-paper p-4 shadow-lg outline-none"
        data-testid="reject-confirm-dialog"
      >
        <h3 id={titleId} className="text-[15px] font-semibold text-ink">
          Reject and stop the sequence?
        </h3>
        <p id={descriptionId} className="mt-2 text-[13px] leading-relaxed text-text-secondary">
          Rejecting stops the Modernization Sequence. The unaccepted candidate snapshot is not
          promoted. Previously accepted Change Sets remain retained.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            className="tb-btn tb-btn-ghost"
            disabled={busy}
            onClick={onCancel}
            data-testid="reject-confirm-cancel"
          >
            Keep reviewing
          </button>
          <button
            type="button"
            className="tb-btn tb-btn-primary"
            disabled={busy}
            onClick={onConfirm}
            data-testid="reject-confirm-submit"
          >
            Confirm reject and stop
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewPane({
  label,
  text,
  emptyLabel,
  tone,
}: {
  label: string;
  text?: string;
  emptyLabel: string;
  tone: "before" | "after" | "delete";
}) {
  const toneClass =
    tone === "after"
      ? "border-diff-add/30 bg-diff-add-bg/40"
      : tone === "delete"
        ? "border-diff-delete/30 bg-diff-delete-bg/40"
        : "border-terminal-border";

  return (
    <div className="min-w-0 space-y-1.5" data-testid={`preview-${tone}`}>
      <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">{label}</p>
      <div className={`tb-terminal overflow-hidden ${toneClass}`}>
        {text !== undefined && text.length > 0 ? (
          <pre className="max-h-64 overflow-auto p-3 tb-mono text-[11px] leading-relaxed text-terminal-fg whitespace-pre-wrap break-words">
            {text}
          </pre>
        ) : (
          <p className="p-3 tb-mono text-[11px] text-terminal-fg-muted">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}

function FilePreview({ file }: { file: ChangeSetReviewFile }) {
  if (file.kind === "delete") {
    return (
      <div className="grid gap-3" data-testid="file-preview">
        <PreviewPane
          label="Before (accepted snapshot excerpt)"
          text={file.beforePreview}
          emptyLabel="No before preview available for this deleted path."
          tone="delete"
        />
        <p className="text-[12px] text-text-quiet" data-testid="delete-consequence">
          Delete operation — path is removed from the candidate snapshot if accepted.
        </p>
      </div>
    );
  }

  if (file.kind === "create") {
    return (
      <div className="grid gap-3" data-testid="file-preview">
        <PreviewPane
          label="After (candidate snapshot excerpt)"
          text={file.afterPreview}
          emptyLabel="No after preview available for this created path."
          tone="after"
        />
        <p className="text-[12px] text-text-quiet">
          Create operation — path does not exist in the current accepted snapshot.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2" data-testid="file-preview">
      <PreviewPane
        label="Before (accepted snapshot excerpt)"
        text={file.beforePreview}
        emptyLabel="No before preview available."
        tone="before"
      />
      <PreviewPane
        label="After (candidate snapshot excerpt)"
        text={file.afterPreview}
        emptyLabel="No after preview available."
        tone="after"
      />
    </div>
  );
}

function ValidationLedger({ report }: { report: ChangeSetReviewPayload["validationReport"] }) {
  return (
    <section
      className="space-y-3"
      data-testid="validation-ledger"
      aria-labelledby="validation-ledger-heading"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
            validation ledger
          </p>
          <h3 id="validation-ledger-heading" className="text-[14px] font-semibold text-ink">
            Client-safe Validation Report
          </h3>
        </div>
        <span
          className={outcomeChipClass(report.finalOutcome)}
          data-testid="validation-final-outcome"
        >
          final: {report.finalOutcome}
        </span>
      </div>

      <div className="tb-terminal overflow-hidden" data-testid="validation-meta-terminal">
        <pre className="overflow-x-auto p-3 tb-mono text-[11px] leading-relaxed text-terminal-fg">
          {`stage_id: ${report.stageId}
change_set_id: ${report.changeSetId}
final_outcome: ${report.finalOutcome}
external_tests: ${report.externalTestsLabel ?? "not_labelled"}
note: Static Validation is deterministic; Runtime Validation remains advisory when present
note: external generated tests are not executed in this product path`}
        </pre>
      </div>

      {report.externalTestsLabel === "not_executed" ? (
        <p className="text-[12px] text-text-quiet" data-testid="external-tests-label">
          External generated tests: not executed.
        </p>
      ) : null}

      <div className="space-y-4">
        {report.attempts.map((attempt) => {
          const staticChecks = attempt.checks.filter((check) => check.kind === "static");
          const runtimeChecks = attempt.checks.filter((check) => check.kind === "runtime");
          const otherChecks = attempt.checks.filter(
            (check) => check.kind !== "static" && check.kind !== "runtime",
          );

          return (
            <div
              key={attempt.attempt}
              className="rounded-lg border border-border-subtle bg-surface-inset/30 p-3"
              data-testid={`validation-attempt-${attempt.attempt}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[13px] font-semibold text-ink">Attempt {attempt.attempt}</p>
                <span className={attempt.passed ? "tb-chip tb-chip-ok" : "tb-chip tb-chip-warn"}>
                  {attempt.passed ? "passed" : "failed"}
                </span>
                <span className="tb-mono text-[11px] text-text-quiet">
                  checks={attempt.checks.length}
                </span>
              </div>

              <div className="mt-3 space-y-3">
                <CheckGroup title="Static Validation" kind="static" checks={staticChecks} />
                <CheckGroup title="Runtime Validation" kind="runtime" checks={runtimeChecks} />
                {otherChecks.length > 0 ? (
                  <CheckGroup title="Other checks" kind="other" checks={otherChecks} />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CheckGroup({
  title,
  kind,
  checks,
}: {
  title: string;
  kind: "static" | "runtime" | "other";
  checks: readonly {
    id: string;
    kind: string;
    title: string;
    outcome: string;
    detail?: string;
  }[];
}) {
  return (
    <div data-testid={`check-group-${kind}`}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">{title}</p>
        <span className="tb-chip">{checks.length}</span>
        {kind === "runtime" ? (
          <span className="text-[11px] text-text-quiet">advisory when present</span>
        ) : null}
      </div>
      {checks.length === 0 ? (
        <p className="text-[12px] text-text-quiet">
          No {title.toLowerCase()} checks in this attempt.
        </p>
      ) : (
        <ul className="space-y-2">
          {checks.map((check) => (
            <li
              key={check.id}
              className="rounded-md border border-border-subtle bg-surface-paper px-2.5 py-2"
              data-testid={`validation-check-${check.id}`}
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
                  {check.kind}
                </span>
                <span className={outcomeChipClass(check.outcome)}>{check.outcome}</span>
                <span className="text-[13px] font-medium text-ink">{check.title}</span>
                <span className="tb-mono text-[11px] text-text-quiet">{check.id}</span>
              </div>
              {check.detail ? (
                <div className="tb-terminal mt-2 overflow-hidden">
                  <pre className="overflow-x-auto p-2 tb-mono text-[11px] leading-relaxed text-terminal-fg whitespace-pre-wrap break-words">
                    {check.detail}
                  </pre>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Decision-grade Change Set review workspace backed by the bounded ReviewPayload.
 * Acceptance remains gated by the presentation adapter; this surface never invents
 * snapshot content beyond the allowlisted payload.
 */
export function ChangeSetReview({
  presentation,
  review,
  reviewPayload,
  currentStageTitle,
  canAccept,
  canReject,
  busy = false,
  onAccept,
  onReject,
  onRefreshReview,
}: ChangeSetReviewProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [confirmingReject, setConfirmingReject] = useState(false);
  const rejectTriggerRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const navigatorLabelId = useId();

  const files = useMemo(() => reviewPayload?.files ?? [], [reviewPayload]);
  const selectedFile = useMemo(() => {
    if (files.length === 0) return null;
    const match = selectedPath ? files.find((file) => file.path === selectedPath) : undefined;
    return match ?? files[0] ?? null;
  }, [files, selectedPath]);

  useEffect(() => {
    if (!selectedFile) {
      setSelectedPath(null);
      return;
    }
    if (selectedPath !== selectedFile.path) {
      setSelectedPath(selectedFile.path);
    }
  }, [selectedFile, selectedPath]);

  const acceptEnabled = canAccept && review === "complete-current" && !busy;
  const showRecovery =
    review === "loading" ||
    review === "incomplete" ||
    review === "failed" ||
    review === "stale" ||
    !reviewPayload;

  const closeRejectDialog = useCallback(() => {
    setConfirmingReject(false);
    queueMicrotask(() => rejectTriggerRef.current?.focus());
  }, []);

  const confirmReject = useCallback(() => {
    setConfirmingReject(false);
    onReject();
  }, [onReject]);

  const requestReject = useCallback(() => {
    if (!canReject || busy) return;
    setConfirmingReject(true);
  }, [busy, canReject]);

  const totalsLine = reviewPayload
    ? `+${reviewPayload.totals.created} ~${reviewPayload.totals.updated} -${reviewPayload.totals.deleted}`
    : "unavailable";

  return (
    <>
      <section
        className="space-y-4"
        data-testid="change-set-review"
        data-review-readiness={review}
        aria-labelledby={headingId}
        inert={confirmingReject ? true : undefined}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
              change set review
            </p>
            <h2 id={headingId} className="text-[15px] font-semibold text-ink">
              {presentation.heading}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
              {presentation.explanation}
            </p>
            {currentStageTitle ? (
              <p className="mt-1 text-[12px] text-text-quiet">
                Stage Plan: <span className="text-text-secondary">{currentStageTitle}</span>
              </p>
            ) : null}
          </div>
          <span
            className={
              review === "complete-current"
                ? "tb-chip tb-chip-ok"
                : review === "failed"
                  ? "tb-chip tb-chip-warn"
                  : "tb-chip tb-chip-accent"
            }
            data-testid="review-status-chip"
          >
            {review === "complete-current" ? "review ready" : `review ${review}`}
          </span>
        </div>

        <p className="text-[12px] text-text-secondary" data-testid="review-readiness">
          {reviewReadinessCopy(review)}
        </p>

        {reviewPayload ? (
          <div className="tb-terminal overflow-hidden" data-testid="review-totals-terminal">
            <pre className="overflow-x-auto p-3 tb-mono text-[11px] leading-relaxed text-terminal-fg">
              {`change_set: ${reviewPayload.changeSetId}
attempt: ${reviewPayload.attempt}
totals: ${totalsLine}
files_in_review: ${reviewPayload.files.length}
validation: ${reviewPayload.validationReport.finalOutcome}${
                reviewPayload.validationReport.externalTestsLabel
                  ? `\nexternal_tests: ${reviewPayload.validationReport.externalTestsLabel}`
                  : ""
              }${
                reviewPayload.truncationLabels.length > 0
                  ? `\ntruncation: ${reviewPayload.truncationLabels.join(", ")}`
                  : "\ntruncation: none"
              }
note: browser projection is allowlisted and size-limited; not a repository export
note: authorization already completed; acceptance is independent`}
            </pre>
          </div>
        ) : (
          <div className="tb-terminal overflow-hidden" data-testid="review-missing-terminal">
            <pre className="overflow-x-auto p-3 tb-mono text-[11px] leading-relaxed text-terminal-fg">
              {`review_payload: missing_or_incomplete
acceptance: unavailable
recovery: refresh the same-origin run-bound review while awaiting acceptance`}
            </pre>
          </div>
        )}

        {reviewPayload && reviewPayload.truncationLabels.length > 0 ? (
          <ul className="space-y-1" data-testid="truncation-labels">
            {reviewPayload.truncationLabels.map((label) => (
              <li key={label} className="text-[12px] text-warning">
                {truncationCopy(label)}
              </li>
            ))}
          </ul>
        ) : null}

        {showRecovery ? (
          <div
            className="space-y-2 rounded-lg border border-border-subtle bg-surface-inset/40 p-3"
            data-testid="review-recovery"
            role="status"
          >
            <p className="text-[13px] font-semibold text-ink">Review recovery</p>
            <p className="text-[12px] leading-relaxed text-text-secondary">
              {review === "loading"
                ? "Loading the current bounded review payload. Acceptance stays unavailable."
                : review === "stale"
                  ? "This review no longer matches the current Change Set. Refresh to recover the server-held current payload."
                  : review === "failed"
                    ? "Validation did not pass for the current attempt. Acceptance stays unavailable; you may reject and stop or refresh if the run state changed."
                    : "The recoverable review payload is missing or incomplete. Refresh restores the same current review when the run is still awaiting acceptance."}
            </p>
            {onRefreshReview ? (
              <button
                type="button"
                className="tb-btn tb-btn-secondary"
                disabled={busy || review === "loading"}
                onClick={onRefreshReview}
                data-testid="refresh-review-button"
              >
                {review === "loading" ? "Refreshing review…" : "Refresh current review"}
              </button>
            ) : null}
          </div>
        ) : null}

        {reviewPayload && files.length > 0 ? (
          <div
            className="grid gap-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]"
            data-testid="review-workspace-grid"
          >
            <nav
              className="min-w-0 space-y-2"
              aria-labelledby={navigatorLabelId}
              data-testid="changed-file-navigator"
            >
              <p
                id={navigatorLabelId}
                className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet"
              >
                changed files
              </p>
              <ul
                className="space-y-1.5"
                role="listbox"
                aria-label="Changed files in this Change Set"
              >
                {files.map((file) => {
                  const selected = selectedFile?.path === file.path;
                  const bytes = formatBytes(file.bytes);
                  return (
                    <li key={file.path} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
                          selected
                            ? "border-accent bg-accent-soft/50"
                            : "border-border-subtle bg-surface-inset/40 hover:border-border-strong"
                        }`}
                        onClick={() => setSelectedPath(file.path)}
                        data-testid={`review-file-${file.path}`}
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={operationChipClass(file.kind)}>
                            {operationKindLabel(file.kind)}
                          </span>
                          {bytes ? (
                            <span className="tb-mono text-[10px] text-text-quiet">{bytes}</span>
                          ) : null}
                        </div>
                        <p className="mt-1 break-all tb-mono text-[11px] text-text-primary">
                          {file.path}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="min-w-0 space-y-2" data-testid="bounded-diff-surface">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
                    bounded preview
                  </p>
                  <h3 className="break-all text-[13px] font-semibold text-ink">
                    {selectedFile?.path ?? "No file selected"}
                  </h3>
                </div>
                {selectedFile ? (
                  <span className={operationChipClass(selectedFile.kind)}>
                    {operationKindLabel(selectedFile.kind)}
                    {formatBytes(selectedFile.bytes) ? ` · ${formatBytes(selectedFile.bytes)}` : ""}
                  </span>
                ) : null}
              </div>
              {selectedFile ? <FilePreview file={selectedFile} /> : null}
              <p className="text-[11px] text-text-quiet">
                Previews are redacted, size-limited excerpts. Protected paths and secrets are never
                shown.
              </p>
            </div>
          </div>
        ) : null}

        {reviewPayload ? <ValidationLedger report={reviewPayload.validationReport} /> : null}

        {/* Sticky decision bar — consequences are explicit before accept/reject. */}
        <div
          className="sticky bottom-0 z-10 -mx-1 space-y-3 rounded-lg border border-border-strong bg-surface-paper/95 p-3 shadow-lift backdrop-blur-sm"
          data-testid="review-decision-bar"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <div
              className="rounded-md border border-accent/30 bg-accent-soft/40 px-3 py-2"
              data-testid="accept-consequence"
            >
              <p className="text-[12px] font-semibold text-ink">If you accept</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-text-secondary">
                Accepting promotes the validated candidate snapshot into the current accepted
                snapshot for this Change Set.
              </p>
            </div>
            <div
              className="rounded-md border border-warning/40 bg-surface-inset/60 px-3 py-2"
              data-testid="reject-consequence"
            >
              <p className="text-[12px] font-semibold text-ink">If you reject</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-text-secondary">
                Rejecting stops the Modernization Sequence. Unaccepted output is not promoted;
                previously accepted work is retained.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2" data-testid="acceptance-actions">
            {acceptEnabled ? (
              <button
                type="button"
                disabled={busy}
                onClick={onAccept}
                className="tb-btn tb-btn-primary"
                data-testid="accept-change-set-button"
              >
                Accept Change Set
              </button>
            ) : (
              <p className="text-[12px] text-text-quiet" data-testid="accept-unavailable">
                Accept is unavailable until review data is complete and current for this Change Set.
              </p>
            )}
            {canReject ? (
              <button
                ref={rejectTriggerRef}
                type="button"
                disabled={busy}
                onClick={requestReject}
                className="tb-btn tb-btn-secondary"
                data-testid="reject-change-set-button"
                aria-haspopup="dialog"
              >
                Reject and stop
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <RejectConfirmDialog
        open={confirmingReject}
        busy={busy}
        onCancel={closeRejectDialog}
        onConfirm={confirmReject}
      />
    </>
  );
}
