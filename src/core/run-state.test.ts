import { describe, expect, it } from "vitest";
import type { AnalysisResult } from "./analysis";
import type { DomainCandidate } from "./candidates";
import type { ChangeSet } from "./changes";
import { assertNormalizedPath } from "./paths";
import { buildTransformationReadiness } from "./readiness";
import { createSourceSnapshot } from "./repository";
import {
  acceptChangeSet,
  authorizeGeneration,
  beginLoading,
  beginRepair,
  beginValidation,
  createRun,
  continueWithKnownBlocker,
  markAssessed,
  markEligibilityFailed,
  markValidated,
  planSequence,
  rejectChangeSet,
  retryRolledBackStage,
  rollbackStage,
  skipResolvedConditionalStage,
  selectCandidate,
  type RunId,
  type RunState,
} from "./run-state";
import { DEFAULT_STAGE_BUDGETS, type ModernizationSequencePlan, type StagePlan } from "./stages";
import type { ValidationReport } from "./validation";

const runId = "run_test_1" as RunId;

function emptyAnalysis(): AnalysisResult {
  return {
    runtime: {},
    entryPath: assertNormalizedPath("app.js"),
    routes: [],
    models: [],
    modelAccess: [],
    unsupportedSyntax: [],
    graph: {
      nodes: [],
      edges: [],
      entryReachable: new Set(),
      cycles: [],
    },
    findings: [],
    contentHash: "hash",
    evidence: [],
  };
}

function candidate(id = "orders", name = "Orders"): DomainCandidate {
  return {
    id,
    name,
    technicalScore: 0.9,
    confidence: 0.8,
    routes: [],
    files: [assertNormalizedPath(`routes/${id}.js`)],
    signals: [],
    conflictingEvidence: [],
  };
}

function readyRules(candidateId = "orders") {
  return buildTransformationReadiness(candidateId, [
    {
      ruleId: "READINESS_STABLE_ROUTE_GROUP",
      passed: true,
      summary: "ok",
      evidence: [],
    },
  ]);
}

function notReadyRules(candidateId = "orders") {
  return buildTransformationReadiness(candidateId, [
    {
      ruleId: "READINESS_EXISTING_TEST_HARNESS",
      passed: false,
      summary: "missing harness",
      evidence: [],
    },
  ]);
}

function stage(kind: StagePlan["kind"], id: string): StagePlan {
  return {
    id,
    kind,
    title: id,
    purpose: id,
    conditional: kind === "cycle_repair",
    evidence: [],
    expectedFiles: [],
    pathEnvelope: { create: [], update: [], delete: [] },
    mutableRegions: [],
    protectedFingerprints: [],
    validationCriteria: [],
    budgets: { ...DEFAULT_STAGE_BUDGETS },
  };
}

function sequence(): ModernizationSequencePlan {
  return {
    requiredStages: [
      stage("behavior_capture", "s1") as StagePlan & { kind: "behavior_capture" },
      stage("domain_module", "s2") as StagePlan & { kind: "domain_module" },
      stage("integration_cleanup", "s3") as StagePlan & { kind: "integration_cleanup" },
    ],
  };
}

function conditionalSequence(): ModernizationSequencePlan {
  return {
    ...sequence(),
    conditionalStage: stage("cycle_repair", "s3_cycle") as StagePlan & {
      kind: "cycle_repair";
      conditional: true;
    },
  };
}

function snapshot(label: string) {
  return createSourceSnapshot({
    snapshotId: label,
    sourceLabel: label,
    files: [],
    contentHash: label,
  });
}

function changeSet(attempt: 1 | 2 = 1): ChangeSet {
  return {
    id: `cs_${attempt}`,
    stageId: "s1",
    stageKind: "behavior_capture",
    operations: [],
    status: "generated",
    attempt,
    createdAt: new Date().toISOString(),
  };
}

function report(outcome: ValidationReport["finalOutcome"] = "passed"): ValidationReport {
  return {
    stageId: "s1",
    changeSetId: "cs_1",
    attempts: [{ attempt: 1, checks: [], passed: outcome === "passed" }],
    finalOutcome: outcome,
  };
}

function mustOk<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected ok transition");
  }
  return result as Extract<T, { ok: true }>;
}

function reachAwaitingAuthorization(): RunState {
  let state: RunState = createRun({ runId, clientKeyHash: "client" });
  state = mustOk(beginLoading(state, "example")).state;
  const ready = readyRules();
  state = mustOk(
    markAssessed(state, {
      snapshot: snapshot("base"),
      analysis: emptyAnalysis(),
      ranking: { candidates: [candidate()], safestTechnicalCandidateId: "orders" },
      readinessByCandidateId: new Map([["orders", ready]]),
    }),
  ).state;
  state = mustOk(selectCandidate(state, { candidate: candidate(), readiness: ready })).state;
  state = mustOk(planSequence(state, sequence())).state;
  return state;
}

describe("run state machine", () => {
  it("blocks generation without authorization", () => {
    let state: RunState = createRun({ runId, clientKeyHash: "client" });
    state = mustOk(beginLoading(state, "example")).state;
    const unauthorized = authorizeGeneration(state);
    expect(unauthorized.ok).toBe(false);
    if (!unauthorized.ok) {
      expect(unauthorized.error.code).toBe("INVALID_TRANSITION");
    }
  });

  it("routes all-failed readiness to not_ready without generation path", () => {
    let state: RunState = createRun({ runId, clientKeyHash: "client" });
    state = mustOk(beginLoading(state, "example")).state;
    const assessed = markAssessed(state, {
      snapshot: snapshot("ex"),
      analysis: emptyAnalysis(),
      ranking: { candidates: [candidate()] },
      readinessByCandidateId: new Map([["orders", notReadyRules()]]),
    });
    const next = mustOk(assessed).state;
    expect(next.phase).toBe("not_ready");
    expect(selectCandidate(next, { candidate: candidate(), readiness: notReadyRules() }).ok).toBe(
      false,
    );
  });

  it("cannot select a candidate that failed readiness when others are ready", () => {
    let state: RunState = createRun({ runId, clientKeyHash: "client" });
    state = mustOk(beginLoading(state, "example")).state;
    state = mustOk(
      markAssessed(state, {
        snapshot: snapshot("ex"),
        analysis: emptyAnalysis(),
        ranking: { candidates: [candidate("orders"), candidate("users", "Users")] },
        readinessByCandidateId: new Map([
          ["orders", notReadyRules("orders")],
          ["users", readyRules("users")],
        ]),
      }),
    ).state;
    expect(state.phase).toBe("assessed");

    const rejected = selectCandidate(state, {
      candidate: candidate("orders"),
      readiness: notReadyRules("orders"),
    });
    expect(rejected.ok).toBe(false);
  });

  it("requires authorize → validate → accept; rejection leaves snapshot", () => {
    let state = reachAwaitingAuthorization();
    expect(state.phase).toBe("awaiting_authorization");
    expect(acceptChangeSet(state).ok).toBe(false);

    state = mustOk(authorizeGeneration(state)).state;
    state = mustOk(
      beginValidation(state, {
        candidateSnapshot: snapshot("candidate"),
        changeSet: changeSet(1),
      }),
    ).state;
    state = mustOk(
      markValidated(state, {
        changeSet: { ...changeSet(1), status: "validated" },
        validationReport: report("passed"),
      }),
    ).state;
    expect(state.phase).toBe("awaiting_acceptance");
    if (state.phase !== "awaiting_acceptance") return;

    const baseSnapshotId = state.snapshot.snapshotId;
    const rejected = mustOk(rejectChangeSet(state)).state;
    expect(rejected.phase).toBe("sequence_stopped");
    if (rejected.phase === "sequence_stopped") {
      expect(rejected.snapshot.snapshotId).toBe(baseSnapshotId);
      expect(rejected.reason).toBe("developer_rejected");
    }
  });

  it("promotes candidate snapshot only on Change Acceptance", () => {
    let state = reachAwaitingAuthorization();
    state = mustOk(authorizeGeneration(state)).state;
    state = mustOk(
      beginValidation(state, {
        candidateSnapshot: snapshot("promoted"),
        changeSet: changeSet(1),
      }),
    ).state;
    state = mustOk(
      markValidated(state, {
        changeSet: { ...changeSet(1), status: "validated" },
        validationReport: report("passed"),
      }),
    ).state;

    const accepted = mustOk(acceptChangeSet(state)).state;
    expect(accepted.phase).toBe("awaiting_authorization");
    if (accepted.phase === "awaiting_authorization") {
      expect(accepted.snapshot.snapshotId).toBe("promoted");
      expect(accepted.stageIndex).toBe(1);
      expect(accepted.acceptedChangeSets).toHaveLength(1);
    }
  });

  it("allows one repair then rolls back on second failure", () => {
    let state = reachAwaitingAuthorization();
    state = mustOk(authorizeGeneration(state)).state;
    state = mustOk(
      beginValidation(state, {
        candidateSnapshot: snapshot("c1"),
        changeSet: changeSet(1),
      }),
    ).state;

    state = mustOk(
      beginRepair(state, {
        failedChangeSet: changeSet(1),
        validationReport: report("failed_awaiting_repair"),
      }),
    ).state;

    state = mustOk(
      beginValidation(state, {
        candidateSnapshot: snapshot("c2"),
        changeSet: changeSet(2),
      }),
    ).state;

    expect(
      beginRepair(state, {
        failedChangeSet: changeSet(2),
        validationReport: report("failed_rolled_back"),
      }).ok,
    ).toBe(false);

    const rolled = mustOk(rollbackStage(state, report("failed_rolled_back"))).state;
    expect(rolled.phase).toBe("stage_failed_rolled_back");
    const firstRetry = mustOk(retryRolledBackStage(rolled)).state;
    expect(firstRetry.phase).toBe("repairing");
    expect(firstRetry.manualRepairRetries).toBe(1);
    if (firstRetry.phase !== "repairing") return;

    const rolledAgain = mustOk(rollbackStage(firstRetry, report("failed_rolled_back"))).state;
    const secondRetry = mustOk(retryRolledBackStage(rolledAgain)).state;
    expect(secondRetry.manualRepairRetries).toBe(2);
    if (secondRetry.phase !== "repairing") return;

    const exhausted = mustOk(rollbackStage(secondRetry, report("failed_rolled_back"))).state;
    const denied = retryRolledBackStage(exhausted);
    expect(denied).toMatchObject({ ok: false });
    if (!denied.ok) expect(denied.error.message).toContain("Both manual repair retries");
  });

  it("records eligibility failure without analysis", () => {
    let state: RunState = createRun({ runId, clientKeyHash: "c" });
    state = mustOk(beginLoading(state, "https://github.com/acme/app")).state;
    const failed = mustOk(
      markEligibilityFailed(state, {
        eligible: false,
        rejections: [
          {
            code: "ELIGIBILITY_ESM_MODULE",
            message: "type module is not supported",
            evidence: [],
          },
        ],
      }),
    ).state;
    expect(failed.phase).toBe("eligibility_failed");
  });

  function reachFailedConditionalStage(): RunState {
    let state: RunState = createRun({ runId, clientKeyHash: "client" });
    state = mustOk(beginLoading(state, "example")).state;
    const ready = readyRules();
    state = mustOk(
      markAssessed(state, {
        snapshot: snapshot("base"),
        analysis: emptyAnalysis(),
        ranking: { candidates: [candidate()], safestTechnicalCandidateId: "orders" },
        readinessByCandidateId: new Map([["orders", ready]]),
      }),
    ).state;
    state = mustOk(selectCandidate(state, { candidate: candidate(), readiness: ready })).state;
    state = mustOk(planSequence(state, conditionalSequence())).state;

    // Accept behavior_capture (index 0) and domain_module (index 1) to land on
    // the conditional cycle_repair stage (index 2).
    for (const attempt of [1, 2] as const) {
      if (state.phase !== "awaiting_authorization") throw new Error("expected authorization");
      const stageId = state.currentStage.id;
      const stageKind = state.currentStage.kind;
      state = mustOk(authorizeGeneration(state)).state;
      state = mustOk(
        beginValidation(state, {
          candidateSnapshot: snapshot(`c${attempt}`),
          changeSet: { ...changeSet(attempt), stageId, stageKind },
        }),
      ).state;
      state = mustOk(
        markValidated(state, {
          changeSet: { ...changeSet(attempt), status: "validated", stageId, stageKind },
          validationReport: { ...report("passed"), stageId },
        }),
      ).state;
      state = mustOk(acceptChangeSet(state)).state;
    }

    // Now at index 2 (conditional cycle_repair). Authorize, validate, then roll back.
    if (state.phase !== "awaiting_authorization") throw new Error("expected conditional stage");
    const cycleStageId = state.currentStage.id;
    const cycleStageKind = state.currentStage.kind;
    state = mustOk(authorizeGeneration(state)).state;
    state = mustOk(
      beginValidation(state, {
        candidateSnapshot: snapshot("c_cycle"),
        changeSet: { ...changeSet(1), stageId: cycleStageId, stageKind: cycleStageKind },
      }),
    ).state;
    return mustOk(rollbackStage(state, { ...report("failed_rolled_back"), stageId: cycleStageId }))
      .state;
  }

  it("records a known blocker when continuing past a failed conditional cycle-repair stage", () => {
    const failed = reachFailedConditionalStage();
    expect(failed.phase).toBe("stage_failed_rolled_back");
    if (failed.phase !== "stage_failed_rolled_back") return;
    expect(failed.currentStage.kind).toBe("cycle_repair");
    expect(failed.currentStage.conditional).toBe(true);

    const continued = mustOk(continueWithKnownBlocker(failed)).state;
    expect(continued.phase).toBe("awaiting_authorization");
    if (continued.phase !== "awaiting_authorization") return;
    expect(continued.stageIndex).toBe(3);
    expect(continued.currentStage.kind).toBe("integration_cleanup");
    expect(continued.acceptedChangeSets).toHaveLength(2);
    expect(continued.knownBlockers).toHaveLength(1);
    if (continued.knownBlockers) {
      const blocker = continued.knownBlockers[0];
      expect(blocker?.stageKind).toBe("cycle_repair");
      expect(blocker?.reason).toBe("validation_rollback");
    }
  });

  it("refuses to continue with a known blocker from a non-conditional failed stage", () => {
    const failed = reachFailedConditionalStage();
    // Simulate a non-conditional stage failure by treating stage 0 as current.
    const nonConditional = {
      ...failed,
      stageIndex: 0,
      currentStage: conditionalSequence().requiredStages[0],
    } as RunState;
    const denied = continueWithKnownBlocker(nonConditional);
    expect(denied.ok).toBe(false);
  });

  it("refuses to continue with a known blocker unless the stage is rolled back", () => {
    const failed = reachFailedConditionalStage();
    const notRolled = { ...failed, phase: "awaiting_authorization" } as RunState;
    const denied = continueWithKnownBlocker(notRolled);
    expect(denied.ok).toBe(false);
  });

  it("skips a resolved conditional stage only when the cycle is gone", () => {
    const failed = reachFailedConditionalStage();
    // Sequence still has the conditional stage: re-check must not advance.
    const stillRequired = skipResolvedConditionalStage(failed, conditionalSequence());
    expect(stillRequired.ok).toBe(false);

    // A sequence whose conditional stage has been resolved (no conditionalStage)
    // lets the run advance to integration_cleanup at the same index.
    const resolved = skipResolvedConditionalStage(failed, sequence());
    const advanced = mustOk(resolved).state;
    expect(advanced.phase).toBe("awaiting_authorization");
    if (advanced.phase !== "awaiting_authorization") return;
    expect(advanced.stageIndex).toBe(2);
    expect(advanced.currentStage.kind).toBe("integration_cleanup");
    expect(advanced.acceptedChangeSets).toHaveLength(2);
  });
});
