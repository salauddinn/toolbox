// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { presentationFor } from "./presentation-state";
import {
  OperationStatusView,
  StagePlanView,
  reviewReadinessCopy,
  stageRailLabel,
} from "./stage-plan-view";

const stages = [
  {
    id: "stage-behavior",
    kind: "behavior_capture",
    title: "Capture current behaviour",
    purpose: "Freeze observable behaviour before modularization.",
    conditional: false,
    evidence: [
      {
        ruleId: "EVIDENCE_ROUTE_CLUSTER",
        message: "Orders routes form a cluster",
        severity: "info" as const,
        file: "routes/orders.js",
        line: 12,
        snippet: "router.get('/orders'",
      },
    ],
    expectedFiles: ["tests/behavior/orders.test.js"],
    validationCriteria: [
      {
        id: "static-parse",
        description: "Candidate snapshot must parse",
        kind: "static" as const,
      },
      {
        id: "runtime-smoke",
        description: "Runtime smoke remains advisory",
        kind: "runtime" as const,
      },
    ],
    budgets: {
      maxOperations: 20,
      maxBytesPerFile: 131072,
      maxTotalChangedBytes: 524288,
    },
  },
  {
    id: "stage-module",
    kind: "domain_module",
    title: "Extract Domain Module",
    purpose: "Move exclusive ownership into a Domain Module.",
    conditional: false,
    evidence: [],
    expectedFiles: ["src/domains/orders/index.js"],
    validationCriteria: [
      {
        id: "static-envelope",
        description: "Operations stay inside the path envelope",
        kind: "static" as const,
      },
    ],
    budgets: {
      maxOperations: 20,
      maxBytesPerFile: 131072,
      maxTotalChangedBytes: 524288,
    },
  },
  {
    id: "stage-cleanup",
    kind: "integration_cleanup",
    title: "Integrate and clean up",
    purpose: "Wire the module and remove dead paths.",
    conditional: false,
    evidence: [],
    expectedFiles: ["app.js"],
    validationCriteria: [
      {
        id: "static-entry",
        description: "Entry graph remains coherent",
        kind: "static" as const,
      },
    ],
    budgets: {
      maxOperations: 20,
      maxBytesPerFile: 131072,
      maxTotalChangedBytes: 524288,
    },
  },
  {
    id: "stage-cycle",
    kind: "cycle_repair",
    title: "Repair remaining cycle",
    purpose: "Break the supported cycle if still reachable.",
    conditional: true,
    evidence: [],
    expectedFiles: ["src/domains/orders/service.js"],
    validationCriteria: [
      {
        id: "static-cycle",
        description: "No supported cycle remains",
        kind: "static" as const,
      },
    ],
    budgets: {
      maxOperations: 20,
      maxBytesPerFile: 131072,
      maxTotalChangedBytes: 524288,
    },
  },
] as const;

function renderStagePlan(overrides: Partial<ComponentProps<typeof StagePlanView>> = {}) {
  const onAuthorize = vi.fn();
  const onInspect = vi.fn();
  const props: ComponentProps<typeof StagePlanView> = {
    stages,
    stageIndex: 0,
    phase: "awaiting_authorization",
    selectedDomain: "Orders",
    presentation: presentationFor({ kind: "run", phase: "awaiting_authorization" }),
    authorizePending: false,
    canAuthorize: true,
    busy: false,
    onAuthorize,
    onInspect,
    ...overrides,
  };
  const view = render(<StagePlanView {...props} />);
  return { ...view, onAuthorize, onInspect, props };
}

afterEach(() => {
  cleanup();
});

describe("stageRailLabel", () => {
  it("labels accepted, current, queued, conditional, failed, and stopped honestly", () => {
    expect(
      stageRailLabel({
        index: 0,
        stageIndex: 1,
        conditional: false,
        phase: "awaiting_authorization",
        stageCount: 3,
      }).primary,
    ).toBe("accepted");
    expect(
      stageRailLabel({
        index: 1,
        stageIndex: 1,
        conditional: false,
        phase: "awaiting_authorization",
        stageCount: 3,
      }).primary,
    ).toBe("current");
    expect(
      stageRailLabel({
        index: 2,
        stageIndex: 1,
        conditional: false,
        phase: "awaiting_authorization",
        stageCount: 3,
      }).primary,
    ).toBe("queued");
    expect(
      stageRailLabel({
        index: 3,
        stageIndex: 1,
        conditional: true,
        phase: "awaiting_authorization",
        stageCount: 4,
      }),
    ).toEqual({ primary: "queued", modifiers: ["conditional"] });
    expect(
      stageRailLabel({
        index: 1,
        stageIndex: 1,
        conditional: false,
        phase: "stage_failed_rolled_back",
        stageCount: 3,
      }).primary,
    ).toBe("failed");
    expect(
      stageRailLabel({
        index: 1,
        stageIndex: 1,
        conditional: false,
        phase: "sequence_stopped",
        stageCount: 3,
      }).primary,
    ).toBe("stopped");
    expect(
      stageRailLabel({
        index: 2,
        stageIndex: 1,
        conditional: false,
        phase: "completed",
        stageCount: 3,
      }).primary,
    ).toBe("accepted");
  });
});

describe("StagePlanView authorization gate", () => {
  it("shows purpose, scope, validation criteria, and budgets before authorization", () => {
    renderStagePlan();

    expect(screen.getByTestId("stage-plan-view")).toBeTruthy();
    expect(screen.getByTestId("authorization-gate")).toBeTruthy();
    expect(screen.getByText("Freeze observable behaviour before modularization.")).toBeTruthy();
    expect(screen.getByText("tests/behavior/orders.test.js")).toBeTruthy();
    expect(screen.getByText(/Candidate snapshot must parse/)).toBeTruthy();
    expect(screen.getByText("Max operations:")).toBeTruthy();
    expect(screen.getByText("20")).toBeTruthy();
    expect(screen.getByText(/Authorization only permits/)).toBeTruthy();
    expect(screen.getByTestId("authorize-stage-button").textContent).toMatch(
      /Authorize AI generation/,
    );

    const rail = screen.getByTestId("stage-plan-rail");
    expect(
      within(rail).getByTestId("stage-rail-stage-behavior").getAttribute("data-stage-label"),
    ).toBe("current");
    expect(
      within(rail).getByTestId("stage-rail-stage-module").getAttribute("data-stage-label"),
    ).toBe("queued");
    expect(within(rail).getByTestId("stage-rail-stage-cycle").textContent).toMatch(/conditional/);
  });

  it("keeps authorization separate from acceptance — no accept control on the gate", () => {
    renderStagePlan();

    expect(screen.queryByTestId("accept-change-set-button")).toBeNull();
    expect(screen.queryByText("Accept Change Set")).toBeNull();
    expect(screen.getByTestId("authorize-stage-button")).toBeTruthy();
  });

  it("invokes authorize only from the authorization gate", async () => {
    const user = userEvent.setup();
    const { onAuthorize } = renderStagePlan();

    await user.click(screen.getByTestId("authorize-stage-button"));
    expect(onAuthorize).toHaveBeenCalledTimes(1);
  });

  it("hides authorize while the request is pending and does not offer acceptance", () => {
    renderStagePlan({
      authorizePending: true,
      canAuthorize: false,
      hideAuthorizeAction: true,
      presentation: presentationFor({ kind: "local", state: "authorize-request-pending" }),
    });

    expect(screen.queryByTestId("authorization-gate")).toBeNull();
    expect(screen.queryByTestId("accept-change-set-button")).toBeNull();
    expect(screen.getByText(/Working on the authorized stage/i)).toBeTruthy();
  });
});

describe("OperationStatusView status truths", () => {
  it("uses one honest local pending state without fabricated progress", () => {
    render(
      <OperationStatusView
        kind="authorize-pending"
        presentation={presentationFor({ kind: "local", state: "authorize-request-pending" })}
        currentStageTitle="Capture current behaviour"
      />,
    );

    const status = screen.getByTestId("operation-status");
    expect(status.getAttribute("data-status-kind")).toBe("authorize-pending");
    expect(screen.getByTestId("honest-authorize-pending").textContent).toMatch(
      /generating_and_validating_authorized_stage/,
    );
    expect(screen.getByTestId("honest-authorize-pending").textContent).toMatch(
      /no live subphase, percentage, or polling feed/,
    );
    expect(screen.getByTestId("indeterminate-progress")).toBeTruthy();
    expect(screen.getByTestId("authorize-progress-steps").textContent).toMatch(
      /AI generating bounded Change Set/i,
    );
    expect(screen.getByTestId("progress-elapsed").textContent).toMatch(/working/i);
    expect(screen.getByTestId("no-fabricated-progress").textContent).toMatch(/No percentage/);
    expect(status.textContent).not.toMatch(/\d+%/);
    expect(status.textContent).not.toMatch(/subphase 2/i);
    expect(screen.queryByTestId("accept-change-set-button")).toBeNull();
  });

  it("shows durable generating/validating/repairing only as explicit server phases", () => {
    const { rerender } = render(
      <OperationStatusView
        kind="durable-generating"
        presentation={presentationFor({ kind: "run", phase: "generating" })}
        currentStageTitle="Capture current behaviour"
      />,
    );
    expect(screen.getByTestId("operation-status").getAttribute("data-status-kind")).toBe(
      "durable-generating",
    );
    expect(screen.getByTestId("durable-operation-terminal").textContent).toMatch(
      /AI generating bounded Change Set/i,
    );
    expect(screen.getByTestId("indeterminate-progress")).toBeTruthy();
    expect(screen.queryByTestId("accept-change-set-button")).toBeNull();

    rerender(
      <OperationStatusView
        kind="durable-validating"
        presentation={presentationFor({ kind: "run", phase: "validating" })}
      />,
    );
    expect(screen.getByTestId("operation-status").getAttribute("data-status-kind")).toBe(
      "durable-validating",
    );

    rerender(
      <OperationStatusView
        kind="durable-repairing"
        presentation={presentationFor({ kind: "run", phase: "repairing" })}
      />,
    );
    expect(screen.getByTestId("operation-status").getAttribute("data-status-kind")).toBe(
      "durable-repairing",
    );
    expect(screen.getByTestId("durable-operation-terminal").textContent).toMatch(/repairing/);
  });

  it("shows bounded review totals and readiness after authorize response", () => {
    render(
      <OperationStatusView
        kind="validation-passed-review"
        presentation={presentationFor({
          kind: "run",
          phase: "awaiting_acceptance",
          review: "complete-current",
        })}
        review="complete-current"
        reviewSummary={{
          changeSetId: "cs-1",
          attempt: 1,
          totals: { created: 1, updated: 2, deleted: 0 },
          fileCount: 3,
          validationOutcome: "passed",
          truncationLabels: ["previews_truncated"],
          externalTestsLabel: "not_executed",
        }}
        canAccept
        canReject
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getByTestId("review-readiness").textContent).toBe(
      reviewReadinessCopy("complete-current"),
    );
    const totals = screen.getByTestId("review-totals-terminal").textContent ?? "";
    expect(totals).toMatch(/change_set: cs-1/);
    expect(totals).toMatch(/\+1 ~2 -0/);
    expect(totals).toMatch(/validation: passed/);
    expect(totals).toMatch(/authorization already completed; acceptance is independent/);
    expect(screen.getByTestId("accept-change-set-button")).toBeTruthy();
    expect(screen.getByTestId("reject-change-set-button")).toBeTruthy();
  });

  it("does not offer acceptance prior to complete current review", () => {
    const cases = ["loading", "incomplete", "failed", "stale"] as const;
    for (const review of cases) {
      cleanup();
      render(
        <OperationStatusView
          kind={
            review === "failed" || review === "incomplete"
              ? "validation-failed"
              : "validation-passed-review"
          }
          presentation={presentationFor({
            kind: "run",
            phase: "awaiting_acceptance",
            review,
          })}
          review={review}
          reviewSummary={
            review === "incomplete"
              ? undefined
              : {
                  changeSetId: "cs-stale",
                  attempt: 1,
                  totals: { created: 0, updated: 1, deleted: 0 },
                  fileCount: 1,
                  validationOutcome: review === "failed" ? "failed" : "passed",
                }
          }
          canAccept={false}
          canReject
          onReject={vi.fn()}
        />,
      );

      expect(screen.queryByTestId("accept-change-set-button")).toBeNull();
      expect(screen.getByTestId("accept-unavailable")).toBeTruthy();
      expect(screen.getByTestId("review-readiness").textContent).toBe(reviewReadinessCopy(review));
      expect(screen.getByTestId("reject-change-set-button")).toBeTruthy();
    }
  });

  it("distinguishes rollback and stopped outcomes", () => {
    const { rerender } = render(
      <OperationStatusView
        kind="rolled-back"
        presentation={presentationFor({ kind: "run", phase: "stage_failed_rolled_back" })}
        acceptedChangeSetCount={1}
      />,
    );
    expect(screen.getByTestId("rollback-status").textContent).toMatch(/stage_failed_rolled_back/);
    expect(screen.getByTestId("operation-status").getAttribute("data-status-kind")).toBe(
      "rolled-back",
    );
    expect(screen.queryByTestId("accept-change-set-button")).toBeNull();

    rerender(
      <OperationStatusView
        kind="sequence-stopped"
        presentation={presentationFor({ kind: "run", phase: "sequence_stopped" })}
        stopReason="developer_rejected"
        acceptedChangeSetCount={1}
      />,
    );
    expect(screen.getByTestId("stopped-status").textContent).toMatch(/developer_rejected/);
    expect(screen.getByTestId("operation-status").getAttribute("data-status-kind")).toBe(
      "sequence-stopped",
    );
  });
});
