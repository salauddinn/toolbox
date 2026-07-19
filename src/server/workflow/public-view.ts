import type { AnalysisResult, DependencyEdge } from "@/core/analysis";
import type { DomainCandidate } from "@/core/candidates";
import type { Evidence } from "@/core/evidence";
import type { TransformationReadiness } from "@/core/readiness";
import type { RunState } from "@/core/run-state";
import { orderedStages } from "@/core/run-state";
import type { ModernizationSequencePlan, StagePlan } from "@/core/stages";
import { buildReviewPayload } from "./review-payload";

function publicEvidence(e: Evidence) {
  return {
    ruleId: e.ruleId,
    message: e.message,
    severity: e.severity,
    file: e.file,
    line: e.line,
    snippet: e.snippet,
  };
}

function publicCandidate(c: DomainCandidate) {
  return {
    id: c.id,
    name: c.name,
    technicalScore: c.technicalScore,
    confidence: c.confidence,
    routes: c.routes.map((r) => ({
      method: r.method,
      path: r.path,
      file: r.file,
      line: r.line,
      mountPrefix: r.mountPrefix,
    })),
    primaryModel: c.primaryModel
      ? {
          modelName: c.primaryModel.modelName,
          collectionName: c.primaryModel.collectionName,
          file: c.primaryModel.file,
          line: c.primaryModel.line,
        }
      : undefined,
    files: c.files,
    signals: c.signals.map(publicEvidence),
    conflictingEvidence: c.conflictingEvidence.map(publicEvidence),
  };
}

function publicReadiness(r: TransformationReadiness) {
  if (r.ready) {
    return {
      ready: true as const,
      candidateId: r.candidateId,
      rules: r.rules.map((rule) => ({
        ruleId: rule.ruleId,
        passed: true as const,
        summary: rule.summary,
        evidence: rule.evidence.map(publicEvidence),
      })),
    };
  }
  return {
    ready: false as const,
    candidateId: r.candidateId,
    rules: r.rules.map((rule) => ({
      ruleId: rule.ruleId,
      passed: rule.passed,
      summary: rule.summary,
      evidence: rule.evidence.map(publicEvidence),
    })),
    failedRules: r.failedRules.map((rule) => ({
      ruleId: rule.ruleId,
      passed: false as const,
      summary: rule.summary,
      evidence: rule.evidence.map(publicEvidence),
    })),
  };
}

function publicGraph(analysis: AnalysisResult) {
  const edges: DependencyEdge[] = analysis.graph.edges.filter(
    (e) => analysis.graph.entryReachable.has(e.from) || analysis.graph.entryReachable.has(e.to),
  );
  const nodeSet = new Set<string>();
  for (const n of analysis.graph.entryReachable) nodeSet.add(n);
  for (const e of edges) {
    nodeSet.add(e.from);
    nodeSet.add(e.to);
  }
  return {
    nodes: [...nodeSet].sort(),
    edges: edges.map((e) => ({ from: e.from, to: e.to, line: e.line })),
    cycles: analysis.graph.cycles.map((c) => ({
      files: c.files,
      edges: c.edges.map((e) => ({ from: e.from, to: e.to, line: e.line })),
    })),
    entryPath: analysis.entryPath,
  };
}

function publicStage(stage: StagePlan) {
  return {
    id: stage.id,
    kind: stage.kind,
    title: stage.title,
    purpose: stage.purpose,
    conditional: stage.conditional,
    evidence: stage.evidence.map(publicEvidence),
    expectedFiles: stage.expectedFiles,
    validationCriteria: stage.validationCriteria,
    budgets: stage.budgets,
  };
}

function publicSequence(sequence: ModernizationSequencePlan) {
  return {
    stages: orderedStages(sequence).map(publicStage),
    pendingConditional: sequence.pendingConditional
      ? {
          kind: sequence.pendingConditional.kind,
          reason: sequence.pendingConditional.reason,
          status: sequence.pendingConditional.status,
          evidence: sequence.pendingConditional.evidence.map(publicEvidence),
        }
      : undefined,
    hasConditionalStage: Boolean(sequence.conditionalStage),
  };
}

function publicKnownBlockers(state: RunState) {
  return (state.knownBlockers ?? []).map((blocker) => ({
    stageId: blocker.stageId,
    stageKind: blocker.stageKind,
    title: blocker.title,
    reason: blocker.reason,
  }));
}

function readinessRecord(
  map: ReadonlyMap<string, TransformationReadiness>,
): Record<string, ReturnType<typeof publicReadiness>> {
  const out: Record<string, ReturnType<typeof publicReadiness>> = {};
  for (const [id, r] of map) {
    out[id] = publicReadiness(r);
  }
  return out;
}

/**
 * Client-safe run projection. Never includes raw snapshot file contents or secrets.
 */
export function toPublicRunView(state: RunState) {
  const base = {
    runId: state.runId,
    phase: state.phase,
    createdAt: state.createdAt,
    lastActiveAt: state.lastActiveAt,
    manualRepairRetries: state.manualRepairRetries ?? 0,
  };

  switch (state.phase) {
    case "created":
    case "expired":
      return base;
    case "loading":
      return { ...base, sourceLabel: state.sourceLabel };
    case "eligibility_failed":
      return {
        ...base,
        sourceLabel: state.sourceLabel,
        eligibility: state.eligibility,
      };
    case "safety_failed":
      return {
        ...base,
        sourceLabel: state.sourceLabel,
        safety: state.safety,
      };
    case "assessed":
    case "not_ready":
      return {
        ...base,
        sourceLabel: state.snapshot.sourceLabel,
        analysis: {
          entryPath: state.analysis.entryPath,
          runtime: state.analysis.runtime,
          routeCount: state.analysis.routes.length,
          modelCount: state.analysis.models.length,
          findings: state.analysis.findings.map((f) => ({
            id: f.id,
            title: f.title,
            summary: f.summary,
            remediation: f.remediation,
            evidence: f.evidence.map(publicEvidence),
          })),
          graph: publicGraph(state.analysis),
        },
        ranking: {
          candidates: state.ranking.candidates.map(publicCandidate),
          safestTechnicalCandidateId: state.ranking.safestTechnicalCandidateId,
        },
        readinessByCandidateId: readinessRecord(state.readinessByCandidateId),
        assessmentOnly: state.phase === "not_ready",
      };
    case "candidate_selected":
      return {
        ...base,
        sourceLabel: state.snapshot.sourceLabel,
        ranking: {
          candidates: state.ranking.candidates.map(publicCandidate),
          safestTechnicalCandidateId: state.ranking.safestTechnicalCandidateId,
        },
        readinessByCandidateId: readinessRecord(state.readinessByCandidateId),
        selectedCandidate: publicCandidate(state.selectedCandidate),
        selectedReadiness: publicReadiness(state.selectedReadiness),
        modernizationIntent: state.modernizationIntent,
      };
    case "awaiting_authorization":
    case "generating":
    case "validating":
    case "repairing":
    case "stage_failed_rolled_back":
      return {
        ...base,
        sourceLabel: state.snapshot.sourceLabel,
        selectedCandidate: publicCandidate(state.selectedCandidate),
        sequence: publicSequence(state.sequence),
        stageIndex: state.stageIndex,
        currentStage: publicStage(state.currentStage),
        acceptedChangeSetCount: state.acceptedChangeSets.length,
        knownBlockers: publicKnownBlockers(state),
        validationReport:
          state.phase === "stage_failed_rolled_back" ? state.validationReport : undefined,
      };
    case "awaiting_acceptance": {
      const reviewPayload = buildReviewPayload(state);
      return {
        ...base,
        sourceLabel: state.snapshot.sourceLabel,
        selectedCandidate: publicCandidate(state.selectedCandidate),
        sequence: publicSequence(state.sequence),
        stageIndex: state.stageIndex,
        currentStage: publicStage(state.currentStage),
        acceptedChangeSetCount: state.acceptedChangeSets.length,
        knownBlockers: publicKnownBlockers(state),
        changeSet: {
          id: state.changeSet.id,
          stageId: state.changeSet.stageId,
          stageKind: state.changeSet.stageKind,
          status: state.changeSet.status,
          attempt: state.changeSet.attempt,
          // Only allowlisted paths from the bounded review projection are public.
          operations:
            reviewPayload?.files.map((file) =>
              file.bytes === undefined
                ? { type: file.kind, path: file.path }
                : { type: file.kind, path: file.path, bytes: file.bytes },
            ) ?? [],
        },
        reviewPayload,
        validationReport: reviewPayload?.validationReport,
        candidateFileCount: state.candidateSnapshot.files.size,
      };
    }
    case "sequence_stopped":
      return {
        ...base,
        sourceLabel: state.snapshot.sourceLabel,
        reason: state.reason,
        selectedCandidate: state.selectedCandidate
          ? publicCandidate(state.selectedCandidate)
          : undefined,
        acceptedChangeSetCount: state.acceptedChangeSets.length,
        validationReport: state.validationReport,
      };
    case "completed":
      return {
        ...base,
        sourceLabel: state.snapshot.sourceLabel,
        selectedCandidate: publicCandidate(state.selectedCandidate),
        sequence: publicSequence(state.sequence),
        acceptedChangeSetCount: state.acceptedChangeSets.length,
        knownBlockers: publicKnownBlockers(state),
        completionStatus:
          state.knownBlockers && state.knownBlockers.length > 0
            ? ("completed_with_known_blocker" as const)
            : ("fully_validated" as const),
        downloadAvailable: !state.knownBlockers || state.knownBlockers.length === 0,
        downloadPath:
          state.knownBlockers && state.knownBlockers.length > 0
            ? undefined
            : `/api/runs/${state.runId}/download`,
        validationReports: state.validationReports.map((r) => ({
          stageId: r.stageId,
          changeSetId: r.changeSetId,
          finalOutcome: r.finalOutcome,
          externalTestsLabel: r.externalTestsLabel,
          attempts: r.attempts.map((a) => ({
            attempt: a.attempt,
            passed: a.passed,
            checkCount: a.checks.length,
            failedCheckIds: a.checks.filter((c) => c.outcome === "failed").map((c) => c.id),
          })),
        })),
      };
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

type PublicRunViewRaw = ReturnType<typeof toPublicRunView>;
type PublicRunBase = Pick<PublicRunViewRaw, "runId" | "createdAt" | "lastActiveAt">;
type WithPhase<Phase extends RunState["phase"], Shape> = Omit<Shape, "phase"> & {
  phase: Phase;
};
type AssessedPublicRun = Extract<PublicRunViewRaw, { analysis: unknown }>;
type SelectedPublicRun = Extract<PublicRunViewRaw, { selectedReadiness: unknown }>;
type SequencedPublicRun = Extract<PublicRunViewRaw, { currentStage: unknown }>;
type AcceptancePublicRun = Extract<PublicRunViewRaw, { changeSet: unknown }>;
type StoppedPublicRun = Extract<PublicRunViewRaw, { reason: unknown }>;
type CompletedPublicRun = Extract<PublicRunViewRaw, { downloadPath: unknown }>;
type EligibilityFailurePublicRun = Extract<PublicRunViewRaw, { eligibility: unknown }>;
type SafetyFailurePublicRun = Extract<PublicRunViewRaw, { safety: unknown }>;

/** Discriminated, client-safe public projection returned by every run endpoint. */
export type PublicRunView =
  | WithPhase<"created" | "expired", PublicRunBase>
  | WithPhase<"loading", PublicRunBase & { sourceLabel: string }>
  | WithPhase<"eligibility_failed", EligibilityFailurePublicRun>
  | WithPhase<"safety_failed", SafetyFailurePublicRun>
  | WithPhase<"assessed" | "not_ready", AssessedPublicRun>
  | WithPhase<"candidate_selected", SelectedPublicRun>
  | WithPhase<
      | "awaiting_authorization"
      | "generating"
      | "validating"
      | "repairing"
      | "stage_failed_rolled_back",
      SequencedPublicRun
    >
  | WithPhase<"awaiting_acceptance", AcceptancePublicRun>
  | WithPhase<"sequence_stopped", StoppedPublicRun>
  | WithPhase<"completed", CompletedPublicRun>;
