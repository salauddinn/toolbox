import type { AnalysisResult } from "./analysis";
import type { CandidateRanking, DomainCandidate } from "./candidates";
import type { ChangeSet } from "./changes";
import type { EligibilityResult } from "./eligibility";
import type { TransformationReadiness } from "./readiness";
import type { SourceSnapshot } from "./repository";
import type { SafetyScreeningResult } from "./safety";
import type { ModernizationSequencePlan, StagePlan } from "./stages";
import type { ValidationReport } from "./validation";

/**
 * Discriminated run state machine.
 * Authorization, generation, validation, acceptance, rejection, repair,
 * and rollback transitions cannot be skipped (ADR-0011, ADR-0012).
 */

export type RunId = string & { readonly __brand: "RunId" };

export type RunPhase =
  | "created"
  | "loading"
  | "eligibility_failed"
  | "safety_failed"
  | "assessed"
  | "not_ready"
  | "candidate_selected"
  | "awaiting_authorization"
  | "generating"
  | "validating"
  | "awaiting_acceptance"
  | "repairing"
  | "stage_failed_rolled_back"
  | "sequence_stopped"
  | "completed"
  | "expired";

type RunBase = {
  runId: RunId;
  createdAt: string;
  lastActiveAt: string;
  clientKeyHash: string;
  manualRepairRetries?: number;
};

type SelectedContext = {
  /** Current accepted repository snapshot (evolves only on Change Acceptance). */
  snapshot: SourceSnapshot;
  /** Snapshot at sequence start — used for combined before/after artifact trees. */
  initialSnapshot: SourceSnapshot;
  analysis: AnalysisResult;
  selectedCandidate: DomainCandidate;
  sequence: ModernizationSequencePlan;
  stageIndex: number;
  acceptedChangeSets: readonly ChangeSet[];
  validationReports: readonly ValidationReport[];
};

export type RunState =
  | (RunBase & { phase: "created" })
  | (RunBase & { phase: "loading"; sourceLabel: string })
  | (RunBase & {
      phase: "eligibility_failed";
      sourceLabel: string;
      eligibility: Extract<EligibilityResult, { eligible: false }>;
    })
  | (RunBase & {
      phase: "safety_failed";
      sourceLabel: string;
      safety: Extract<SafetyScreeningResult, { passed: false }>;
    })
  | (RunBase & {
      phase: "assessed";
      snapshot: SourceSnapshot;
      analysis: AnalysisResult;
      ranking: CandidateRanking;
      readinessByCandidateId: ReadonlyMap<string, TransformationReadiness>;
    })
  | (RunBase & {
      phase: "not_ready";
      snapshot: SourceSnapshot;
      analysis: AnalysisResult;
      ranking: CandidateRanking;
      readinessByCandidateId: ReadonlyMap<string, TransformationReadiness>;
    })
  | (RunBase & {
      phase: "candidate_selected";
      snapshot: SourceSnapshot;
      analysis: AnalysisResult;
      ranking: CandidateRanking;
      readinessByCandidateId: ReadonlyMap<string, TransformationReadiness>;
      selectedCandidate: DomainCandidate;
      selectedReadiness: Extract<TransformationReadiness, { ready: true }>;
      modernizationIntent?: string;
    })
  | (RunBase &
      SelectedContext & {
        phase: "awaiting_authorization";
        currentStage: StagePlan;
      })
  | (RunBase &
      SelectedContext & {
        phase: "generating";
        currentStage: StagePlan;
        authorizedAt: string;
      })
  | (RunBase &
      SelectedContext & {
        phase: "validating";
        currentStage: StagePlan;
        candidateSnapshot: SourceSnapshot;
        changeSet: ChangeSet;
      })
  | (RunBase &
      SelectedContext & {
        phase: "awaiting_acceptance";
        currentStage: StagePlan;
        candidateSnapshot: SourceSnapshot;
        changeSet: ChangeSet & { status: "validated" };
        validationReport: ValidationReport;
      })
  | (RunBase &
      SelectedContext & {
        phase: "repairing";
        currentStage: StagePlan;
        failedChangeSet: ChangeSet;
        validationReport: ValidationReport;
      })
  | (RunBase &
      SelectedContext & {
        phase: "stage_failed_rolled_back";
        currentStage: StagePlan;
        validationReport: ValidationReport;
      })
  | (RunBase & {
      phase: "sequence_stopped";
      snapshot: SourceSnapshot;
      selectedCandidate?: DomainCandidate;
      reason: "developer_rejected" | "validation_rollback" | "manual_stop";
      validationReport?: ValidationReport;
      acceptedChangeSets: readonly ChangeSet[];
    })
  | (RunBase & {
      phase: "completed";
      snapshot: SourceSnapshot;
      initialSnapshot: SourceSnapshot;
      selectedCandidate: DomainCandidate;
      sequence: ModernizationSequencePlan;
      acceptedChangeSets: readonly ChangeSet[];
      validationReports: readonly ValidationReport[];
    })
  | (RunBase & { phase: "expired" });

export type RunTransitionError = {
  code: "INVALID_TRANSITION";
  from: RunPhase;
  attempted: string;
  message: string;
};

export type TransitionResult =
  { ok: true; state: RunState } | { ok: false; error: RunTransitionError };

function nowIso(): string {
  return new Date().toISOString();
}

function invalid(from: RunPhase, attempted: string, message: string): TransitionResult {
  return {
    ok: false,
    error: { code: "INVALID_TRANSITION", from, attempted, message },
  };
}

function baseOf(state: RunState): RunBase {
  return {
    runId: state.runId,
    clientKeyHash: state.clientKeyHash,
    manualRepairRetries: state.manualRepairRetries,
    createdAt: state.createdAt,
    lastActiveAt: nowIso(),
  };
}

/** Ordered stages including optional conditional after domain_module. */
export function orderedStages(sequence: ModernizationSequencePlan): StagePlan[] {
  const [capture, module, integration] = sequence.requiredStages;
  if (sequence.conditionalStage) {
    return [capture, module, sequence.conditionalStage, integration];
  }
  return [capture, module, integration];
}

export function createRun(input: {
  runId: RunId;
  clientKeyHash: string;
  createdAt?: string;
}): Extract<RunState, { phase: "created" }> {
  const createdAt = input.createdAt ?? nowIso();
  return {
    phase: "created",
    runId: input.runId,
    clientKeyHash: input.clientKeyHash,
    manualRepairRetries: 0,
    createdAt,
    lastActiveAt: createdAt,
  };
}

export function beginLoading(state: RunState, sourceLabel: string): TransitionResult {
  if (state.phase !== "created") {
    return invalid(state.phase, "beginLoading", "Loading can only start from created");
  }
  return {
    ok: true,
    state: {
      ...baseOf(state),
      phase: "loading",
      sourceLabel,
    },
  };
}

export function markEligibilityFailed(
  state: RunState,
  eligibility: Extract<EligibilityResult, { eligible: false }>,
): TransitionResult {
  if (state.phase !== "loading") {
    return invalid(state.phase, "markEligibilityFailed", "Eligibility failure requires loading");
  }
  return {
    ok: true,
    state: {
      ...baseOf(state),
      phase: "eligibility_failed",
      sourceLabel: state.sourceLabel,
      eligibility,
    },
  };
}

export function markSafetyFailed(
  state: RunState,
  safety: Extract<SafetyScreeningResult, { passed: false }>,
): TransitionResult {
  if (state.phase !== "loading") {
    return invalid(state.phase, "markSafetyFailed", "Safety failure requires loading");
  }
  return {
    ok: true,
    state: {
      ...baseOf(state),
      phase: "safety_failed",
      sourceLabel: state.sourceLabel,
      safety,
    },
  };
}

export function markAssessed(
  state: RunState,
  input: {
    snapshot: SourceSnapshot;
    analysis: AnalysisResult;
    ranking: CandidateRanking;
    readinessByCandidateId: ReadonlyMap<string, TransformationReadiness>;
  },
): TransitionResult {
  if (state.phase !== "loading") {
    return invalid(state.phase, "markAssessed", "Assessment requires loading");
  }
  const anyReady = [...input.readinessByCandidateId.values()].some((r) => r.ready);
  if (!anyReady) {
    return {
      ok: true,
      state: {
        ...baseOf(state),
        phase: "not_ready",
        snapshot: input.snapshot,
        analysis: input.analysis,
        ranking: input.ranking,
        readinessByCandidateId: input.readinessByCandidateId,
      },
    };
  }
  return {
    ok: true,
    state: {
      ...baseOf(state),
      phase: "assessed",
      snapshot: input.snapshot,
      analysis: input.analysis,
      ranking: input.ranking,
      readinessByCandidateId: input.readinessByCandidateId,
    },
  };
}

export function selectCandidate(
  state: RunState,
  input: {
    candidate: DomainCandidate;
    readiness: TransformationReadiness;
    modernizationIntent?: string;
  },
): TransitionResult {
  if (state.phase !== "assessed") {
    return invalid(state.phase, "selectCandidate", "Selection requires assessed ready candidates");
  }
  if (!input.readiness.ready) {
    return invalid(
      state.phase,
      "selectCandidate",
      "Cannot select a candidate that failed Transformation Readiness",
    );
  }
  if (input.readiness.candidateId !== input.candidate.id) {
    return invalid(state.phase, "selectCandidate", "Readiness does not match candidate");
  }
  return {
    ok: true,
    state: {
      ...baseOf(state),
      phase: "candidate_selected",
      snapshot: state.snapshot,
      analysis: state.analysis,
      ranking: state.ranking,
      readinessByCandidateId: state.readinessByCandidateId,
      selectedCandidate: input.candidate,
      selectedReadiness: input.readiness,
      modernizationIntent: input.modernizationIntent,
    },
  };
}

export function planSequence(
  state: RunState,
  sequence: ModernizationSequencePlan,
): TransitionResult {
  if (state.phase !== "candidate_selected") {
    return invalid(state.phase, "planSequence", "Sequence planning requires selected candidate");
  }
  const stages = orderedStages(sequence);
  const currentStage = stages[0];
  if (!currentStage) {
    return invalid(state.phase, "planSequence", "Sequence must include required stages");
  }
  return {
    ok: true,
    state: {
      ...baseOf(state),
      phase: "awaiting_authorization",
      snapshot: state.snapshot,
      initialSnapshot: state.snapshot,
      analysis: state.analysis,
      selectedCandidate: state.selectedCandidate,
      sequence,
      stageIndex: 0,
      currentStage,
      acceptedChangeSets: [],
      validationReports: [],
    },
  };
}

export function authorizeGeneration(state: RunState): TransitionResult {
  if (state.phase !== "awaiting_authorization") {
    return invalid(
      state.phase,
      "authorizeGeneration",
      "Generation requires an authorized Stage Plan",
    );
  }
  return {
    ok: true,
    state: {
      ...baseOf(state),
      phase: "generating",
      snapshot: state.snapshot,
      initialSnapshot: state.initialSnapshot,
      analysis: state.analysis,
      selectedCandidate: state.selectedCandidate,
      sequence: state.sequence,
      stageIndex: state.stageIndex,
      currentStage: state.currentStage,
      acceptedChangeSets: state.acceptedChangeSets,
      validationReports: state.validationReports,
      authorizedAt: nowIso(),
    },
  };
}

export function beginValidation(
  state: RunState,
  input: { candidateSnapshot: SourceSnapshot; changeSet: ChangeSet },
): TransitionResult {
  if (state.phase !== "generating" && state.phase !== "repairing") {
    return invalid(state.phase, "beginValidation", "Validation requires generation or repair");
  }
  return {
    ok: true,
    state: {
      ...baseOf(state),
      phase: "validating",
      snapshot: state.snapshot,
      initialSnapshot: state.initialSnapshot,
      analysis: state.analysis,
      selectedCandidate: state.selectedCandidate,
      sequence: state.sequence,
      stageIndex: state.stageIndex,
      currentStage: state.currentStage,
      acceptedChangeSets: state.acceptedChangeSets,
      validationReports: state.validationReports,
      candidateSnapshot: input.candidateSnapshot,
      changeSet: input.changeSet,
    },
  };
}

export function markValidated(
  state: RunState,
  input: {
    changeSet: ChangeSet & { status: "validated" };
    validationReport: ValidationReport;
  },
): TransitionResult {
  if (state.phase !== "validating") {
    return invalid(state.phase, "markValidated", "Validation success requires validating phase");
  }
  return {
    ok: true,
    state: {
      ...baseOf(state),
      phase: "awaiting_acceptance",
      snapshot: state.snapshot,
      initialSnapshot: state.initialSnapshot,
      analysis: state.analysis,
      selectedCandidate: state.selectedCandidate,
      sequence: state.sequence,
      stageIndex: state.stageIndex,
      currentStage: state.currentStage,
      acceptedChangeSets: state.acceptedChangeSets,
      validationReports: state.validationReports,
      candidateSnapshot: state.candidateSnapshot,
      changeSet: input.changeSet,
      validationReport: input.validationReport,
    },
  };
}

export function beginRepair(
  state: RunState,
  input: { failedChangeSet: ChangeSet; validationReport: ValidationReport },
): TransitionResult {
  if (state.phase !== "validating") {
    return invalid(state.phase, "beginRepair", "Repair requires a failed validation");
  }
  if (input.failedChangeSet.attempt !== 1) {
    return invalid(
      state.phase,
      "beginRepair",
      "Only one repair attempt is allowed; second failure must roll back",
    );
  }
  return {
    ok: true,
    state: {
      ...baseOf(state),
      phase: "repairing",
      snapshot: state.snapshot,
      initialSnapshot: state.initialSnapshot,
      analysis: state.analysis,
      selectedCandidate: state.selectedCandidate,
      sequence: state.sequence,
      stageIndex: state.stageIndex,
      currentStage: state.currentStage,
      acceptedChangeSets: state.acceptedChangeSets,
      validationReports: state.validationReports,
      failedChangeSet: input.failedChangeSet,
      validationReport: input.validationReport,
    },
  };
}

export function rollbackStage(
  state: RunState,
  validationReport: ValidationReport,
): TransitionResult {
  if (state.phase !== "validating" && state.phase !== "repairing") {
    return invalid(state.phase, "rollbackStage", "Rollback requires validation or repair");
  }
  return {
    ok: true,
    state: {
      ...baseOf(state),
      phase: "stage_failed_rolled_back",
      snapshot: state.snapshot,
      initialSnapshot: state.initialSnapshot,
      analysis: state.analysis,
      selectedCandidate: state.selectedCandidate,
      sequence: state.sequence,
      stageIndex: state.stageIndex,
      currentStage: state.currentStage,
      acceptedChangeSets: state.acceptedChangeSets,
      validationReports: [...state.validationReports, validationReport],
      validationReport,
    },
  };
}

/**
 * Change Acceptance promotes the candidate snapshot and advances the sequence.
 * Rejection is a separate transition and must not call this.
 */
export function acceptChangeSet(state: RunState): TransitionResult {
  if (state.phase !== "awaiting_acceptance") {
    return invalid(state.phase, "acceptChangeSet", "Acceptance requires a validated Change Set");
  }

  const accepted: ChangeSet = { ...state.changeSet, status: "accepted" };
  const acceptedChangeSets = [...state.acceptedChangeSets, accepted];
  const validationReports = [...state.validationReports, state.validationReport];
  const nextIndex = state.stageIndex + 1;
  const stages = orderedStages(state.sequence);
  const nextStage = stages[nextIndex];

  if (!nextStage) {
    return {
      ok: true,
      state: {
        ...baseOf(state),
        phase: "completed",
        snapshot: state.candidateSnapshot,
        initialSnapshot: state.initialSnapshot,
        selectedCandidate: state.selectedCandidate,
        sequence: state.sequence,
        acceptedChangeSets,
        validationReports,
      },
    };
  }

  return {
    ok: true,
    state: {
      ...baseOf(state),
      phase: "awaiting_authorization",
      snapshot: state.candidateSnapshot,
      initialSnapshot: state.initialSnapshot,
      analysis: state.analysis,
      selectedCandidate: state.selectedCandidate,
      sequence: state.sequence,
      stageIndex: nextIndex,
      currentStage: nextStage,
      acceptedChangeSets,
      validationReports,
    },
  };
}

export function rejectChangeSet(state: RunState): TransitionResult {
  if (state.phase !== "awaiting_acceptance") {
    return invalid(state.phase, "rejectChangeSet", "Rejection requires a validated Change Set");
  }
  return {
    ok: true,
    state: {
      ...baseOf(state),
      phase: "sequence_stopped",
      snapshot: state.snapshot,
      selectedCandidate: state.selectedCandidate,
      reason: "developer_rejected",
      validationReport: state.validationReport,
      acceptedChangeSets: state.acceptedChangeSets,
    },
  };
}

export function stopAfterRollback(state: RunState): TransitionResult {
  if (state.phase !== "stage_failed_rolled_back") {
    return invalid(state.phase, "stopAfterRollback", "Stop requires rolled-back stage failure");
  }
  return {
    ok: true,
    state: {
      ...baseOf(state),
      phase: "sequence_stopped",
      snapshot: state.snapshot,
      selectedCandidate: state.selectedCandidate,
      reason: "validation_rollback",
      validationReport: state.validationReport,
      acceptedChangeSets: state.acceptedChangeSets,
    },
  };
}

/** One developer-triggered, repair-context retry after the automatic repair has rolled back. */
export function retryRolledBackStage(state: RunState): TransitionResult {
  if (state.phase !== "stage_failed_rolled_back") {
    return invalid(state.phase, "retryRolledBackStage", "Retry requires a rolled-back stage");
  }
  if ((state.manualRepairRetries ?? 0) >= 2) {
    return invalid(
      state.phase,
      "retryRolledBackStage",
      "Both manual repair retries were already used",
    );
  }
  const failedChangeSet: ChangeSet = {
    id: state.validationReport.changeSetId,
    stageId: state.currentStage.id,
    stageKind: state.currentStage.kind,
    operations: [],
    status: "validation_failed",
    attempt: 1,
    createdAt: nowIso(),
  };
  return {
    ok: true,
    state: {
      ...baseOf(state),
      manualRepairRetries: (state.manualRepairRetries ?? 0) + 1,
      phase: "repairing",
      snapshot: state.snapshot,
      initialSnapshot: state.initialSnapshot,
      analysis: state.analysis,
      selectedCandidate: state.selectedCandidate,
      sequence: state.sequence,
      stageIndex: state.stageIndex,
      currentStage: state.currentStage,
      acceptedChangeSets: state.acceptedChangeSets,
      validationReports: state.validationReports,
      failedChangeSet,
      validationReport: state.validationReport,
    },
  };
}

export function expireRun(state: RunState): TransitionResult {
  if (state.phase === "completed" || state.phase === "expired") {
    return invalid(state.phase, "expireRun", "Run is already terminal");
  }
  return {
    ok: true,
    state: {
      ...baseOf(state),
      phase: "expired",
    },
  };
}
