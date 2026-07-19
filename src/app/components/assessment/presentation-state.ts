import type { PublicRunView } from "@/server/workflow/public-view";

export const WORKFLOW_STEPS = [
  "repository",
  "assessment",
  "decision",
  "sequence",
  "artifact",
] as const;

export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];
export type PresentationTone = "neutral" | "info" | "success" | "warning" | "danger";
export type PresentationScreen =
  | "repository-start"
  | "repository-progress"
  | "gate-failure"
  | "assessment"
  | "decision"
  | "stage-plan"
  | "sequence-progress"
  | "change-set-review"
  | "sequence-outcome"
  | "artifact"
  | "blocked";

export type PresentationAction =
  | "start_fixture"
  | "start_github"
  | "end_run"
  | "replace_active_run"
  | "retry_operation"
  | "dismiss_error"
  | "select_candidate"
  | "confirm_candidate"
  | "authorize_stage"
  | "accept_change_set"
  | "reject_change_set"
  | "recheck_stage"
  | "continue_with_known_blocker"
  | "download_artifact";

export type RunPhase = PublicRunView["phase"];
export type CandidateSelectionReadiness = "none" | "not-ready" | "ready";
export type ReviewReadiness = "loading" | "incomplete" | "failed" | "stale" | "complete-current";
export type PresentationOperation =
  | "start-assessment"
  | "confirm-candidate"
  | "authorize-stage"
  | "accept-change-set"
  | "reject-change-set"
  | "retry-stage"
  | "recheck-stage"
  | "continue-with-known-blocker"
  | "end-run"
  | "replace-run";

export type Presentation = Readonly<{
  step: WorkflowStep;
  heading: string;
  explanation: string;
  screen: PresentationScreen;
  tone: PresentationTone;
  busy: boolean;
  operation?: PresentationOperation;
  actions: readonly PresentationAction[];
  recoveryAction?: PresentationAction;
}>;

export type LocalPresentationState =
  | "no-run"
  | "run-expired"
  | "start-request-pending"
  | "candidate-confirm-request-pending"
  | "authorize-request-pending"
  | "accept-request-pending"
  | "reject-request-pending"
  | "end-run-request-pending"
  | "replace-run-request-pending"
  | "recheck-request-pending"
  | "continue-request-pending"
  | "active-run-conflict";

export type PresentationState =
  | {
      readonly kind: "run";
      readonly phase: RunPhase;
      readonly candidateSelection?: CandidateSelectionReadiness;
      readonly review?: ReviewReadiness;
    }
  | { readonly kind: "local"; readonly state: LocalPresentationState }
  | {
      readonly kind: "operation-error";
      readonly step: WorkflowStep;
      readonly operation: PresentationOperation;
      readonly retryable: boolean;
    }
  | { readonly kind: "unknown-phase"; readonly phase: string };

const presentationByPhase = {
  created: {
    step: "repository",
    heading: "Preparing the assessment",
    explanation: "The run has been created and is waiting for repository loading to begin.",
    screen: "repository-progress",
    tone: "info",
    busy: true,
    actions: ["end_run"],
  },
  loading: {
    step: "repository",
    heading: "Loading and screening the repository",
    explanation: "ToolBox is loading the source and running deterministic gates before analysis.",
    screen: "repository-progress",
    tone: "info",
    busy: true,
    actions: [],
  },
  eligibility_failed: {
    step: "repository",
    heading: "Repository is not eligible",
    explanation:
      "The repository did not satisfy the published eligibility contract. AI was not called.",
    screen: "gate-failure",
    tone: "danger",
    busy: false,
    actions: ["end_run"],
    recoveryAction: "end_run",
  },
  safety_failed: {
    step: "repository",
    heading: "Safety Screening rejected the repository",
    explanation: "A supported risk signal stopped the workflow before analysis or AI use.",
    screen: "gate-failure",
    tone: "danger",
    busy: false,
    actions: ["end_run"],
    recoveryAction: "end_run",
  },
  assessed: {
    step: "decision",
    heading: "Review the Modernization Assessment",
    explanation: "Compare technical candidates and inspect evidence before confirming a direction.",
    screen: "assessment",
    tone: "info",
    busy: false,
    actions: ["select_candidate", "end_run"],
  },
  not_ready: {
    step: "assessment",
    heading: "Assessment complete — no candidate is ready",
    explanation: "The assessment is available, but no Domain Candidate can enter transformation.",
    screen: "assessment",
    tone: "warning",
    busy: false,
    actions: ["end_run"],
    recoveryAction: "end_run",
  },
  candidate_selected: {
    step: "decision",
    heading: "Modernization Decision confirmed",
    explanation:
      "The developer-confirmed candidate is recorded; no sequence is assumed until exposed.",
    screen: "decision",
    tone: "success",
    busy: false,
    actions: ["end_run"],
  },
  awaiting_authorization: {
    step: "sequence",
    heading: "Review the current Stage Plan",
    explanation: "Authorization permits bounded AI generation only for this deterministic plan.",
    screen: "stage-plan",
    tone: "info",
    busy: false,
    actions: ["authorize_stage", "end_run"],
  },
  generating: {
    step: "sequence",
    heading: "Generating the authorized Change Set",
    explanation: "Generation is constrained to the current Stage Plan and its path envelope.",
    screen: "sequence-progress",
    tone: "info",
    busy: true,
    actions: [],
  },
  validating: {
    step: "sequence",
    heading: "Running Static Validation",
    explanation: "Deterministic checks are evaluating the candidate snapshot.",
    screen: "sequence-progress",
    tone: "info",
    busy: true,
    actions: [],
  },
  awaiting_acceptance: {
    step: "sequence",
    heading: "Review the validated Change Set",
    explanation: "Review the bounded diff and Validation Report before accepting or stopping.",
    screen: "change-set-review",
    tone: "warning",
    busy: false,
    actions: ["reject_change_set", "end_run"],
  },
  repairing: {
    step: "sequence",
    heading: "Running the one permitted repair attempt",
    explanation: "The bounded repair is responding to deterministic validation failures.",
    screen: "sequence-progress",
    tone: "info",
    busy: true,
    actions: [],
  },
  stage_failed_rolled_back: {
    step: "sequence",
    heading: "Stage failed and changes were rolled back",
    explanation: "The current accepted snapshot was retained after the second validation failure.",
    screen: "sequence-outcome",
    tone: "danger",
    busy: false,
    actions: ["recheck_stage", "continue_with_known_blocker", "end_run"],
    recoveryAction: "recheck_stage",
  },
  sequence_stopped: {
    step: "sequence",
    heading: "Modernization Sequence stopped",
    explanation: "Accepted work was retained and unaccepted output was not promoted.",
    screen: "sequence-outcome",
    tone: "warning",
    busy: false,
    actions: ["end_run"],
    recoveryAction: "end_run",
  },
  completed: {
    step: "artifact",
    heading: "Download the accepted artifact",
    explanation: "The ZIP contains the accepted repository snapshot and Validation Report.",
    screen: "artifact",
    tone: "success",
    busy: false,
    actions: ["download_artifact", "end_run"],
  },
  expired: {
    step: "repository",
    heading: "Run expired",
    explanation: "In-memory run state expired. Start a new assessment to continue.",
    screen: "repository-start",
    tone: "warning",
    busy: false,
    actions: ["start_fixture", "start_github"],
    recoveryAction: "start_fixture",
  },
} as const satisfies { readonly [Phase in RunPhase]: Presentation };

export const DURABLE_RUN_PHASES = Object.freeze(Object.keys(presentationByPhase) as RunPhase[]);

const localPresentation = {
  "no-run": {
    step: "repository",
    heading: "Start a Modernization Assessment",
    explanation: "Try the controlled example or enter a supported public GitHub repository.",
    screen: "repository-start",
    tone: "neutral",
    busy: false,
    actions: ["start_fixture", "start_github"],
  },
  "run-expired": {
    step: "repository",
    heading: "This run is no longer available",
    explanation:
      "The in-memory run expired, the server restarted, or this browser session changed. Start a new assessment to continue.",
    screen: "repository-start",
    tone: "warning",
    busy: false,
    actions: ["start_fixture", "start_github"],
    recoveryAction: "start_fixture",
  },
  "start-request-pending": {
    step: "repository",
    heading: "Loading, screening, and assessing the repository",
    explanation: "Deterministic checks complete before any authorized generation call.",
    screen: "repository-progress",
    tone: "info",
    busy: true,
    operation: "start-assessment",
    actions: [],
  },
  "candidate-confirm-request-pending": {
    step: "decision",
    heading: "Confirming the Modernization Decision",
    explanation: "ToolBox is recording the developer-selected Domain Candidate.",
    screen: "decision",
    tone: "info",
    busy: true,
    operation: "confirm-candidate",
    actions: [],
  },
  "authorize-request-pending": {
    step: "sequence",
    heading: "Working on the authorized stage",
    explanation:
      "AI is generating a bounded Change Set, then ToolBox runs Static Validation. This can take a minute — stay on this page until review opens.",
    screen: "sequence-progress",
    tone: "info",
    busy: true,
    operation: "authorize-stage",
    actions: [],
  },
  "accept-request-pending": {
    step: "sequence",
    heading: "Accepting the reviewed Change Set",
    explanation: "ToolBox is promoting the validated candidate snapshot.",
    screen: "change-set-review",
    tone: "info",
    busy: true,
    operation: "accept-change-set",
    actions: [],
  },
  "reject-request-pending": {
    step: "sequence",
    heading: "Stopping the Modernization Sequence",
    explanation: "ToolBox is rejecting the unaccepted Change Set and retaining accepted work.",
    screen: "change-set-review",
    tone: "info",
    busy: true,
    operation: "reject-change-set",
    actions: [],
  },
  "recheck-request-pending": {
    step: "sequence",
    heading: "Re-checking the dependency",
    explanation:
      "ToolBox is deterministically re-analyzing the accepted snapshot. No AI generation is used.",
    screen: "sequence-progress",
    tone: "info",
    busy: true,
    operation: "recheck-stage",
    actions: [],
  },
  "continue-request-pending": {
    step: "sequence",
    heading: "Recording the known blocker",
    explanation: "ToolBox is recording the unresolved blocker and moving to the next Stage Plan.",
    screen: "sequence-progress",
    tone: "info",
    busy: true,
    operation: "continue-with-known-blocker",
    actions: [],
  },
  "end-run-request-pending": {
    step: "repository",
    heading: "Ending the current run",
    explanation: "ToolBox is releasing the in-memory run before returning to repository start.",
    screen: "repository-progress",
    tone: "info",
    busy: true,
    operation: "end-run",
    actions: [],
  },
  "replace-run-request-pending": {
    step: "repository",
    heading: "Replacing the active run",
    explanation: "ToolBox is ending the previous run before retrying the requested assessment.",
    screen: "repository-progress",
    tone: "info",
    busy: true,
    operation: "replace-run",
    actions: [],
  },
  "active-run-conflict": {
    step: "repository",
    heading: "An active run must be ended first",
    explanation: "End the previous in-memory run before starting this assessment.",
    screen: "repository-start",
    tone: "warning",
    busy: false,
    actions: ["replace_active_run", "dismiss_error"],
    recoveryAction: "replace_active_run",
  },
} as const satisfies { readonly [State in LocalPresentationState]: Presentation };

const operationErrorCopy: Readonly<
  Record<PresentationOperation, { heading: string; explanation: string }>
> = {
  "start-assessment": {
    heading: "The assessment could not start",
    explanation: "No new run replaced the current state.",
  },
  "confirm-candidate": {
    heading: "The Modernization Decision was not confirmed",
    explanation: "The current assessment and local candidate choice were preserved.",
  },
  "authorize-stage": {
    heading: "The stage authorization did not complete",
    explanation: "The current accepted snapshot and Stage Plan were preserved.",
  },
  "accept-change-set": {
    heading: "The Change Set was not accepted",
    explanation: "The validated candidate snapshot was not promoted.",
  },
  "reject-change-set": {
    heading: "The Change Set was not rejected",
    explanation: "The run remains at the current Change Acceptance decision.",
  },
  "retry-stage": {
    heading: "Retrying failed stage",
    explanation:
      "ToolBox is applying the recorded Static Validation failures within the same Stage Plan.",
  },
  "recheck-stage": {
    heading: "The dependency re-check did not complete",
    explanation: "The rolled-back stage and the accepted snapshot were preserved.",
  },
  "continue-with-known-blocker": {
    heading: "The continuation was not recorded",
    explanation: "The run remains at the failed stage with the accepted snapshot preserved.",
  },
  "end-run": {
    heading: "The current run could not be ended",
    explanation: "The existing in-memory run remains available.",
  },
  "replace-run": {
    heading: "The active run could not be replaced",
    explanation: "The previous run and the attempted start details were preserved.",
  },
};

export function presentationFor(state: PresentationState): Presentation {
  if (state.kind === "local") return localPresentation[state.state];

  if (state.kind === "operation-error") {
    const actions: PresentationAction[] = state.retryable
      ? ["retry_operation", "dismiss_error"]
      : ["dismiss_error"];
    const copy = operationErrorCopy[state.operation];
    return {
      step: state.step,
      heading: copy.heading,
      explanation: `${copy.explanation} ${
        state.retryable
          ? "Retry the operation or dismiss this message."
          : "Review the error before choosing another available action."
      }`,
      screen: "blocked",
      tone: "danger",
      busy: false,
      operation: state.operation,
      actions,
      recoveryAction: state.retryable ? "retry_operation" : "dismiss_error",
    };
  }

  if (state.kind === "unknown-phase") {
    return {
      step: "repository",
      heading: "This run state is not supported by this console",
      explanation: `The server returned an unknown phase (${state.phase}). No mutation action is available.`,
      screen: "blocked",
      tone: "danger",
      busy: false,
      actions: [],
    };
  }

  const base = presentationByPhase[state.phase];
  if (state.phase === "assessed" && state.candidateSelection === "ready") {
    return { ...base, actions: [...base.actions, "confirm_candidate"] };
  }
  if (state.phase === "awaiting_acceptance" && state.review === "complete-current") {
    return { ...base, actions: ["accept_change_set", ...base.actions] };
  }
  return base;
}
