import { useCallback, useState } from "react";
import type { PublicRunView } from "@/server/workflow/public-view";
import {
  acceptChangeSet,
  authorizeStage,
  deleteRun,
  getRun,
  rejectChangeSet,
  selectCandidate,
  startAssessment,
  type ApiFailure,
  type StartAssessmentBody,
} from "./assessment-api";
import type {
  LocalPresentationState,
  PresentationOperation,
  WorkflowStep,
} from "./presentation-state";

export type BlockedStart = Readonly<{
  body: StartAssessmentBody;
  activeRunId: string;
}>;

export type OperationError = Readonly<{
  message: string;
  operation: PresentationOperation;
  step: WorkflowStep;
  retryable: boolean;
}>;

type PendingState = Exclude<LocalPresentationState, "no-run" | "active-run-conflict">;

function errorMessage(result: ApiFailure): string {
  return result.message ?? result.code ?? `Request failed (${result.status})`;
}

function phaseStep(run: PublicRunView | null): WorkflowStep {
  if (!run) return "repository";
  if (run.phase === "completed") return "artifact";
  if (run.phase === "assessed" || run.phase === "candidate_selected") return "decision";
  if (
    run.phase === "awaiting_authorization" ||
    run.phase === "generating" ||
    run.phase === "validating" ||
    run.phase === "repairing" ||
    run.phase === "awaiting_acceptance" ||
    run.phase === "stage_failed_rolled_back" ||
    run.phase === "sequence_stopped"
  ) {
    return "sequence";
  }
  return "repository";
}

export function useAssessmentRun() {
  const [run, setRun] = useState<PublicRunView | null>(null);
  const [pendingState, setPendingState] = useState<PendingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<OperationError | null>(null);
  const [blockedStart, setBlockedStart] = useState<BlockedStart | null>(null);
  const [pickedCandidateId, setPickedCandidateId] = useState<string | null>(null);
  const [intent, setIntent] = useState("");

  const reset = useCallback(() => {
    setRun(null);
    setPendingState(null);
    setError(null);
    setOperationError(null);
    setBlockedStart(null);
    setPickedCandidateId(null);
    setIntent("");
  }, []);

  const dismissStartConflict = useCallback(() => {
    setBlockedStart(null);
    setError(null);
    setOperationError(null);
  }, []);

  const applyRun = useCallback((nextRun: PublicRunView) => {
    setRun(nextRun);
    if (nextRun.phase === "assessed" || nextRun.phase === "not_ready") {
      setPickedCandidateId(nextRun.ranking.safestTechnicalCandidateId ?? null);
    } else {
      setPickedCandidateId(null);
      setIntent("");
    }
  }, []);

  const fail = useCallback(
    (result: ApiFailure, operation: PresentationOperation, retryable: boolean) => {
      if (result.run) applyRun(result.run);
      const message = errorMessage(result);
      setError(message);
      setOperationError({ message, operation, step: phaseStep(result.run ?? run), retryable });
    },
    [applyRun, run],
  );

  const start = useCallback(
    async (body: StartAssessmentBody, allowRecovery = true) => {
      setPendingState("start-request-pending");
      setError(null);
      setOperationError(null);
      try {
        const result = await startAssessment(body);
        if (!result.ok) {
          if (allowRecovery && result.code === "RATE_LIMIT_ACTIVE_CLIENT" && result.activeRunId) {
            setBlockedStart({ body, activeRunId: result.activeRunId });
            setError(errorMessage(result));
            setOperationError(null);
          } else {
            fail(result, "start-assessment", true);
          }
          return;
        }
        setBlockedStart(null);
        applyRun(result.run);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        setError(message);
        setOperationError({
          message,
          operation: "start-assessment",
          step: phaseStep(run),
          retryable: true,
        });
      } finally {
        setPendingState(null);
      }
    },
    [applyRun, fail, run],
  );

  const startFixture = useCallback(
    () => start({ source: "fixture", fixtureId: "controlled-example" }),
    [start],
  );

  const startGithub = useCallback(
    (url: string) => start({ source: "github", url: url.trim() }),
    [start],
  );

  const replacePreviousRun = useCallback(async () => {
    if (!blockedStart) return;
    setPendingState("replace-run-request-pending");
    setError(null);
    setOperationError(null);
    try {
      const deleted = await deleteRun(blockedStart.activeRunId);
      if (!deleted.ok && deleted.status !== 404) {
        fail(deleted, "replace-run", true);
        return;
      }
      const body = blockedStart.body;
      setBlockedStart(null);
      await start(body, false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setOperationError({ message, operation: "replace-run", step: "repository", retryable: true });
    } finally {
      setPendingState(null);
    }
  }, [blockedStart, fail, start]);

  const endCurrentRun = useCallback(async () => {
    if (!run) return;
    setPendingState("end-run-request-pending");
    setError(null);
    setOperationError(null);
    try {
      const result = await deleteRun(run.runId);
      if (!result.ok && result.status !== 404) {
        fail(result, "end-run", true);
        return;
      }
      reset();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setOperationError({ message, operation: "end-run", step: phaseStep(run), retryable: true });
    } finally {
      setPendingState(null);
    }
  }, [fail, reset, run]);

  const confirmSelection = useCallback(async () => {
    if (!run || !pickedCandidateId) return;
    setPendingState("candidate-confirm-request-pending");
    setError(null);
    setOperationError(null);
    try {
      const result = await selectCandidate(run.runId, {
        candidateId: pickedCandidateId,
        modernizationIntent: intent.trim() || undefined,
      });
      if (!result.ok) {
        fail(result, "confirm-candidate", true);
        return;
      }
      applyRun(result.run);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setOperationError({
        message,
        operation: "confirm-candidate",
        step: "decision",
        retryable: true,
      });
    } finally {
      setPendingState(null);
    }
  }, [applyRun, fail, intent, pickedCandidateId, run]);

  const mutateStage = useCallback(
    async (
      pending: PendingState,
      operation: Extract<
        PresentationOperation,
        "authorize-stage" | "accept-change-set" | "reject-change-set"
      >,
      request: (runId: string) => ReturnType<typeof authorizeStage>,
    ) => {
      if (!run) return;
      setPendingState(pending);
      setError(null);
      setOperationError(null);
      try {
        const result = await request(run.runId);
        if (!result.ok) {
          fail(result, operation, true);
          return;
        }
        applyRun(result.run);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        setError(message);
        setOperationError({ message, operation, step: "sequence", retryable: true });
      } finally {
        setPendingState(null);
      }
    },
    [applyRun, fail, run],
  );

  const authorize = useCallback(
    () => mutateStage("authorize-request-pending", "authorize-stage", authorizeStage),
    [mutateStage],
  );
  const accept = useCallback(
    () => mutateStage("accept-request-pending", "accept-change-set", acceptChangeSet),
    [mutateStage],
  );
  const reject = useCallback(
    () => mutateStage("reject-request-pending", "reject-change-set", rejectChangeSet),
    [mutateStage],
  );

  const refresh = useCallback(async () => {
    if (!run) return;
    const result = await getRun(run.runId);
    if (result.ok) applyRun(result.run);
    else fail(result, "start-assessment", true);
  }, [applyRun, fail, run]);

  return {
    run,
    busy: pendingState !== null,
    pendingState,
    error,
    operationError,
    blockedStart,
    pickedCandidateId,
    setPickedCandidateId,
    intent,
    setIntent,
    reset,
    dismissStartConflict,
    startFixture,
    startGithub,
    replacePreviousRun,
    endCurrentRun,
    confirmSelection,
    authorize,
    accept,
    reject,
    refresh,
  };
}
