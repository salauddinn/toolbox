"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { AssessmentDecision } from "./assessment/assessment-decision";
import { EvidenceInspector } from "./assessment/evidence-inspector";
import type { EvidenceInspectorState, InspectRequest } from "./assessment/evidence-types";
import { toInspectorState } from "./assessment/evidence-types";
import { GateFailure } from "./assessment/gate-failure";
import { resolveGuidedOutcome, resolveGuidedStep } from "./assessment/guided-flow";
import { GuidedShell } from "./assessment/guided-shell";
import {
  DURABLE_RUN_PHASES,
  presentationFor,
  type CandidateSelectionReadiness,
  type PresentationAction,
  type PresentationState,
  type ReviewReadiness,
} from "./assessment/presentation-state";
import { RepositoryStart, SupportedContractDetails } from "./assessment/repository-start";
import { ChangeSetReview } from "./assessment/change-set-review";
import { CompletionArtifact } from "./assessment/completion-artifact";
import { SequenceOutcome } from "./assessment/sequence-outcome";
import {
  OperationStatusView,
  StagePlanView,
  type StageOperationPhase,
  type StagePlanStage,
} from "./assessment/stage-plan-view";
import { useAssessmentRun } from "./assessment/use-assessment-run";
import { DependencyGraph, type GraphPayload } from "./dependency-graph";

function reviewReadiness(
  run: Extract<
    NonNullable<ReturnType<typeof useAssessmentRun>["run"]>,
    { phase: "awaiting_acceptance" }
  >,
  refreshingReview = false,
): ReviewReadiness {
  if (refreshingReview) return "loading";
  const review = run.reviewPayload;
  if (!review) return "incomplete";
  if (
    review.changeSetId !== run.changeSet.id ||
    review.attempt !== run.changeSet.attempt ||
    review.validationReport.changeSetId !== run.changeSet.id ||
    review.validationReport.stageId !== run.changeSet.stageId
  ) {
    return "stale";
  }
  if (
    review.validationReport.finalOutcome !== "passed" ||
    !review.validationReport.attempts.some(
      (attempt) => attempt.attempt === run.changeSet.attempt && attempt.passed,
    )
  ) {
    return "failed";
  }
  return "complete-current";
}

function presentationStateFor(
  run: ReturnType<typeof useAssessmentRun>["run"],
  pendingState: ReturnType<typeof useAssessmentRun>["pendingState"],
  operationError: ReturnType<typeof useAssessmentRun>["operationError"],
  blockedStart: ReturnType<typeof useAssessmentRun>["blockedStart"],
  pickedCandidateId: string | null,
  refreshingReview = false,
): PresentationState {
  if (pendingState) return { kind: "local", state: pendingState };
  if (blockedStart) return { kind: "local", state: "active-run-conflict" };
  if (operationError) {
    return {
      kind: "operation-error",
      step: operationError.step,
      operation: operationError.operation,
      retryable: operationError.retryable,
    };
  }
  if (!run) return { kind: "local", state: "no-run" };
  if (!DURABLE_RUN_PHASES.includes(run.phase)) return { kind: "unknown-phase", phase: run.phase };

  if (run.phase === "assessed") {
    const candidateSelection: CandidateSelectionReadiness =
      pickedCandidateId && run.readinessByCandidateId[pickedCandidateId]?.ready
        ? "ready"
        : pickedCandidateId
          ? "not-ready"
          : "none";
    return { kind: "run", phase: run.phase, candidateSelection };
  }
  if (run.phase === "awaiting_acceptance") {
    return { kind: "run", phase: run.phase, review: reviewReadiness(run, refreshingReview) };
  }
  return { kind: "run", phase: run.phase };
}

export function AssessmentApp() {
  const [url, setUrl] = useState("");
  const [inspector, setInspector] = useState<EvidenceInspectorState | null>(null);
  const inspectorTriggerRef = useRef<HTMLElement | null>(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  const [refreshingReview, setRefreshingReview] = useState(false);
  const assessment = useAssessmentRun();
  const { run, busy, error, blockedStart, pickedCandidateId, setPickedCandidateId } = assessment;
  const state = presentationStateFor(
    run,
    assessment.pendingState,
    assessment.operationError,
    blockedStart,
    pickedCandidateId,
    refreshingReview,
  );
  const presentation = presentationFor(state);
  const can = (action: PresentationAction) => presentation.actions.includes(action);
  const unknownPhase = state.kind === "unknown-phase";
  const gatePhase =
    run?.phase === "eligibility_failed" ||
    run?.phase === "safety_failed" ||
    run?.phase === "not_ready"
      ? run.phase
      : null;
  /** Terminal sequence/artifact screens own end-run confirmation and deletion recovery. */
  const outcomePhase =
    run?.phase === "stage_failed_rolled_back" ||
    run?.phase === "sequence_stopped" ||
    run?.phase === "completed"
      ? run.phase
      : null;

  const openInspect = useCallback((request: InspectRequest) => {
    const active = document.activeElement;
    inspectorTriggerRef.current =
      active instanceof HTMLElement && active !== document.body ? active : null;
    setInspector(toInspectorState(request));
  }, []);

  const closeInspector = useCallback(() => {
    setInspector(null);
  }, []);

  const navigateInspector = useCallback((index: number) => {
    setInspector((current) => {
      if (!current || current.mode !== "evidence") return current;
      const max = Math.max(0, current.items.length - 1);
      return {
        ...current,
        index: Math.min(Math.max(0, index), max),
      };
    });
  }, []);

  const graph: GraphPayload | null = useMemo(() => {
    if ((run?.phase !== "assessed" && run?.phase !== "not_ready") || !run.analysis?.graph) {
      return null;
    }
    return run.analysis.graph;
  }, [run]);

  const candidates =
    run?.phase === "assessed" || run?.phase === "not_ready" ? (run.ranking?.candidates ?? []) : [];
  const readinessMap =
    run?.phase === "assessed" || run?.phase === "not_ready" ? run.readinessByCandidateId : {};
  const sequence = run && "sequence" in run ? run.sequence : undefined;
  const stageIndex = run && "stageIndex" in run ? run.stageIndex : undefined;
  const selectedDomain =
    run && "selectedCandidate" in run ? run.selectedCandidate?.name : undefined;
  const currentStageTitle = run && "currentStage" in run ? run.currentStage.title : undefined;
  const validationReport = run && "validationReport" in run ? run.validationReport : undefined;
  const authorizePending = assessment.pendingState === "authorize-request-pending";
  const sequencePhases: readonly StageOperationPhase[] = [
    "awaiting_authorization",
    "generating",
    "validating",
    "repairing",
    "awaiting_acceptance",
    "stage_failed_rolled_back",
    "sequence_stopped",
    "completed",
  ];
  const isSequencePhase = run != null && sequencePhases.includes(run.phase as StageOperationPhase);
  const stagePlanStages: readonly StagePlanStage[] =
    sequence?.stages.map((stage) => ({
      id: stage.id,
      kind: stage.kind,
      title: stage.title,
      purpose: stage.purpose,
      conditional: stage.conditional,
      evidence: stage.evidence,
      expectedFiles: stage.expectedFiles,
      validationCriteria: stage.validationCriteria,
      budgets: stage.budgets,
    })) ?? [];
  const acceptanceReview =
    run?.phase === "awaiting_acceptance" ? reviewReadiness(run, refreshingReview) : undefined;

  async function refreshReview() {
    if (!run || run.phase !== "awaiting_acceptance" || refreshingReview) return;
    setRefreshingReview(true);
    try {
      await assessment.refresh();
    } finally {
      setRefreshingReview(false);
    }
  }

  const readinessFailures =
    run?.phase === "not_ready"
      ? candidates
          .map((candidate) => {
            const readiness = readinessMap[candidate.id];
            if (!readiness || readiness.ready) return null;
            return {
              candidateName: candidate.name,
              failedRules: readiness.failedRules ?? [],
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      : [];

  function requestEndRun() {
    if (!can("end_run")) return;
    setConfirmingEnd(true);
  }

  function performEndRun() {
    setConfirmingEnd(false);
    setConfirmingReplace(false);
    setInspector(null);
    void assessment.endCurrentRun();
  }

  const graphSection =
    graph != null ? (
      <div className="min-w-0 space-y-2">
        <h3 className="text-sm font-medium">Entry-reachable dependency graph</h3>
        <p className="text-xs text-muted">
          Supporting evidence only. Node and edge selection open available path/line file context —
          never fabricated evidence fields. Graph context is not the primary decision surface.
        </p>
        <DependencyGraph
          graph={graph}
          onSelectFileContext={(selection) =>
            openInspect({
              kind: "file-context",
              file: selection.file,
              line: selection.line,
              origin: "graph",
            })
          }
        />
      </div>
    ) : null;

  const currentStep = resolveGuidedStep({
    phase: run?.phase ?? null,
    localState:
      assessment.pendingState ?? (blockedStart ? "active-run-conflict" : !run ? "no-run" : null),
    unknownPhase,
  });
  const guidedOutcome = resolveGuidedOutcome(run?.phase ?? null);

  const guidedSubtitle = !run
    ? "Choose how to begin. We’ll guide you one step at a time."
    : gatePhase
      ? "This run stopped before modernization. Review the reason, then start over."
      : guidedOutcome === "rolled_back"
        ? "This stage failed validation and was rolled back. End the run to start over."
        : guidedOutcome === "stopped"
          ? "The sequence stopped. End the run to return to start."
          : presentation.explanation;

  const outcomeFooter =
    outcomePhase && can("end_run") ? (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-relaxed text-muted">
          {guidedOutcome === "rolled_back"
            ? "Rolled-back output was not accepted. End the run to continue."
            : "This run cannot continue. End it to return to repository start."}
        </p>
        {confirmingEnd ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Confirm end run">
            <button
              type="button"
              disabled={busy}
              onClick={performEndRun}
              className="tb-btn tb-btn-primary h-11 min-h-11 px-4 text-[13px] font-semibold"
            >
              Confirm end run
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmingEnd(false)}
              className="tb-btn tb-btn-ghost h-11 min-h-11 px-4 text-[13px]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={requestEndRun}
            className="tb-btn tb-btn-primary h-11 min-h-11 px-4 text-[13px] font-semibold"
            data-testid="guided-outcome-end-run"
          >
            End run / Start over
          </button>
        )}
      </div>
    ) : null;

  const headerActions = (
    <>
      {run ? (
        <>
          <span className="tb-chip">run: {run.runId.slice(0, 10)}…</span>
          {can("end_run") ? (
            confirmingEnd && !gatePhase && !outcomePhase ? (
              <div
                className="flex flex-wrap items-center gap-2"
                role="group"
                aria-label="Confirm end run"
              >
                <button
                  type="button"
                  disabled={busy}
                  onClick={performEndRun}
                  className="tb-btn tb-btn-primary h-9 min-h-11 px-3 text-[13px]"
                >
                  Confirm end run
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmingEnd(false)}
                  className="tb-btn tb-btn-ghost h-9 min-h-11 px-3 text-[13px]"
                >
                  Cancel
                </button>
              </div>
            ) : !gatePhase && !outcomePhase ? (
              <button
                type="button"
                disabled={busy}
                onClick={requestEndRun}
                className="tb-btn tb-btn-secondary h-9 min-h-11 px-3 text-[13px]"
              >
                End run / Start over
              </button>
            ) : null
          ) : null}
        </>
      ) : (
        <>
          <span className="tb-chip">no active run</span>
          <Link href="/" className="tb-btn tb-btn-ghost h-9 min-h-11 px-3 text-[13px]">
            Product page
          </Link>
        </>
      )}
    </>
  );

  return (
    <div className="min-w-0">
      <div inert={inspector ? true : undefined} className="min-w-0">
        <GuidedShell
          currentStep={currentStep}
          outcome={guidedOutcome}
          title={unknownPhase ? presentation.heading : undefined}
          subtitle={guidedSubtitle}
          actions={headerActions}
          footer={outcomeFooter}
        >
          {!run ? (
            <RepositoryStart
              url={url}
              onUrlChange={setUrl}
              busy={busy}
              error={error}
              blockedStart={blockedStart}
              confirmingReplace={confirmingReplace}
              onConfirmingReplaceChange={setConfirmingReplace}
              onStartFixture={() => void assessment.startFixture()}
              onStartGithub={(nextUrl) => void assessment.startGithub(nextUrl)}
              onReplacePreviousRun={() => void assessment.replacePreviousRun()}
              onDismissConflict={() => assessment.dismissStartConflict()}
            />
          ) : null}

          {run ? <SupportedContractDetails defaultOpen={false} /> : null}

          {run && error && !gatePhase ? (
            <div className="tb-panel overflow-hidden" role="alert">
              <div className="tb-panel-head">
                <p className="text-[13px] font-semibold text-danger">
                  {assessment.operationError
                    ? presentation.heading
                    : "The requested action did not complete"}
                </p>
                <span className="tb-chip tb-chip-warn">preserved</span>
              </div>
              <div className="tb-terminal overflow-hidden border-0 border-t border-terminal-border">
                <pre className="overflow-x-auto p-3 tb-mono text-[11px] leading-relaxed text-terminal-fg">
                  {error}
                </pre>
              </div>
            </div>
          ) : null}
          {run && busy ? (
            <p className="tb-mono text-[11px] text-muted" aria-live="polite">
              working…
            </p>
          ) : null}

          {run && unknownPhase ? (
            <section className="tb-panel p-5 sm:p-6" role="alert">
              <h2 className="text-[15px] font-semibold text-ink">{presentation.heading}</h2>
              <p className="mt-2 text-sm text-muted">{presentation.explanation}</p>
              <p className="mt-3 text-[12px] text-text-quiet">
                No unsupported mutations are offered for this phase.
              </p>
            </section>
          ) : null}

          {run && run.phase === "eligibility_failed" ? (
            <GateFailure
              kind="eligibility_failed"
              presentation={presentation}
              sourceLabel={run.sourceLabel}
              rejections={run.eligibility.rejections}
              busy={busy}
              confirmingEnd={confirmingEnd}
              onConfirmingEndChange={setConfirmingEnd}
              onEndRun={performEndRun}
              onInspect={openInspect}
            />
          ) : null}

          {run && run.phase === "safety_failed" ? (
            <GateFailure
              kind="safety_failed"
              presentation={presentation}
              sourceLabel={run.sourceLabel}
              rejections={run.safety.rejections}
              busy={busy}
              confirmingEnd={confirmingEnd}
              onConfirmingEndChange={setConfirmingEnd}
              onEndRun={performEndRun}
              onInspect={openInspect}
            />
          ) : null}

          {run && run.phase === "not_ready" ? (
            <>
              <GateFailure
                kind="not_ready"
                presentation={presentation}
                sourceLabel={run.sourceLabel}
                readinessFailures={readinessFailures}
                busy={busy}
                confirmingEnd={confirmingEnd}
                onConfirmingEndChange={setConfirmingEnd}
                onEndRun={performEndRun}
                onInspect={openInspect}
              />
              <section className="tb-panel space-y-6 overflow-hidden p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-[15px] font-semibold text-ink">
                    Assessment evidence (read-only)
                  </h2>
                  <p className="tb-mono text-[11px] text-muted">phase={run.phase}</p>
                </div>

                <AssessmentDecision
                  sourceLabel={run.sourceLabel}
                  entryPath={run.analysis?.entryPath ?? "—"}
                  routeCount={run.analysis?.routeCount ?? 0}
                  modelCount={run.analysis?.modelCount ?? 0}
                  cycleCount={graph?.cycles.length ?? 0}
                  candidates={candidates}
                  readinessByCandidateId={readinessMap}
                  safestTechnicalCandidateId={run.ranking?.safestTechnicalCandidateId}
                  pickedCandidateId={pickedCandidateId}
                  onPickCandidate={setPickedCandidateId}
                  allowConfirmation={false}
                  canConfirm={false}
                  busy={busy}
                  onConfirm={() => undefined}
                  onInspect={openInspect}
                />

                {graphSection}
              </section>
            </>
          ) : null}

          {run && !unknownPhase && !gatePhase ? (
            <section className="tb-panel min-w-0 space-y-6 overflow-hidden p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[15px] font-semibold text-ink">Assessment detail</h2>
                <p className="tb-mono text-[11px] text-muted">phase={run.phase}</p>
              </div>

              {run.phase === "assessed" ? (
                <>
                  <AssessmentDecision
                    sourceLabel={run.sourceLabel}
                    entryPath={run.analysis?.entryPath ?? "—"}
                    routeCount={run.analysis?.routeCount ?? 0}
                    modelCount={run.analysis?.modelCount ?? 0}
                    cycleCount={graph?.cycles.length ?? 0}
                    candidates={candidates}
                    readinessByCandidateId={readinessMap}
                    safestTechnicalCandidateId={run.ranking?.safestTechnicalCandidateId}
                    pickedCandidateId={pickedCandidateId}
                    onPickCandidate={setPickedCandidateId}
                    allowConfirmation={can("select_candidate") || can("confirm_candidate")}
                    canConfirm={can("confirm_candidate")}
                    busy={busy}
                    onConfirm={() => void assessment.confirmSelection()}
                    onInspect={openInspect}
                  />

                  {graphSection}
                </>
              ) : null}

              {run.phase === "candidate_selected" ? (
                <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-inset/40 p-4">
                  <h3 className="text-[14px] font-semibold text-ink">{presentation.heading}</h3>
                  <p className="text-[13px] leading-relaxed text-text-secondary">
                    {presentation.explanation}
                  </p>
                  {"selectedCandidate" in run && run.selectedCandidate ? (
                    <p className="text-[13px] text-text-primary">
                      Confirmed Domain Candidate: <strong>{run.selectedCandidate.name}</strong>
                    </p>
                  ) : null}
                  <p className="text-[12px] text-text-quiet">
                    No Stage Plan is assumed until the server exposes a sequence for this decision.
                  </p>
                </div>
              ) : null}

              {isSequencePhase ? (
                <div className="space-y-6">
                  {stagePlanStages.length > 0 && stageIndex != null ? (
                    <StagePlanView
                      stages={stagePlanStages}
                      stageIndex={stageIndex}
                      phase={run.phase as StageOperationPhase}
                      selectedDomain={selectedDomain}
                      pendingConditional={sequence?.pendingConditional}
                      presentation={
                        authorizePending
                          ? presentationFor({ kind: "local", state: "authorize-request-pending" })
                          : run.phase === "awaiting_authorization"
                            ? presentation
                            : presentationFor({ kind: "run", phase: "awaiting_authorization" })
                      }
                      authorizePending={authorizePending}
                      canAuthorize={can("authorize_stage")}
                      busy={busy}
                      onAuthorize={() => void assessment.authorize()}
                      onInspect={openInspect}
                      hideAuthorizeAction={
                        authorizePending ||
                        run.phase === "generating" ||
                        run.phase === "validating" ||
                        run.phase === "repairing" ||
                        run.phase === "awaiting_acceptance" ||
                        run.phase === "stage_failed_rolled_back" ||
                        run.phase === "sequence_stopped" ||
                        run.phase === "completed"
                      }
                    />
                  ) : null}

                  {authorizePending ? (
                    <OperationStatusView
                      kind="authorize-pending"
                      presentation={presentationFor({
                        kind: "local",
                        state: "authorize-request-pending",
                      })}
                      currentStageTitle={currentStageTitle}
                    />
                  ) : null}

                  {!authorizePending && run.phase === "generating" ? (
                    <OperationStatusView
                      kind="durable-generating"
                      presentation={presentation}
                      currentStageTitle={currentStageTitle}
                    />
                  ) : null}

                  {!authorizePending && run.phase === "validating" ? (
                    <OperationStatusView
                      kind="durable-validating"
                      presentation={presentation}
                      currentStageTitle={currentStageTitle}
                    />
                  ) : null}

                  {!authorizePending && run.phase === "repairing" ? (
                    <OperationStatusView
                      kind="durable-repairing"
                      presentation={presentation}
                      currentStageTitle={currentStageTitle}
                    />
                  ) : null}

                  {!authorizePending && run.phase === "awaiting_acceptance" ? (
                    <ChangeSetReview
                      presentation={presentation}
                      review={acceptanceReview ?? "incomplete"}
                      reviewPayload={run.reviewPayload}
                      currentStageTitle={currentStageTitle}
                      canAccept={can("accept_change_set")}
                      canReject={can("reject_change_set")}
                      busy={busy || refreshingReview}
                      onAccept={() => void assessment.accept()}
                      onReject={() => void assessment.reject()}
                      onRefreshReview={() => void refreshReview()}
                    />
                  ) : null}

                  {!authorizePending && run.phase === "stage_failed_rolled_back" ? (
                    <SequenceOutcome
                      kind="stage_failed_rolled_back"
                      presentation={presentation}
                      sourceLabel={"sourceLabel" in run ? run.sourceLabel : undefined}
                      selectedCandidateName={selectedDomain}
                      currentStageTitle={currentStageTitle}
                      acceptedChangeSetCount={run.acceptedChangeSetCount}
                      validationReport={validationReport}
                      busy={busy}
                      confirmingEnd={confirmingEnd}
                      onConfirmingEndChange={setConfirmingEnd}
                      onEndRun={performEndRun}
                      endError={assessment.operationError?.operation === "end-run" ? error : null}
                    />
                  ) : null}

                  {!authorizePending && run.phase === "sequence_stopped" ? (
                    <SequenceOutcome
                      kind="sequence_stopped"
                      presentation={presentation}
                      sourceLabel={"sourceLabel" in run ? run.sourceLabel : undefined}
                      selectedCandidateName={selectedDomain}
                      currentStageTitle={currentStageTitle}
                      acceptedChangeSetCount={run.acceptedChangeSetCount}
                      validationReport={validationReport}
                      stopReason={run.reason}
                      busy={busy}
                      confirmingEnd={confirmingEnd}
                      onConfirmingEndChange={setConfirmingEnd}
                      onEndRun={performEndRun}
                      endError={assessment.operationError?.operation === "end-run" ? error : null}
                    />
                  ) : null}

                  {!authorizePending && run.phase === "completed" ? (
                    <CompletionArtifact
                      presentation={presentation}
                      sourceLabel={"sourceLabel" in run ? run.sourceLabel : undefined}
                      selectedCandidateName={selectedDomain}
                      acceptedChangeSetCount={run.acceptedChangeSetCount}
                      validationReports={"validationReports" in run ? run.validationReports : []}
                      downloadAvailable={run.downloadAvailable}
                      downloadPath={run.downloadPath}
                      busy={busy}
                      confirmingEnd={confirmingEnd}
                      onConfirmingEndChange={setConfirmingEnd}
                      onEndRun={performEndRun}
                      endError={assessment.operationError?.operation === "end-run" ? error : null}
                    />
                  ) : null}

                  {run.phase !== "stage_failed_rolled_back" &&
                  run.phase !== "sequence_stopped" &&
                  run.phase !== "completed" ? (
                    <p className="text-[12px] text-text-quiet">
                      Authorization and Change Acceptance are separate controls. Only Change
                      Acceptance promotes the validated candidate snapshot.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}
        </GuidedShell>
      </div>

      <EvidenceInspector
        state={inspector}
        onClose={closeInspector}
        onNavigate={navigateInspector}
        triggerRef={inspectorTriggerRef}
        fallbackFocusId="assessment-workspace-heading"
      />
    </div>
  );
}
