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
  markAssessed,
  markEligibilityFailed,
  markValidated,
  planSequence,
  rejectChangeSet,
  rollbackStage,
  selectCandidate,
  stopAfterRollback,
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
    const stopped = mustOk(stopAfterRollback(rolled)).state;
    expect(stopped.phase).toBe("sequence_stopped");
    if (stopped.phase === "sequence_stopped") {
      expect(stopped.reason).toBe("validation_rollback");
      expect(stopped.snapshot.snapshotId).toBe("base");
    }
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
});
