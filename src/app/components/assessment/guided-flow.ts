import type { PublicRunView } from "@/server/workflow/public-view";
import type { LocalPresentationState } from "./presentation-state";

export const GUIDED_STEPS = [
  { id: 1, key: "start", label: "Start", short: "Start" },
  { id: 2, key: "choose", label: "Choose", short: "Choose" },
  { id: 3, key: "authorize", label: "Authorize", short: "Authorize" },
  { id: 4, key: "review", label: "Review", short: "Review" },
  { id: 5, key: "done", label: "Done", short: "Done" },
] as const;

export type GuidedStepId = (typeof GUIDED_STEPS)[number]["id"];
export type GuidedStepKey = (typeof GUIDED_STEPS)[number]["key"];

export type GuidedStepStatus = "complete" | "current" | "upcoming" | "blocked";

/**
 * Map durable run phases / local start states onto the 5-step guided flow.
 * Presentation only — does not change server workflow semantics.
 */
export function resolveGuidedStep(input: {
  phase?: PublicRunView["phase"] | null;
  localState?: LocalPresentationState | null;
  unknownPhase?: boolean;
}): GuidedStepId {
  if (input.unknownPhase) return 1;
  if (!input.phase) {
    if (
      input.localState === "start-request-pending" ||
      input.localState === "active-run-conflict" ||
      input.localState === "replace-run-request-pending" ||
      input.localState === "no-run" ||
      !input.localState
    ) {
      return 1;
    }
    return 1;
  }

  switch (input.phase) {
    case "created":
    case "eligibility_failed":
    case "safety_failed":
      return 1;
    case "assessed":
    case "not_ready":
    case "candidate_selected":
      return 2;
    case "awaiting_authorization":
    case "generating":
    case "validating":
    case "repairing":
      return 3;
    case "awaiting_acceptance":
      return 4;
    case "completed":
      return 5;
    case "stage_failed_rolled_back":
    case "sequence_stopped":
      // Terminal outcomes still belong to the sequence path; show Review context.
      return 4;
    default:
      return 1;
  }
}

export function guidedStepStatuses(current: GuidedStepId): Record<GuidedStepId, GuidedStepStatus> {
  return {
    1: current > 1 ? "complete" : "current",
    2: current > 2 ? "complete" : current === 2 ? "current" : "upcoming",
    3: current > 3 ? "complete" : current === 3 ? "current" : "upcoming",
    4: current > 4 ? "complete" : current === 4 ? "current" : "upcoming",
    5: current === 5 ? "current" : "upcoming",
  };
}

export function guidedStepTitle(step: GuidedStepId): string {
  switch (step) {
    case 1:
      return "Start with a repository";
    case 2:
      return "Choose one domain";
    case 3:
      return "Authorize this stage";
    case 4:
      return "Review proposed changes";
    case 5:
      return "Modernization complete";
  }
}

export function guidedStepEyebrow(step: GuidedStepId): string {
  const meta = GUIDED_STEPS[step - 1]!;
  return `Step ${meta.id} of 5 · ${meta.label}`;
}
