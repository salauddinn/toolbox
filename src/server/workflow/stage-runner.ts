import { randomBytes } from "node:crypto";
import type { ChangeSet, FileOperation } from "@/core/changes";
import type { RunId, RunState } from "@/core/run-state";
import {
  acceptChangeSet,
  authorizeGeneration,
  beginRepair,
  beginValidation,
  markValidated,
  rejectChangeSet,
  rollbackStage,
  stopAfterRollback,
} from "@/core/run-state";
import { assertNormalizedPath } from "@/core/paths";
import type { ValidationReport } from "@/core/validation";
import type { AiProvider } from "@/server/ai/provider";
import { OpenAiCompatibleProvider } from "@/server/ai/provider";
import { generateDeterministicOperations } from "@/server/generation/deterministic";
import { buildStageInstructions, buildUntrustedBlock } from "@/server/generation/prompts";
import { applyOperationsToSnapshot } from "@/server/snapshot/apply";
import { diffSnapshots, operationsSummary } from "@/server/snapshot/diff";
import { globalRunStore, type RunStore } from "@/server/run-store";
import { resolveConditionalStage } from "@/server/sequence/plan";
import { validateChangeSetStatic } from "@/server/validation/static";
import { releaseRunCapacity } from "@/server/workflow/assess";

function changeSetId(): string {
  return `cs_${randomBytes(8).toString("hex")}`;
}

function shouldUseDeterministicGeneration(): boolean {
  return (
    process.env.TOOLBOX_DETERMINISTIC_GENERATION === "1" ||
    process.env.NODE_ENV === "test" ||
    process.env.VITEST === "true"
  );
}

export type StageRunnerOptions = {
  store?: RunStore;
  provider?: AiProvider;
  forceDeterministic?: boolean;
};

export type StageActionResult =
  | {
      ok: true;
      run: RunState;
      diff?: ReturnType<typeof diffSnapshots>;
      operations?: ReturnType<typeof operationsSummary>;
      validationReport?: ValidationReport;
    }
  | { ok: false; code: string; message: string; status: number; run?: RunState };

function getBoundRun(
  store: RunStore,
  runId: RunId,
  clientKeyHash: string,
): { ok: true; run: RunState } | { ok: false; code: string; message: string; status: number } {
  const run = store.get(runId);
  if (!run) {
    return { ok: false, code: "RUN_NOT_FOUND", message: "Run not found or expired", status: 404 };
  }
  if (run.clientKeyHash !== clientKeyHash) {
    return {
      ok: false,
      code: "RUN_FORBIDDEN",
      message: "Run is bound to another client",
      status: 403,
    };
  }
  return { ok: true, run };
}

type GenRun = Extract<RunState, { phase: "generating" | "repairing" }>;
type ValidatingRun = Extract<RunState, { phase: "validating" }>;

async function produceOperations(input: {
  run: GenRun;
  provider: AiProvider;
  deterministic: boolean;
  repairErrors?: readonly string[];
}): Promise<
  | { ok: true; operations: FileOperation[]; attempt: 1 | 2 }
  | { ok: false; code: string; message: string; retryable: boolean }
> {
  const stage = input.run.currentStage;
  const files = [...input.run.snapshot.files.values()];
  const attempt: 1 | 2 = input.run.phase === "repairing" ? 2 : 1;

  if (input.deterministic) {
    const operations = generateDeterministicOperations({
      stage,
      candidate: input.run.selectedCandidate,
      analysis: input.run.analysis,
      files,
    });
    return { ok: true, operations, attempt };
  }

  const result = await input.provider.generate({
    stage,
    untrustedSourceBlock: buildUntrustedBlock({
      files,
      candidate: input.run.selectedCandidate,
      analysis: input.run.analysis,
    }),
    instructions: buildStageInstructions({
      stage,
      candidate: input.run.selectedCandidate,
      analysis: input.run.analysis,
    }),
    repairErrors: input.repairErrors,
  });

  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
      retryable: result.retryable,
    };
  }
  return { ok: true, operations: result.operations, attempt };
}

function restoreAwaitingAuthorization(
  run: GenRun,
): Extract<RunState, { phase: "awaiting_authorization" }> {
  return {
    phase: "awaiting_authorization",
    runId: run.runId,
    clientKeyHash: run.clientKeyHash,
    createdAt: run.createdAt,
    lastActiveAt: new Date().toISOString(),
    snapshot: run.snapshot,
    analysis: run.analysis,
    selectedCandidate: run.selectedCandidate,
    sequence: run.sequence,
    stageIndex: run.stageIndex,
    currentStage: run.currentStage,
    acceptedChangeSets: run.acceptedChangeSets,
    validationReports: run.validationReports,
  };
}

/**
 * Authorize + generate + validate (+ one repair) for the current stage.
 */
export async function authorizeAndGenerate(
  input: {
    runId: RunId;
    clientKeyHash: string;
  } & StageRunnerOptions,
): Promise<StageActionResult> {
  const store = input.store ?? globalRunStore;
  const bound = getBoundRun(store, input.runId, input.clientKeyHash);
  if (!bound.ok) return bound;

  let run = bound.run;
  if (run.phase !== "awaiting_authorization") {
    return {
      ok: false,
      code: "INVALID_PHASE",
      message: `Cannot authorize from phase ${run.phase}`,
      status: 409,
      run,
    };
  }

  const authorized = authorizeGeneration(run);
  if (!authorized.ok) {
    return {
      ok: false,
      code: authorized.error.code,
      message: authorized.error.message,
      status: 409,
    };
  }
  run = authorized.state;
  store.set(run);

  const provider = input.provider ?? new OpenAiCompatibleProvider();
  const deterministic = input.forceDeterministic ?? shouldUseDeterministicGeneration();

  return runGenerateValidateLoop({
    run: run as GenRun,
    store,
    provider,
    deterministic,
  });
}

async function runGenerateValidateLoop(input: {
  run: GenRun;
  store: RunStore;
  provider: AiProvider;
  deterministic: boolean;
  priorReport?: ValidationReport;
}): Promise<StageActionResult> {
  let run: RunState = input.run;
  const genRun = input.run;
  const attempt: 1 | 2 = genRun.phase === "repairing" ? 2 : 1;

  const produced = await produceOperations({
    run: genRun,
    provider: input.provider,
    deterministic: input.deterministic,
    repairErrors:
      genRun.phase === "repairing"
        ? genRun.validationReport.attempts.flatMap((a) => a.structuredErrors ?? [])
        : undefined,
  });

  if (!produced.ok) {
    if (produced.retryable && attempt === 1) {
      const restored = restoreAwaitingAuthorization(genRun);
      input.store.set(restored);
      return {
        ok: false,
        code: produced.code,
        message: `${produced.message} — stage preserved for manual retry`,
        status: 503,
        run: restored,
      };
    }
    return {
      ok: false,
      code: produced.code,
      message: produced.message,
      status: 502,
      run: genRun,
    };
  }

  const changeSet: ChangeSet = {
    id: changeSetId(),
    stageId: genRun.currentStage.id,
    stageKind: genRun.currentStage.kind,
    operations: produced.operations,
    status: "generated",
    attempt: produced.attempt,
    createdAt: new Date().toISOString(),
  };

  const applied = applyOperationsToSnapshot(genRun.snapshot, produced.operations);
  if (!applied.ok) {
    const report: ValidationReport = {
      stageId: genRun.currentStage.id,
      changeSetId: changeSet.id,
      attempts: [
        ...(input.priorReport?.attempts ?? []),
        {
          attempt: produced.attempt,
          passed: false,
          checks: [
            {
              id: "apply",
              kind: "static",
              title: "Apply operations",
              outcome: "failed",
              detail: applied.error.message,
            },
          ],
          structuredErrors: [applied.error.code],
        },
      ],
      finalOutcome: produced.attempt === 1 ? "failed_awaiting_repair" : "failed_rolled_back",
    };
    return handleValidationFailure({
      run: genRun,
      store: input.store,
      changeSet: { ...changeSet, status: "validation_failed" },
      report,
      provider: input.provider,
      deterministic: input.deterministic,
    });
  }

  const validating = beginValidation(genRun, {
    candidateSnapshot: applied.snapshot,
    changeSet,
  });
  if (!validating.ok) {
    return {
      ok: false,
      code: validating.error.code,
      message: validating.error.message,
      status: 500,
    };
  }
  run = validating.state;
  input.store.set(run);
  const validatingRun = run as ValidatingRun;

  const staticResult = validateChangeSetStatic({
    stage: validatingRun.currentStage,
    operations: produced.operations,
    baseSnapshot: validatingRun.snapshot,
    candidateSnapshot: applied.snapshot,
    analysis: validatingRun.analysis,
    candidate: validatingRun.selectedCandidate,
  });

  const attemptRecord = {
    attempt: produced.attempt,
    checks: staticResult.checks,
    passed: staticResult.passed,
    structuredErrors: staticResult.structuredErrors,
  };

  if (staticResult.passed) {
    const report: ValidationReport = {
      stageId: validatingRun.currentStage.id,
      changeSetId: changeSet.id,
      attempts: input.priorReport
        ? [...input.priorReport.attempts, attemptRecord]
        : [attemptRecord],
      finalOutcome: "passed",
      externalTestsLabel:
        validatingRun.currentStage.kind === "behavior_capture" ? "not_executed" : undefined,
    };
    const validatedCs = { ...changeSet, status: "validated" as const };
    const marked = markValidated(validatingRun, {
      changeSet: validatedCs,
      validationReport: report,
    });
    if (!marked.ok) {
      return {
        ok: false,
        code: marked.error.code,
        message: marked.error.message,
        status: 500,
      };
    }
    input.store.set(marked.state);
    return {
      ok: true,
      run: marked.state,
      diff: diffSnapshots(validatingRun.snapshot, applied.snapshot),
      operations: operationsSummary(produced.operations),
      validationReport: report,
    };
  }

  const report: ValidationReport = {
    stageId: validatingRun.currentStage.id,
    changeSetId: changeSet.id,
    attempts: input.priorReport ? [...input.priorReport.attempts, attemptRecord] : [attemptRecord],
    finalOutcome: produced.attempt === 1 ? "failed_awaiting_repair" : "failed_rolled_back",
    externalTestsLabel:
      validatingRun.currentStage.kind === "behavior_capture" ? "not_executed" : undefined,
  };

  return handleValidationFailure({
    run: validatingRun,
    store: input.store,
    changeSet: { ...changeSet, status: "validation_failed" },
    report,
    provider: input.provider,
    deterministic: input.deterministic,
  });
}

async function handleValidationFailure(input: {
  run: GenRun | ValidatingRun;
  store: RunStore;
  changeSet: ChangeSet;
  report: ValidationReport;
  provider: AiProvider;
  deterministic: boolean;
}): Promise<StageActionResult> {
  const { run, store, changeSet, report } = input;

  if (changeSet.attempt === 1 && run.phase === "validating") {
    const repairing = beginRepair(run, {
      failedChangeSet: changeSet,
      validationReport: report,
    });
    if (!repairing.ok) {
      return {
        ok: false,
        code: repairing.error.code,
        message: repairing.error.message,
        status: 500,
      };
    }
    store.set(repairing.state);
    return runGenerateValidateLoop({
      run: repairing.state as GenRun,
      store,
      provider: input.provider,
      deterministic: input.deterministic,
      priorReport: report,
    });
  }

  // Need validating or repairing for rollback — if still generating apply-fail path:
  let rollbackSource = run;
  if (run.phase === "generating" || run.phase === "repairing") {
    // Move to validating-like rollback via beginValidation with empty candidate? Use snapshot as candidate.
    const forced = beginValidation(run, {
      candidateSnapshot: run.snapshot,
      changeSet,
    });
    if (forced.ok) {
      rollbackSource = forced.state as ValidatingRun;
    }
  }

  if (rollbackSource.phase !== "validating" && rollbackSource.phase !== "repairing") {
    return {
      ok: false,
      code: "INVALID_PHASE",
      message: "Cannot roll back from current phase",
      status: 500,
      run,
    };
  }

  const finalReport: ValidationReport = { ...report, finalOutcome: "failed_rolled_back" };
  const rolled = rollbackStage(rollbackSource, finalReport);
  if (!rolled.ok) {
    return {
      ok: false,
      code: rolled.error.code,
      message: rolled.error.message,
      status: 500,
    };
  }
  const stopped = stopAfterRollback(rolled.state);
  if (!stopped.ok) {
    store.set(rolled.state);
    return { ok: true, run: rolled.state, validationReport: finalReport };
  }
  store.set(stopped.state);
  releaseRunCapacity(stopped.state.clientKeyHash);
  return { ok: true, run: stopped.state, validationReport: finalReport };
}

/**
 * Developer accepts validated Change Set. After domain_module, resolve conditional cycle stage.
 */
export function acceptCurrentChangeSet(input: {
  runId: RunId;
  clientKeyHash: string;
  store?: RunStore;
}): StageActionResult {
  const store = input.store ?? globalRunStore;
  const bound = getBoundRun(store, input.runId, input.clientKeyHash);
  if (!bound.ok) return bound;

  let run = bound.run;
  if (run.phase !== "awaiting_acceptance") {
    return {
      ok: false,
      code: "INVALID_PHASE",
      message: `Cannot accept from phase ${run.phase}`,
      status: 409,
      run,
    };
  }

  // Resolve conditional sequence before advancing off domain_module
  if (run.currentStage.kind === "domain_module" && run.sequence.pendingConditional) {
    const files = [...run.candidateSnapshot.files.values()];
    const resolved = resolveConditionalStage({
      candidate: run.selectedCandidate,
      analysis: run.analysis,
      files,
      sequence: run.sequence,
      entryPath: run.analysis.entryPath,
    });
    run = { ...run, sequence: resolved };
  }

  const accepted = acceptChangeSet(run);
  if (!accepted.ok) {
    return {
      ok: false,
      code: accepted.error.code,
      message: accepted.error.message,
      status: 409,
    };
  }
  store.set(accepted.state);
  if (accepted.state.phase === "completed") {
    releaseRunCapacity(accepted.state.clientKeyHash);
  }
  return { ok: true, run: accepted.state };
}

export function rejectCurrentChangeSet(input: {
  runId: RunId;
  clientKeyHash: string;
  store?: RunStore;
}): StageActionResult {
  const store = input.store ?? globalRunStore;
  const bound = getBoundRun(store, input.runId, input.clientKeyHash);
  if (!bound.ok) return bound;

  if (bound.run.phase !== "awaiting_acceptance") {
    return {
      ok: false,
      code: "INVALID_PHASE",
      message: `Cannot reject from phase ${bound.run.phase}`,
      status: 409,
      run: bound.run,
    };
  }

  const rejected = rejectChangeSet(bound.run);
  if (!rejected.ok) {
    return {
      ok: false,
      code: rejected.error.code,
      message: rejected.error.message,
      status: 409,
    };
  }
  store.set(rejected.state);
  releaseRunCapacity(rejected.state.clientKeyHash);
  return { ok: true, run: rejected.state };
}

/** Test helper: inject operations through the validation path without calling the provider. */
export async function validateInjectedOperations(input: {
  runId: RunId;
  clientKeyHash: string;
  operations: FileOperation[];
  attempt?: 1 | 2;
  store?: RunStore;
  priorReport?: ValidationReport;
}): Promise<StageActionResult> {
  const store = input.store ?? globalRunStore;
  const bound = getBoundRun(store, input.runId, input.clientKeyHash);
  if (!bound.ok) return bound;

  let run = bound.run;
  if (run.phase === "awaiting_authorization") {
    const authorized = authorizeGeneration(run);
    if (!authorized.ok) {
      return {
        ok: false,
        code: authorized.error.code,
        message: authorized.error.message,
        status: 409,
      };
    }
    run = authorized.state;
    store.set(run);
  }

  if (run.phase !== "generating" && run.phase !== "repairing") {
    return {
      ok: false,
      code: "INVALID_PHASE",
      message: `Cannot inject operations in phase ${run.phase}`,
      status: 409,
      run,
    };
  }

  const genRun = run as GenRun;
  const attempt = input.attempt ?? (genRun.phase === "repairing" ? 2 : 1);
  const operations = input.operations.map((op) => {
    if (op.type === "delete") {
      return { type: "delete" as const, path: assertNormalizedPath(op.path) };
    }
    return {
      type: op.type,
      path: assertNormalizedPath(op.path),
      content: op.content,
    };
  });

  const changeSet: ChangeSet = {
    id: changeSetId(),
    stageId: genRun.currentStage.id,
    stageKind: genRun.currentStage.kind,
    operations,
    status: "generated",
    attempt,
    createdAt: new Date().toISOString(),
  };

  const applied = applyOperationsToSnapshot(genRun.snapshot, operations);
  if (!applied.ok) {
    const report: ValidationReport = {
      stageId: genRun.currentStage.id,
      changeSetId: changeSet.id,
      attempts: [
        ...(input.priorReport?.attempts ?? []),
        {
          attempt,
          passed: false,
          checks: [
            {
              id: "apply",
              kind: "static",
              title: "Apply operations",
              outcome: "failed",
              detail: applied.error.message,
            },
          ],
          structuredErrors: [
            applied.error.code,
            `path_outside_repository_root:${applied.error.path ?? ""}`,
          ],
        },
      ],
      finalOutcome: attempt === 1 ? "failed_awaiting_repair" : "failed_rolled_back",
    };
    return handleValidationFailure({
      run: genRun,
      store,
      changeSet: { ...changeSet, status: "validation_failed" },
      report,
      provider: new OpenAiCompatibleProvider(),
      deterministic: true,
    });
  }

  const validating = beginValidation(genRun, {
    candidateSnapshot: applied.snapshot,
    changeSet,
  });
  if (!validating.ok) {
    return {
      ok: false,
      code: validating.error.code,
      message: validating.error.message,
      status: 500,
    };
  }
  store.set(validating.state);
  const validatingRun = validating.state as ValidatingRun;

  const staticResult = validateChangeSetStatic({
    stage: validatingRun.currentStage,
    operations,
    baseSnapshot: validatingRun.snapshot,
    candidateSnapshot: applied.snapshot,
    analysis: validatingRun.analysis,
    candidate: validatingRun.selectedCandidate,
  });

  const attemptRecord = {
    attempt,
    checks: staticResult.checks,
    passed: staticResult.passed,
    structuredErrors: staticResult.structuredErrors,
  };

  if (staticResult.passed) {
    const report: ValidationReport = {
      stageId: validatingRun.currentStage.id,
      changeSetId: changeSet.id,
      attempts: input.priorReport
        ? [...input.priorReport.attempts, attemptRecord]
        : [attemptRecord],
      finalOutcome: "passed",
    };
    const marked = markValidated(validatingRun, {
      changeSet: { ...changeSet, status: "validated" },
      validationReport: report,
    });
    if (!marked.ok) {
      return {
        ok: false,
        code: marked.error.code,
        message: marked.error.message,
        status: 500,
      };
    }
    store.set(marked.state);
    return {
      ok: true,
      run: marked.state,
      diff: diffSnapshots(validatingRun.snapshot, applied.snapshot),
      operations: operationsSummary(operations),
      validationReport: report,
    };
  }

  const report: ValidationReport = {
    stageId: validatingRun.currentStage.id,
    changeSetId: changeSet.id,
    attempts: input.priorReport ? [...input.priorReport.attempts, attemptRecord] : [attemptRecord],
    finalOutcome: attempt === 1 ? "failed_awaiting_repair" : "failed_rolled_back",
  };

  return handleValidationFailure({
    run: validatingRun,
    store,
    changeSet: { ...changeSet, status: "validation_failed" },
    report,
    provider: {
      async generate() {
        return {
          ok: false,
          code: "PROVIDER_TRANSPORT",
          message: "injected path should not call provider",
          retryable: false,
        };
      },
    },
    deterministic: true,
  });
}
