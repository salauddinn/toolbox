"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { AssessmentDecision } from "./assessment/assessment-decision";
import { EvidenceInspector } from "./assessment/evidence-inspector";
import type {
  EvidenceInspectorState,
  EvidenceRecord,
  InspectRequest,
} from "./assessment/evidence-types";
import { toInspectorState } from "./assessment/evidence-types";
import { GateFailure } from "./assessment/gate-failure";
import {
  DURABLE_RUN_PHASES,
  presentationFor,
  type CandidateSelectionReadiness,
  type PresentationAction,
  type PresentationState,
  type ReviewReadiness,
} from "./assessment/presentation-state";
import { RepositoryStart, SupportedContractDetails } from "./assessment/repository-start";
import { useAssessmentRun } from "./assessment/use-assessment-run";
import { DependencyGraph, type GraphPayload } from "./dependency-graph";

function EvidenceList({
  items,
  onInspect,
}: {
  items: readonly EvidenceRecord[];
  onInspect?: (request: InspectRequest) => void;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-muted">No evidence attached.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((e, index) => (
        <li
          key={`${e.ruleId}-${e.file}-${e.line}-${index}`}
          className="rounded-md border border-border bg-background p-2 text-xs"
        >
          <button
            type="button"
            className="font-mono text-accent hover:underline"
            onClick={() =>
              onInspect?.({
                kind: "evidence",
                items,
                index,
              })
            }
          >
            {e.file}:{e.line}
          </button>
          <p className="mt-1 text-foreground">{e.message}</p>
          {e.snippet ? (
            <pre className="mt-1 overflow-x-auto rounded bg-surface p-2 text-[11px] text-muted">
              {e.snippet}
            </pre>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function reviewReadiness(
  run: Extract<
    NonNullable<ReturnType<typeof useAssessmentRun>["run"]>,
    { phase: "awaiting_acceptance" }
  >,
): ReviewReadiness {
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
    return { kind: "run", phase: run.phase, review: reviewReadiness(run) };
  }
  return { kind: "run", phase: run.phase };
}

export function AssessmentApp() {
  const [url, setUrl] = useState("");
  const [inspector, setInspector] = useState<EvidenceInspectorState | null>(null);
  const inspectorTriggerRef = useRef<HTMLElement | null>(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  const assessment = useAssessmentRun();
  const { run, busy, error, blockedStart, pickedCandidateId, setPickedCandidateId } = assessment;
  const state = presentationStateFor(
    run,
    assessment.pendingState,
    assessment.operationError,
    blockedStart,
    pickedCandidateId,
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
    run?.phase === "assessed" || run?.phase === "not_ready" ? run.ranking.candidates : [];
  const readinessMap =
    run?.phase === "assessed" || run?.phase === "not_ready" ? run.readinessByCandidateId : {};
  const sequence = run && "sequence" in run ? run.sequence : undefined;
  const stageIndex = run && "stageIndex" in run ? run.stageIndex : undefined;
  const selectedDomain =
    run && "selectedCandidate" in run ? run.selectedCandidate?.name : undefined;
  const currentStageTitle = run && "currentStage" in run ? run.currentStage.title : undefined;
  const validationReport = run && "validationReport" in run ? run.validationReport : undefined;

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

  return (
    <div className="min-w-0 space-y-4">
      <div inert={inspector ? true : undefined} className="min-w-0 space-y-4">
        <section className="tb-panel overflow-hidden">
          <div className="tb-panel-head">
            <div className="min-w-0">
              <p className="tb-mono text-[10px] uppercase tracking-wide text-muted">work console</p>
              <h1
                id="assessment-workspace-heading"
                tabIndex={-1}
                className="truncate text-[14px] font-semibold text-ink outline-none"
              >
                {run ? "Modernization Assessment" : "Start assessment"}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {run ? (
                <>
                  <span
                    className={`tb-chip ${
                      gatePhase
                        ? "tb-chip-warn"
                        : unknownPhase
                          ? ""
                          : run.phase === "completed"
                            ? "tb-chip-ok"
                            : "tb-chip-accent"
                    }`}
                  >
                    phase: {run.phase}
                  </span>
                  <span className="tb-chip">run: {run.runId.slice(0, 10)}…</span>
                  {can("end_run") ? (
                    confirmingEnd && !gatePhase ? (
                      <div
                        className="flex flex-wrap items-center gap-2"
                        role="group"
                        aria-label="Confirm end run"
                      >
                        <button
                          type="button"
                          disabled={busy}
                          onClick={performEndRun}
                          className="tb-btn tb-btn-primary h-8 px-2.5 text-[12px]"
                        >
                          Confirm end run
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirmingEnd(false)}
                          className="tb-btn tb-btn-ghost h-8 px-2.5 text-[12px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : !gatePhase ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={requestEndRun}
                        className="tb-btn tb-btn-secondary h-8 px-2.5 text-[12px]"
                      >
                        End run / Start over
                      </button>
                    ) : null
                  ) : null}
                  {!unknownPhase && !gatePhase ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void assessment.startFixture()}
                      className="tb-btn tb-btn-primary h-8 px-2.5 text-[12px]"
                    >
                      Retry example
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <span className="tb-chip">no active run</span>
                  <Link href="/" className="tb-btn tb-btn-ghost h-8 px-2.5 text-[12px]">
                    Product page
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>

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
                entryPath={run.analysis.entryPath}
                routeCount={run.analysis.routeCount}
                modelCount={run.analysis.modelCount}
                cycleCount={graph?.cycles.length ?? 0}
                candidates={candidates}
                readinessByCandidateId={readinessMap}
                safestTechnicalCandidateId={run.ranking.safestTechnicalCandidateId}
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

            {run.phase === "awaiting_authorization" ||
            run.phase === "generating" ||
            run.phase === "validating" ||
            run.phase === "awaiting_acceptance" ||
            run.phase === "sequence_stopped" ||
            run.phase === "completed" ||
            run.phase === "stage_failed_rolled_back" ? (
              <div className="space-y-4">
                <p className="text-sm">
                  Selected domain: <strong>{selectedDomain ?? currentStageTitle}</strong>
                </p>
                {run.phase === "sequence_stopped" ? (
                  <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
                    Sequence stopped ({run.reason}). Current snapshot was kept; rejected or
                    rolled-back output did not leak forward.
                  </p>
                ) : null}
                {run.phase === "completed" ? (
                  <div className="space-y-3 rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm">
                    <p>
                      Modernization Sequence completed with {run.acceptedChangeSetCount} accepted
                      Change Set(s).
                    </p>
                    {run.downloadAvailable && run.downloadPath ? (
                      <a href={run.downloadPath} className="tb-btn tb-btn-primary">
                        Download result ZIP
                      </a>
                    ) : null}
                    <p className="text-xs text-muted">
                      ZIP contains repository/ (accepted snapshot only) and
                      toolbox-validation-report.json. External generated tests: not executed.
                    </p>
                  </div>
                ) : null}
                {sequence?.pendingConditional ? (
                  <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                    Pending conditional stage: {sequence.pendingConditional.reason}. Final insertion
                    is decided only after Domain Module acceptance.
                  </p>
                ) : null}
                <ol className="space-y-3">
                  {sequence?.stages.map((stage, index) => (
                    <li
                      key={stage.id}
                      className={`rounded-lg border p-4 ${
                        index === stageIndex ? "border-accent" : "border-border"
                      }`}
                    >
                      <p className="text-xs text-muted">
                        Stage {index + 1}
                        {stage.conditional ? " · conditional" : ""}
                        {index === stageIndex ? " · current" : ""}
                      </p>
                      <h4 className="font-medium">{stage.title}</h4>
                      <p className="mt-1 text-sm text-muted">{stage.purpose}</p>
                      <p className="mt-2 text-xs font-medium">Expected files</p>
                      <ul className="font-mono text-xs text-muted">
                        {stage.expectedFiles.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs font-medium">Validation criteria</p>
                      <ul className="list-disc pl-5 text-xs text-muted">
                        {stage.validationCriteria.map((c) => (
                          <li key={c.id}>
                            [{c.kind}] {c.description}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2">
                        <p className="mb-1 text-xs font-medium">Evidence</p>
                        <EvidenceList items={stage.evidence} onInspect={openInspect} />
                      </div>
                    </li>
                  ))}
                </ol>

                {run.phase === "awaiting_authorization" && can("authorize_stage") ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void assessment.authorize()}
                    className="tb-btn tb-btn-primary"
                  >
                    Authorize AI generation for this stage
                  </button>
                ) : null}

                {run.phase === "awaiting_acceptance" ? (
                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <p className="text-sm font-medium">
                      AI-generated, validated Change Set — review before acceptance
                    </p>
                    <p className="text-xs text-muted">
                      Attempt {run.changeSet?.attempt} · {run.changeSet?.operations?.length ?? 0}{" "}
                      operations · candidate files {run.candidateFileCount}
                    </p>
                    {run.validationReport?.externalTestsLabel === "not_executed" ? (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        External generated tests: not executed
                      </p>
                    ) : null}
                    {run.reviewPayload ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium">
                          Candidate snapshot diff (+{run.reviewPayload.totals.created} ~
                          {run.reviewPayload.totals.updated} −{run.reviewPayload.totals.deleted})
                        </p>
                        <ul className="max-h-56 space-y-2 overflow-auto text-xs">
                          {run.reviewPayload.files.map((f) => (
                            <li
                              key={`${f.kind}-${f.path}`}
                              className="rounded border border-border p-2"
                            >
                              <p className="font-mono">
                                {f.kind} {f.path}
                              </p>
                              {f.beforePreview ? (
                                <pre className="mt-1 max-h-24 overflow-auto bg-background p-1 text-[10px] text-muted">
                                  − {f.beforePreview}
                                </pre>
                              ) : null}
                              {f.afterPreview ? (
                                <pre className="mt-1 max-h-24 overflow-auto bg-background p-1 text-[10px] text-muted">
                                  + {f.afterPreview}
                                </pre>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <ul className="max-h-40 overflow-auto font-mono text-xs text-muted">
                      {(run.changeSet?.operations ?? []).map(
                        (op: { type: string; path: string; bytes?: number }, i: number) => (
                          <li key={`${op.type}-${op.path}-${i}`}>
                            {op.type} {op.path}
                            {op.bytes != null ? ` (${op.bytes} B)` : ""}
                          </li>
                        ),
                      )}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                      {can("accept_change_set") ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void assessment.accept()}
                          className="tb-btn tb-btn-primary"
                        >
                          Accept Change Set
                        </button>
                      ) : null}
                      {can("reject_change_set") ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void assessment.reject()}
                          className="tb-btn tb-btn-secondary"
                        >
                          Reject and stop
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {validationReport ? (
                  <div className="rounded-lg border border-border p-3 text-xs">
                    <p className="font-medium">Validation Report</p>
                    <p className="text-muted">final: {validationReport.finalOutcome}</p>
                    <ul className="mt-2 space-y-1">
                      {(validationReport.attempts ?? []).map((a) => (
                        <li key={a.attempt}>
                          Attempt {a.attempt}: {a.passed ? "passed" : "failed"} (
                          {a.checks?.filter((c) => c.outcome === "failed").length ?? 0} failures)
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <p className="text-xs text-muted">
                  AI cannot change stage count, trigger outcome, or purpose. Only Change Acceptance
                  promotes the candidate snapshot.
                </p>
              </div>
            ) : null}
          </section>
        ) : null}
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
