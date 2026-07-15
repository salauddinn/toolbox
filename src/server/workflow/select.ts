import { planSequence, selectCandidate, type RunId, type RunState } from "@/core/run-state";
import { globalRunStore, type RunStore } from "@/server/run-store";
import { planModernizationSequence } from "@/server/sequence/plan";

export type SelectResult =
  { ok: true; run: RunState } | { ok: false; code: string; message: string; status: number };

/**
 * Developer confirms a ready Domain Candidate and receives the deterministic sequence plan.
 * AI cannot alter ranking, readiness, stage count, or purpose.
 */
export function selectDomainCandidate(input: {
  runId: RunId;
  candidateId: string;
  modernizationIntent?: string;
  clientKeyHash: string;
  store?: RunStore;
}): SelectResult {
  const store = input.store ?? globalRunStore;
  const current = store.get(input.runId);
  if (!current) {
    return { ok: false, code: "RUN_NOT_FOUND", message: "Run not found or expired", status: 404 };
  }
  if (current.clientKeyHash !== input.clientKeyHash) {
    return {
      ok: false,
      code: "RUN_FORBIDDEN",
      message: "Run is bound to another client",
      status: 403,
    };
  }
  if (current.phase !== "assessed") {
    return {
      ok: false,
      code: "INVALID_PHASE",
      message: `Cannot select candidate while phase is ${current.phase}`,
      status: 409,
    };
  }

  const candidate = current.ranking.candidates.find((c) => c.id === input.candidateId);
  if (!candidate) {
    return {
      ok: false,
      code: "CANDIDATE_NOT_FOUND",
      message: `Unknown candidate id: ${input.candidateId}`,
      status: 400,
    };
  }

  const readiness = current.readinessByCandidateId.get(candidate.id);
  if (!readiness) {
    return {
      ok: false,
      code: "READINESS_MISSING",
      message: "Readiness result missing for candidate",
      status: 500,
    };
  }
  if (!readiness.ready) {
    return {
      ok: false,
      code: "CANDIDATE_NOT_READY",
      message: "Only Transformation-Ready candidates can be selected",
      status: 400,
    };
  }

  const selected = selectCandidate(current, {
    candidate,
    readiness,
    modernizationIntent: input.modernizationIntent?.slice(0, 500),
  });
  if (!selected.ok) {
    return {
      ok: false,
      code: selected.error.code,
      message: selected.error.message,
      status: 409,
    };
  }

  if (selected.state.phase !== "candidate_selected") {
    return {
      ok: false,
      code: "INVALID_PHASE",
      message: "Selection did not reach candidate_selected",
      status: 500,
    };
  }

  const files = [...selected.state.snapshot.files.values()];
  const sequence = planModernizationSequence({
    candidate,
    analysis: selected.state.analysis,
    files,
  });

  const planned = planSequence(selected.state, sequence);
  if (!planned.ok) {
    return {
      ok: false,
      code: planned.error.code,
      message: planned.error.message,
      status: 500,
    };
  }

  store.set(planned.state);
  return { ok: true, run: planned.state };
}
