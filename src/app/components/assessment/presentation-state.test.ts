import { describe, expect, it } from "vitest";
import {
  DURABLE_RUN_PHASES,
  presentationFor,
  type CandidateSelectionReadiness,
  type LocalPresentationState,
  type PresentationAction,
  type PresentationOperation,
  type ReviewReadiness,
  type RunPhase,
  type WorkflowStep,
} from "./presentation-state";

type PhaseExpectation = readonly [phase: RunPhase, step: WorkflowStep];

const phaseExpectations = [
  ["created", "repository"],
  ["loading", "repository"],
  ["eligibility_failed", "repository"],
  ["safety_failed", "repository"],
  ["assessed", "decision"],
  ["not_ready", "assessment"],
  ["candidate_selected", "decision"],
  ["awaiting_authorization", "sequence"],
  ["generating", "sequence"],
  ["validating", "sequence"],
  ["awaiting_acceptance", "sequence"],
  ["repairing", "sequence"],
  ["stage_failed_rolled_back", "sequence"],
  ["sequence_stopped", "sequence"],
  ["completed", "artifact"],
  ["expired", "repository"],
] as const satisfies readonly PhaseExpectation[];

const consequentialActions = [
  "confirm_candidate",
  "authorize_stage",
  "accept_change_set",
  "reject_change_set",
  "download_artifact",
] as const satisfies readonly PresentationAction[];

const localStates = [
  "no-run",
  "run-expired",
  "start-request-pending",
  "candidate-confirm-request-pending",
  "authorize-request-pending",
  "accept-request-pending",
  "reject-request-pending",
  "end-run-request-pending",
  "replace-run-request-pending",
  "active-run-conflict",
] as const satisfies readonly LocalPresentationState[];

const pendingLocalStates = localStates.filter((state) =>
  state.endsWith("request-pending"),
) as Exclude<LocalPresentationState, "no-run" | "active-run-conflict">[];

describe("presentation state", () => {
  it("covers every durable public phase exactly once with complete presentation metadata", () => {
    const covered = phaseExpectations.map(([phase]) => phase);

    expect(covered).toHaveLength(DURABLE_RUN_PHASES.length);
    expect(new Set(covered).size).toBe(covered.length);
    expect([...covered].sort()).toEqual([...DURABLE_RUN_PHASES].sort());

    for (const [phase, step] of phaseExpectations) {
      const presentation = presentationFor({ kind: "run", phase });
      expect(presentation.step, phase).toBe(step);
      expect(presentation.heading, phase).not.toHaveLength(0);
      expect(presentation.explanation, phase).not.toHaveLength(0);
      expect(presentation.screen, phase).not.toHaveLength(0);
      expect(typeof presentation.busy, phase).toBe("boolean");
    }
  });

  it("keeps phase-invariant consequential actions in their supported phases", () => {
    for (const phase of DURABLE_RUN_PHASES) {
      const actions = presentationFor({ kind: "run", phase }).actions;
      for (const action of consequentialActions) {
        if (action === "confirm_candidate" || action === "accept_change_set") {
          expect(actions, `${phase} / ${action}`).not.toContain(action);
          continue;
        }
        const expected =
          (action === "authorize_stage" && phase === "awaiting_authorization") ||
          (action === "reject_change_set" && phase === "awaiting_acceptance") ||
          (action === "download_artifact" && phase === "completed");
        expect(actions.includes(action), `${phase} / ${action}`).toBe(expected);
      }
    }
  });

  it.each([
    ["none", false],
    ["not-ready", false],
    ["ready", true],
  ] satisfies readonly (readonly [CandidateSelectionReadiness, boolean])[])(
    "gates candidate confirmation for %s selection",
    (candidateSelection, expected) => {
      const actions = presentationFor({
        kind: "run",
        phase: "assessed",
        candidateSelection,
      }).actions;
      expect(actions.includes("confirm_candidate")).toBe(expected);
    },
  );

  it.each([
    ["loading", false],
    ["incomplete", false],
    ["failed", false],
    ["stale", false],
    ["complete-current", true],
  ] satisfies readonly (readonly [ReviewReadiness, boolean])[])(
    "gates Change Acceptance for %s review data",
    (review, expected) => {
      const actions = presentationFor({
        kind: "run",
        phase: "awaiting_acceptance",
        review,
      }).actions;
      expect(actions.includes("accept_change_set")).toBe(expected);
      expect(actions).toContain("reject_change_set");
    },
  );

  it("does not assume a sequence exists in candidate_selected", () => {
    const presentation = presentationFor({ kind: "run", phase: "candidate_selected" });

    expect(presentation.step).toBe("decision");
    expect(presentation.heading).toBe("Modernization Decision confirmed");
    expect(presentation.actions).not.toContain("authorize_stage");
  });

  it("marks every operation-specific pending state busy with no actions", () => {
    const operations = new Set<PresentationOperation>();
    for (const state of pendingLocalStates) {
      const presentation = presentationFor({ kind: "local", state });
      expect(presentation.busy, state).toBe(true);
      expect(presentation.actions, state).toEqual([]);
      expect(presentation.heading, state).not.toHaveLength(0);
      expect(presentation.operation, state).toBeDefined();
      operations.add(presentation.operation!);
    }
    expect(operations.size).toBe(pendingLocalStates.length);
  });

  it("covers no-run and active-run conflict recovery", () => {
    expect(presentationFor({ kind: "local", state: "no-run" })).toMatchObject({
      busy: false,
      actions: ["start_fixture", "start_github"],
    });
    expect(presentationFor({ kind: "local", state: "active-run-conflict" })).toMatchObject({
      busy: false,
      actions: ["replace_active_run", "dismiss_error"],
      recoveryAction: "replace_active_run",
    });
  });

  it("explains missing in-memory run recovery without offering a stale retry", () => {
    expect(presentationFor({ kind: "local", state: "run-expired" })).toMatchObject({
      step: "repository",
      heading: "This run is no longer available",
      actions: ["start_fixture", "start_github"],
      recoveryAction: "start_fixture",
    });
  });

  it("only offers retry for explicitly retryable operation errors", () => {
    expect(
      presentationFor({
        kind: "operation-error",
        step: "sequence",
        operation: "authorize-stage",
        retryable: true,
      }),
    ).toMatchObject({
      step: "sequence",
      operation: "authorize-stage",
      actions: ["retry_operation", "dismiss_error"],
      recoveryAction: "retry_operation",
    });
    expect(
      presentationFor({
        kind: "operation-error",
        step: "decision",
        operation: "confirm-candidate",
        retryable: false,
      }),
    ).toMatchObject({
      step: "decision",
      operation: "confirm-candidate",
      actions: ["dismiss_error"],
      recoveryAction: "dismiss_error",
    });
  });

  it("distinguishes failures for operations in the same workflow step", () => {
    const authorize = presentationFor({
      kind: "operation-error",
      step: "sequence",
      operation: "authorize-stage",
      retryable: true,
    });
    const accept = presentationFor({
      kind: "operation-error",
      step: "sequence",
      operation: "accept-change-set",
      retryable: true,
    });
    const reject = presentationFor({
      kind: "operation-error",
      step: "sequence",
      operation: "reject-change-set",
      retryable: false,
    });

    expect(new Set([authorize.heading, accept.heading, reject.heading]).size).toBe(3);
    expect(authorize.operation).toBe("authorize-stage");
    expect(accept.operation).toBe("accept-change-set");
    expect(reject.operation).toBe("reject-change-set");
  });

  it("blocks mutation actions for unknown runtime phases", () => {
    expect(presentationFor({ kind: "unknown-phase", phase: "future_phase" })).toMatchObject({
      screen: "blocked",
      busy: false,
      actions: [],
    });
  });

  it("provides expired-run recovery without mutation of the expired run", () => {
    expect(presentationFor({ kind: "run", phase: "expired" })).toMatchObject({
      step: "repository",
      actions: ["start_fixture", "start_github"],
      recoveryAction: "start_fixture",
    });
  });
});
