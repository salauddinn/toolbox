import { describe, expect, it } from "vitest";
import {
  guidedStepEyebrow,
  guidedStepStatuses,
  guidedStepTitle,
  resolveGuidedOutcome,
  resolveGuidedStep,
} from "./guided-flow";

describe("guided flow mapping", () => {
  it("maps start and gate failures to step 1", () => {
    expect(resolveGuidedStep({ phase: null })).toBe(1);
    expect(resolveGuidedStep({ localState: "no-run" })).toBe(1);
    expect(resolveGuidedStep({ localState: "active-run-conflict" })).toBe(1);
    expect(resolveGuidedStep({ phase: "eligibility_failed" })).toBe(1);
    expect(resolveGuidedStep({ phase: "safety_failed" })).toBe(1);
  });

  it("maps assessment decision phases to step 2", () => {
    expect(resolveGuidedStep({ phase: "assessed" })).toBe(2);
    expect(resolveGuidedStep({ phase: "not_ready" })).toBe(2);
    expect(resolveGuidedStep({ phase: "candidate_selected" })).toBe(2);
  });

  it("maps authorize pipeline to step 3 and review to step 4", () => {
    expect(resolveGuidedStep({ phase: "awaiting_authorization" })).toBe(3);
    expect(resolveGuidedStep({ phase: "generating" })).toBe(3);
    expect(resolveGuidedStep({ phase: "awaiting_acceptance" })).toBe(4);
    expect(resolveGuidedStep({ phase: "sequence_stopped" })).toBe(4);
    expect(resolveGuidedStep({ phase: "stage_failed_rolled_back" })).toBe(4);
  });

  it("maps completion to step 5", () => {
    expect(resolveGuidedStep({ phase: "completed" })).toBe(5);
  });

  it("marks earlier steps complete", () => {
    expect(guidedStepStatuses(3)).toEqual({
      1: "complete",
      2: "complete",
      3: "current",
      4: "upcoming",
      5: "upcoming",
    });
  });

  it("labels stopped and rolled-back outcomes on step 4", () => {
    expect(resolveGuidedOutcome("sequence_stopped")).toBe("stopped");
    expect(resolveGuidedOutcome("stage_failed_rolled_back")).toBe("rolled_back");
    expect(guidedStepStatuses(4, "stopped")[4]).toBe("stopped");
    expect(guidedStepStatuses(4, "rolled_back")[4]).toBe("rolled_back");
    expect(guidedStepTitle(4, "stopped")).toBe("Sequence stopped");
    expect(guidedStepTitle(4, "rolled_back")).toBe("Stage rolled back");
    expect(guidedStepEyebrow(4, "stopped")).toContain("Stopped");
    expect(guidedStepEyebrow(4, "rolled_back")).toContain("Rolled back");
  });
});
