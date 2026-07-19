import type { RunId, RunState } from "@/core/run-state";
import { buildResultArtifact, type ArtifactBundle } from "@/server/artifact/build";
import { globalRunStore, type RunStore } from "@/server/run-store";

export type DownloadResult =
  | { ok: true; artifact: ArtifactBundle }
  | { ok: false; code: string; message: string; status: number };

/**
 * Result ZIP is available only after the Modernization Sequence completes.
 * repository/ reflects accepted Change Sets only; report is separate at ZIP root.
 */
export function buildDownloadArtifact(input: {
  runId: RunId;
  clientKeyHash: string;
  store?: RunStore;
}): DownloadResult {
  const store = input.store ?? globalRunStore;
  const run = store.get(input.runId);
  if (!run) {
    return { ok: false, code: "RUN_NOT_FOUND", message: "Run not found or expired", status: 404 };
  }
  if (run.clientKeyHash !== input.clientKeyHash) {
    return {
      ok: false,
      code: "RUN_FORBIDDEN",
      message: "Run is bound to another client",
      status: 403,
    };
  }
  if (run.phase !== "completed") {
    return {
      ok: false,
      code: "ARTIFACT_NOT_READY",
      message: `Result ZIP is only available when phase is completed (current: ${run.phase})`,
      status: 409,
    };
  }
  if (run.knownBlockers && run.knownBlockers.length > 0) {
    return {
      ok: false,
      code: "ARTIFACT_BLOCKED_BY_KNOWN_BLOCKER",
      message:
        "Result ZIP is unavailable because the sequence continued with an unresolved blocker",
      status: 409,
    };
  }

  return {
    ok: true,
    artifact: buildResultArtifact({
      runId: run.runId,
      sourceLabel: run.snapshot.sourceLabel,
      selectedCandidate: run.selectedCandidate,
      sequence: run.sequence,
      initialSnapshot: run.initialSnapshot,
      finalSnapshot: run.snapshot,
      acceptedChangeSets: run.acceptedChangeSets,
      validationReports: run.validationReports,
    }),
  };
}

export function assertCompletedRun(
  run: RunState,
): run is Extract<RunState, { phase: "completed" }> {
  return run.phase === "completed";
}
