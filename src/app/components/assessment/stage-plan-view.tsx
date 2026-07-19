"use client";

import { useEffect, useState } from "react";
import type { EvidenceRecord, InspectRequest } from "./evidence-types";
import type { Presentation, ReviewReadiness } from "./presentation-state";

export type StagePlanStage = {
  id: string;
  kind: string;
  title: string;
  purpose: string;
  conditional: boolean;
  evidence: readonly EvidenceRecord[];
  expectedFiles: readonly string[];
  validationCriteria: readonly {
    id: string;
    description: string;
    kind: "static" | "runtime" | string;
  }[];
  budgets: {
    maxOperations: number;
    maxBytesPerFile: number;
    maxTotalChangedBytes: number;
  };
};

export type StageRailLabel =
  "accepted" | "current" | "queued" | "conditional" | "failed" | "stopped";

export type StageOperationPhase =
  | "awaiting_authorization"
  | "generating"
  | "validating"
  | "repairing"
  | "awaiting_acceptance"
  | "stage_failed_rolled_back"
  | "sequence_stopped"
  | "completed";

export type BoundedReviewSummary = {
  changeSetId: string;
  attempt: 1 | 2 | number;
  totals: { created: number; updated: number; deleted: number };
  fileCount: number;
  validationOutcome?: string;
  truncationLabels?: readonly string[];
  externalTestsLabel?: string;
};

function formatBytes(value: number): string {
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KiB`;
  return `${value} B`;
}

/** Deterministic rail label for a stage slot. Conditional is a modifier, not exclusive. */
export function stageRailLabel(input: {
  index: number;
  stageIndex: number;
  conditional: boolean;
  phase: StageOperationPhase;
  stageCount: number;
}): { primary: StageRailLabel; modifiers: readonly StageRailLabel[] } {
  const { index, stageIndex, conditional, phase } = input;
  const modifiers: StageRailLabel[] = conditional ? ["conditional"] : [];

  if (phase === "completed") {
    return { primary: "accepted", modifiers };
  }
  if (phase === "sequence_stopped") {
    if (index < stageIndex) return { primary: "accepted", modifiers };
    if (index === stageIndex) return { primary: "stopped", modifiers };
    return { primary: "queued", modifiers };
  }
  if (phase === "stage_failed_rolled_back") {
    if (index < stageIndex) return { primary: "accepted", modifiers };
    if (index === stageIndex) return { primary: "failed", modifiers };
    return { primary: "queued", modifiers };
  }
  if (index < stageIndex) return { primary: "accepted", modifiers };
  if (index === stageIndex) return { primary: "current", modifiers };
  return { primary: "queued", modifiers };
}

export function reviewReadinessCopy(readiness: ReviewReadiness): string {
  switch (readiness) {
    case "loading":
      return "Review data is still loading. Acceptance stays unavailable.";
    case "incomplete":
      return "Review payload is incomplete. Acceptance stays unavailable.";
    case "failed":
      return "Validation did not pass for the current attempt. Acceptance stays unavailable.";
    case "stale":
      return "Review payload does not match the current Change Set. Acceptance stays unavailable.";
    case "complete-current":
      return "Validation passed for the current Change Set. Acceptance is available after review.";
  }
}

function StageEvidenceList({
  items,
  onInspect,
}: {
  items: readonly EvidenceRecord[];
  onInspect?: (request: InspectRequest) => void;
}) {
  if (items.length === 0) {
    return <p className="text-[12px] text-text-quiet">No evidence attached.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={`${item.ruleId}-${item.file}-${item.line}-${index}`}
          className="rounded-md border border-border-subtle bg-surface-inset/50 px-2.5 py-2"
        >
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
              {item.severity}
            </span>
            <span className="tb-mono text-[11px] text-text-quiet">{item.ruleId}</span>
          </div>
          {item.file ? (
            <button
              type="button"
              className="mt-1 tb-mono text-[12px] text-accent hover:underline"
              onClick={() =>
                onInspect?.({
                  kind: "evidence",
                  items,
                  index,
                })
              }
            >
              {item.file}:{item.line}
            </button>
          ) : null}
          <p className="mt-1 text-[12px] text-text-secondary">{item.message}</p>
        </li>
      ))}
    </ul>
  );
}

function labelChipClass(label: StageRailLabel): string {
  switch (label) {
    case "current":
      return "tb-chip tb-chip-accent";
    case "accepted":
      return "tb-chip tb-chip-ok";
    case "failed":
    case "stopped":
      return "tb-chip tb-chip-warn";
    case "conditional":
      return "tb-chip";
    case "queued":
    default:
      return "tb-chip";
  }
}

export type StagePlanViewProps = {
  stages: readonly StagePlanStage[];
  stageIndex: number;
  phase: StageOperationPhase;
  selectedDomain?: string;
  pendingConditional?: {
    reason: string;
    status: string;
  };
  presentation: Presentation;
  /** True while the authorize mutation is in flight (local honest pending). */
  authorizePending: boolean;
  canAuthorize: boolean;
  busy: boolean;
  onAuthorize: () => void;
  onInspect?: (request: InspectRequest) => void;
  /** When true, hide the authorize control (e.g. durable progress or post-auth phases). */
  hideAuthorizeAction?: boolean;
};

export function StagePlanView({
  stages,
  stageIndex,
  phase,
  selectedDomain,
  pendingConditional,
  presentation,
  authorizePending,
  canAuthorize,
  busy,
  onAuthorize,
  onInspect,
  hideAuthorizeAction = false,
}: StagePlanViewProps) {
  const current = stages[stageIndex] ?? stages[0];
  const showAuthorizeGate =
    !hideAuthorizeAction && phase === "awaiting_authorization" && !authorizePending && canAuthorize;

  return (
    <div className="space-y-5" data-testid="stage-plan-view">
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
              modernization sequence
            </p>
            <h3 className="text-[15px] font-semibold text-ink">{presentation.heading}</h3>
          </div>
          {selectedDomain ? (
            <p className="text-[13px] text-text-secondary">
              Domain: <strong className="text-text-primary">{selectedDomain}</strong>
            </p>
          ) : null}
        </div>
        <p className="text-[13px] leading-relaxed text-text-secondary">
          {presentation.explanation}
        </p>
      </div>

      {pendingConditional ? (
        <div
          className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[13px] text-text-secondary"
          data-testid="pending-conditional-marker"
        >
          Pending conditional stage ({pendingConditional.status}): {pendingConditional.reason}.
          Insertion is decided only after Domain Module acceptance.
        </div>
      ) : null}

      <nav aria-label="Stage Plan order" data-testid="stage-plan-rail">
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {stages.map((stage, index) => {
            const { primary, modifiers } = stageRailLabel({
              index,
              stageIndex,
              conditional: stage.conditional,
              phase,
              stageCount: stages.length,
            });
            const isCurrent =
              primary === "current" || primary === "failed" || primary === "stopped";
            return (
              <li
                key={stage.id}
                className={`rounded-lg border px-3 py-2.5 ${
                  isCurrent
                    ? "border-accent bg-accent-soft/40"
                    : "border-border-subtle bg-surface-inset/30"
                }`}
                aria-current={isCurrent ? "step" : undefined}
                data-testid={`stage-rail-${stage.id}`}
                data-stage-label={primary}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
                    Stage {index + 1}
                  </span>
                  <span className={labelChipClass(primary)}>{primary}</span>
                  {modifiers.map((mod) => (
                    <span key={mod} className={labelChipClass(mod)}>
                      {mod}
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-[13px] font-medium text-ink">{stage.title}</p>
                <p className="tb-mono text-[11px] text-text-quiet">{stage.kind}</p>
              </li>
            );
          })}
        </ol>
      </nav>

      {current ? (
        <section
          className="tb-panel overflow-hidden border border-border-subtle"
          aria-labelledby="current-stage-plan-heading"
          data-testid="current-stage-plan"
        >
          <div className="tb-panel-head">
            <div className="min-w-0">
              <p className="tb-mono text-[10px] uppercase tracking-wide text-muted">
                current stage plan
              </p>
              <h4 id="current-stage-plan-heading" className="text-[14px] font-semibold text-ink">
                Stage {stageIndex + 1}: {current.title}
              </h4>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {current.conditional ? <span className="tb-chip">conditional</span> : null}
              <span className="tb-chip tb-chip-accent">{current.kind}</span>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div>
              <p className="text-[12px] font-medium text-text-primary">Purpose</p>
              <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
                {current.purpose}
              </p>
            </div>

            <div>
              <p className="text-[12px] font-medium text-text-primary">Evidence</p>
              <div className="mt-1.5">
                <StageEvidenceList items={current.evidence} onInspect={onInspect} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[12px] font-medium text-text-primary">
                  Expected files / path scope
                </p>
                <ul className="mt-1.5 space-y-1 tb-mono text-[12px] text-text-secondary">
                  {current.expectedFiles.length > 0 ? (
                    current.expectedFiles.map((file) => <li key={file}>{file}</li>)
                  ) : (
                    <li className="text-text-quiet">No expected files listed.</li>
                  )}
                </ul>
              </div>
              <div>
                <p className="text-[12px] font-medium text-text-primary">Budgets and limits</p>
                <ul className="mt-1.5 space-y-1 text-[12px] text-text-secondary">
                  <li>
                    Max operations:{" "}
                    <span className="tb-mono text-text-primary">
                      {current.budgets.maxOperations}
                    </span>
                  </li>
                  <li>
                    Max bytes per file:{" "}
                    <span className="tb-mono text-text-primary">
                      {formatBytes(current.budgets.maxBytesPerFile)}
                    </span>
                  </li>
                  <li>
                    Max total changed bytes:{" "}
                    <span className="tb-mono text-text-primary">
                      {formatBytes(current.budgets.maxTotalChangedBytes)}
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <p className="text-[12px] font-medium text-text-primary">Validation criteria</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[12px] text-text-secondary">
                {current.validationCriteria.map((criterion) => (
                  <li key={criterion.id}>
                    <span className="tb-mono text-[11px] uppercase text-text-quiet">
                      [{criterion.kind}]
                    </span>{" "}
                    {criterion.description}
                  </li>
                ))}
              </ul>
            </div>

            <p className="rounded-md border border-border-subtle bg-surface-inset/40 px-3 py-2 text-[12px] text-text-secondary">
              AI cannot change stage count, trigger outcome, or purpose. Authorization only permits
              bounded generation for this Stage Plan — it is not Change Acceptance.
            </p>

            {showAuthorizeGate ? (
              <div
                className="space-y-3 rounded-lg border border-accent/30 bg-accent-soft/30 p-3"
                data-testid="authorization-gate"
              >
                <div>
                  <p className="text-[13px] font-semibold text-ink">Authorize generation</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
                    Authorizing spends generation tokens inside this path envelope and runs
                    deterministic Static Validation. Accepting a Change Set is a separate later
                    decision after review.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onAuthorize}
                  className="tb-btn tb-btn-primary"
                  data-testid="authorize-stage-button"
                >
                  Authorize AI generation for this stage
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export type OperationStatusViewProps = {
  kind:
    | "authorize-pending"
    | "durable-generating"
    | "durable-validating"
    | "durable-repairing"
    | "validation-passed-review"
    | "validation-failed"
    | "rolled-back"
    | "sequence-stopped"
    | "completed-summary";
  presentation: Presentation;
  currentStageTitle?: string;
  stopReason?: string;
  acceptedChangeSetCount?: number;
  review?: ReviewReadiness;
  reviewSummary?: BoundedReviewSummary;
  downloadPath?: string;
  downloadAvailable?: boolean;
  /** Acceptance / rejection only when in review; never during pending authorize. */
  canAccept?: boolean;
  canReject?: boolean;
  busy?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
};

type ProgressStep = {
  id: string;
  label: string;
  state: "done" | "active" | "queued";
};

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function progressStepsFor(
  kind: Extract<
    OperationStatusViewProps["kind"],
    "authorize-pending" | "durable-generating" | "durable-validating" | "durable-repairing"
  >,
): readonly ProgressStep[] {
  if (kind === "authorize-pending") {
    // Single blocking request covers generation + validation; no live subphase feed.
    return [
      { id: "authorized", label: "Stage Plan authorized", state: "done" },
      { id: "generate", label: "AI generating bounded Change Set", state: "active" },
      { id: "validate", label: "Static Validation of proposal", state: "queued" },
      { id: "review", label: "Open review when ready", state: "queued" },
    ];
  }
  if (kind === "durable-generating") {
    return [
      { id: "authorized", label: "Stage Plan authorized", state: "done" },
      { id: "generate", label: "AI generating bounded Change Set", state: "active" },
      { id: "validate", label: "Static Validation of proposal", state: "queued" },
      { id: "review", label: "Open review when ready", state: "queued" },
    ];
  }
  if (kind === "durable-validating") {
    return [
      { id: "authorized", label: "Stage Plan authorized", state: "done" },
      { id: "generate", label: "AI generating bounded Change Set", state: "done" },
      { id: "validate", label: "Static Validation of proposal", state: "active" },
      { id: "review", label: "Open review when ready", state: "queued" },
    ];
  }
  return [
    { id: "authorized", label: "Stage Plan authorized", state: "done" },
    { id: "generate", label: "AI generating bounded Change Set", state: "done" },
    { id: "validate", label: "First validation failed — one repair", state: "done" },
    { id: "repair", label: "Repairing and re-validating", state: "active" },
    { id: "review", label: "Open review when ready", state: "queued" },
  ];
}

function ProgressActivityPanel({
  kind,
  currentStageTitle,
}: {
  kind: Extract<
    OperationStatusViewProps["kind"],
    "authorize-pending" | "durable-generating" | "durable-validating" | "durable-repairing"
  >;
  currentStageTitle?: string;
}) {
  const [elapsedSec, setElapsedSec] = useState(0);
  const steps = progressStepsFor(kind);
  const activeLabel = steps.find((step) => step.state === "active")?.label ?? "Working";

  useEffect(() => {
    setElapsedSec(0);
    const id = window.setInterval(() => {
      setElapsedSec((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [kind]);

  const detail =
    kind === "authorize-pending"
      ? "One request is in flight: generation and Static Validation run before the response returns. Acceptance stays locked until that finishes."
      : kind === "durable-generating"
        ? "Server phase is generating. No fabricated percentage is shown."
        : kind === "durable-validating"
          ? "Server phase is validating the proposed Change Set."
          : "Server phase is repairing after a failed validation attempt.";

  return (
    <div
      className="space-y-3 rounded-lg border border-accent-action/30 bg-accent-action/5 p-4"
      data-testid={
        kind === "authorize-pending" ? "honest-authorize-pending" : "durable-operation-terminal"
      }
      role="status"
      aria-busy="true"
      aria-label={activeLabel}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="tb-spinner" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-text-primary">{activeLabel}</p>
          <p className="mt-0.5 text-[12px] text-text-secondary">
            {currentStageTitle ? (
              <>
                Stage: <span className="font-medium text-text-primary">{currentStageTitle}</span>
                {" · "}
              </>
            ) : null}
            Elapsed <span className="tb-mono text-text-primary">{formatElapsed(elapsedSec)}</span>
          </p>
        </div>
        <span className="tb-chip tb-chip-accent" data-testid="progress-elapsed">
          working · {formatElapsed(elapsedSec)}
        </span>
      </div>

      <div className="tb-progress-track" data-testid="indeterminate-progress" aria-hidden>
        <div className="tb-progress-indeterminate" />
      </div>

      <ol className="space-y-2" data-testid="authorize-progress-steps">
        {steps.map((step) => (
          <li
            key={step.id}
            className="flex items-start gap-2 text-[12px]"
            data-step-state={step.state}
          >
            <span
              className={
                step.state === "done"
                  ? "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success/15 text-[10px] font-semibold text-success"
                  : step.state === "active"
                    ? "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-action text-[10px] font-semibold text-accent-action-foreground"
                    : "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border-subtle text-[10px] text-text-quiet"
              }
              aria-hidden
            >
              {step.state === "done" ? "✓" : step.state === "active" ? "…" : ""}
            </span>
            <span
              className={
                step.state === "active"
                  ? "font-medium text-text-primary"
                  : step.state === "done"
                    ? "text-text-secondary"
                    : "text-text-quiet"
              }
            >
              {step.label}
              {step.state === "active" ? <span className="sr-only"> (in progress)</span> : null}
            </span>
          </li>
        ))}
      </ol>

      <p className="text-[12px] leading-relaxed text-text-secondary">{detail}</p>
      <p className="tb-mono text-[11px] text-text-quiet" data-testid="honest-progress-note">
        status: generating_and_validating_authorized_stage · no live subphase, percentage, or
        polling feed is available
      </p>
    </div>
  );
}

export function OperationStatusView({
  kind,
  presentation,
  currentStageTitle,
  stopReason,
  acceptedChangeSetCount,
  review,
  reviewSummary,
  downloadPath,
  downloadAvailable,
  canAccept = false,
  canReject = false,
  busy = false,
  onAccept,
  onReject,
}: OperationStatusViewProps) {
  const isProgress =
    kind === "authorize-pending" ||
    kind === "durable-generating" ||
    kind === "durable-validating" ||
    kind === "durable-repairing";

  const toneChip =
    kind === "validation-passed-review"
      ? "tb-chip tb-chip-ok"
      : kind === "validation-failed" || kind === "rolled-back" || kind === "sequence-stopped"
        ? "tb-chip tb-chip-warn"
        : kind === "completed-summary"
          ? "tb-chip tb-chip-ok"
          : "tb-chip tb-chip-accent";

  const statusLabel = (() => {
    switch (kind) {
      case "authorize-pending":
        return "working";
      case "durable-generating":
        return "generating";
      case "durable-validating":
        return "validating";
      case "durable-repairing":
        return "repairing";
      case "validation-passed-review":
        return "validation passed";
      case "validation-failed":
        return "validation failed";
      case "rolled-back":
        return "rolled back";
      case "sequence-stopped":
        return "stopped";
      case "completed-summary":
        return "completed";
    }
  })();

  return (
    <section
      className="space-y-3"
      data-testid="operation-status"
      data-status-kind={kind}
      aria-live={isProgress ? "polite" : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
            operation status
          </p>
          <h3 className="text-[14px] font-semibold text-ink">{presentation.heading}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
            {presentation.explanation}
          </p>
          {currentStageTitle ? (
            <p className="mt-1 text-[12px] text-text-quiet">
              Authorized Stage Plan:{" "}
              <span className="text-text-secondary">{currentStageTitle}</span>
            </p>
          ) : null}
        </div>
        <span className={toneChip}>{statusLabel}</span>
      </div>

      {kind === "authorize-pending" ||
      kind === "durable-generating" ||
      kind === "durable-validating" ||
      kind === "durable-repairing" ? (
        <ProgressActivityPanel kind={kind} currentStageTitle={currentStageTitle} />
      ) : null}

      {kind === "validation-passed-review" || kind === "validation-failed" ? (
        <div className="space-y-3">
          {review ? (
            <p className="text-[12px] text-text-secondary" data-testid="review-readiness">
              {reviewReadinessCopy(review)}
            </p>
          ) : null}
          {reviewSummary ? (
            <div className="tb-terminal overflow-hidden" data-testid="review-totals-terminal">
              <pre className="overflow-x-auto p-3 tb-mono text-[11px] leading-relaxed text-terminal-fg">
                {`change_set: ${reviewSummary.changeSetId}
attempt: ${reviewSummary.attempt}
totals: +${reviewSummary.totals.created} ~${reviewSummary.totals.updated} -${reviewSummary.totals.deleted}
files_in_review: ${reviewSummary.fileCount}
validation: ${reviewSummary.validationOutcome ?? "unknown"}${
                  reviewSummary.externalTestsLabel
                    ? `\nexternal_tests: ${reviewSummary.externalTestsLabel}`
                    : ""
                }${
                  reviewSummary.truncationLabels && reviewSummary.truncationLabels.length > 0
                    ? `\ntruncation: ${reviewSummary.truncationLabels.join(", ")}`
                    : ""
                }
note: full Change Set workspace is a separate review step
note: authorization already completed; acceptance is independent`}
              </pre>
            </div>
          ) : (
            <div className="tb-terminal overflow-hidden" data-testid="review-missing-terminal">
              <pre className="overflow-x-auto p-3 tb-mono text-[11px] leading-relaxed text-terminal-fg">
                {`review_payload: missing_or_incomplete
acceptance: unavailable`}
              </pre>
            </div>
          )}
          <div className="flex flex-wrap gap-2" data-testid="acceptance-actions">
            {canAccept ? (
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
                Accept is unavailable until review data is complete and current.
              </p>
            )}
            {canReject ? (
              <button
                type="button"
                disabled={busy}
                onClick={onReject}
                className="tb-btn tb-btn-secondary"
                data-testid="reject-change-set-button"
              >
                Reject and stop
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {kind === "rolled-back" ? (
        <div className="tb-terminal overflow-hidden" data-testid="rollback-status">
          <pre className="overflow-x-auto p-3 tb-mono text-[11px] leading-relaxed text-terminal-fg">
            {`outcome: stage_failed_rolled_back
accepted_change_sets_retained: ${acceptedChangeSetCount ?? 0}
note: current accepted snapshot was kept; failed candidate output was not promoted`}
          </pre>
        </div>
      ) : null}

      {kind === "sequence-stopped" ? (
        <div className="tb-terminal overflow-hidden" data-testid="stopped-status">
          <pre className="overflow-x-auto p-3 tb-mono text-[11px] leading-relaxed text-terminal-fg">
            {`outcome: sequence_stopped
reason: ${stopReason ?? "unspecified"}
accepted_change_sets_retained: ${acceptedChangeSetCount ?? 0}
note: rejected or rolled-back output did not leak forward`}
          </pre>
        </div>
      ) : null}

      {kind === "completed-summary" ? (
        <div className="space-y-3 rounded-lg border border-accent/40 bg-accent-soft/40 p-3 text-[13px]">
          <p>
            Modernization Sequence completed with {acceptedChangeSetCount ?? 0} accepted Change
            Set(s).
          </p>
          {downloadAvailable && downloadPath ? (
            <a href={downloadPath} className="tb-btn tb-btn-primary">
              Download result ZIP
            </a>
          ) : null}
          <p className="text-[12px] text-text-quiet">
            ZIP contains repository/ (accepted snapshot only) and toolbox-validation-report.json.
            External generated tests: not executed.
          </p>
        </div>
      ) : null}

      {isProgress ? (
        <p className="text-[12px] text-text-quiet" data-testid="no-fabricated-progress">
          No percentage is claimed while this operation is unresolved. The bar is indeterminate
          activity only.
        </p>
      ) : null}
    </section>
  );
}
