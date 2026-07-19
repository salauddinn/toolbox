// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { presentationFor } from "./presentation-state";
import { SequenceOutcome } from "./sequence-outcome";

function renderOutcome(overrides: Partial<ComponentProps<typeof SequenceOutcome>> = {}) {
  const props: ComponentProps<typeof SequenceOutcome> = {
    kind: "stage_failed_rolled_back",
    presentation: presentationFor({ kind: "run", phase: "stage_failed_rolled_back" }),
    sourceLabel: "fixture:controlled-example",
    selectedCandidateName: "Orders",
    currentStageTitle: "Capture current behaviour",
    acceptedChangeSetCount: 1,
    validationReport: {
      stageId: "stage-behavior",
      changeSetId: "cs-fail",
      finalOutcome: "failed_rolled_back",
      externalTestsLabel: "not_executed",
      attempts: [
        {
          attempt: 1,
          passed: false,
          checks: [
            { id: "static-parse", kind: "static", title: "parse", outcome: "failed" },
            { id: "static-envelope", kind: "static", title: "envelope", outcome: "passed" },
          ],
        },
        {
          attempt: 2,
          passed: false,
          checks: [{ id: "static-parse", kind: "static", title: "parse", outcome: "failed" }],
        },
      ],
    },
    busy: false,
    confirmingEnd: false,
    onConfirmingEndChange: vi.fn(),
    onEndRun: vi.fn(),
    endError: null,
    ...overrides,
  };
  const view = render(<SequenceOutcome {...props} />);
  return { ...view, props };
}

afterEach(() => {
  cleanup();
});

describe("SequenceOutcome", () => {
  it("explains rollback: what failed, what was preserved, and next safe action", () => {
    renderOutcome();

    expect(screen.getByTestId("sequence-outcome").getAttribute("data-outcome-kind")).toBe(
      "stage_failed_rolled_back",
    );
    expect(screen.getByTestId("outcome-code").textContent).toMatch(/stage_failed_rolled_back/);
    expect(screen.getByTestId("rollback-status").textContent).toMatch(/rolled back/i);
    expect(screen.getByTestId("outcome-preserved").textContent).toMatch(
      /accepted snapshot retained/i,
    );
    expect(screen.getByTestId("outcome-preserved").textContent).toMatch(/1 accepted Change Set/);
    expect(screen.getByTestId("outcome-not-promoted").textContent).toMatch(
      /Failed candidate Change Set/i,
    );
    expect(screen.getByTestId("outcome-accepted-count").textContent).toBe("1");
    expect(screen.getByTestId("outcome-validation-summary").textContent).toMatch(
      /failed_rolled_back/,
    );
    expect(screen.getByTestId("outcome-validation-summary").textContent).toMatch(
      /attempt 1: failed/,
    );
    expect(screen.getByTestId("outcome-validation-summary").textContent).toMatch(
      /attempt 2: failed/,
    );
    expect(screen.getByTestId("outcome-validation-summary").textContent).toMatch(
      /Static Validation examines repository artifacts only/,
    );
    expect(screen.getByTestId("outcome-honesty-note").textContent).toMatch(
      /No automatic acceptance/,
    );
    expect(screen.getByTestId("outcome-honesty-note").textContent).not.toMatch(
      /Runtime Validation of the live application completed/i,
    );
    expect(screen.queryByTestId("download-result-zip")).toBeNull();
    expect(screen.getByTestId("outcome-end-run").textContent).toMatch(/next safe action/i);
    expect(screen.getByTestId("rollback-terminal").textContent).toMatch(/download: unavailable/);
    expect(screen.getByTestId("rollback-terminal").textContent).toMatch(/acceptance: not_granted/);
  });

  it("explains developer-rejected stop without implying acceptance or download", () => {
    renderOutcome({
      kind: "sequence_stopped",
      presentation: presentationFor({ kind: "run", phase: "sequence_stopped" }),
      stopReason: "developer_rejected",
      validationReport: undefined,
      acceptedChangeSetCount: 2,
    });

    expect(screen.getByTestId("sequence-outcome").getAttribute("data-outcome-kind")).toBe(
      "sequence_stopped",
    );
    expect(screen.getByTestId("stopped-status")).toBeTruthy();
    expect(screen.getByTestId("outcome-stop-reason").textContent).toBe("developer_rejected");
    expect(screen.getByTestId("outcome-reason-label").textContent).toMatch(/Developer rejected/i);
    expect(screen.getByTestId("outcome-why").textContent).toMatch(/discarded|not promoted/i);
    expect(screen.getByTestId("outcome-preserved").textContent).toMatch(/2 accepted Change Sets/);
    expect(screen.getByTestId("outcome-not-promoted").textContent).toMatch(
      /rejected by the developer/i,
    );
    expect(screen.getByTestId("stopped-terminal").textContent).toMatch(/developer_rejected/);
    expect(screen.queryByTestId("download-result-zip")).toBeNull();
    expect(screen.getByTestId("outcome-honesty-note").textContent).toMatch(/not a completed/i);
  });

  it.each([
    ["validation_rollback", /Validation rollback/i],
    ["manual_stop", /stopped manually/i],
  ] as const)("maps stop reason %s to honest copy", (reason, label) => {
    renderOutcome({
      kind: "sequence_stopped",
      presentation: presentationFor({ kind: "run", phase: "sequence_stopped" }),
      stopReason: reason,
      validationReport: {
        stageId: "stage-x",
        changeSetId: "cs-x",
        finalOutcome: "failed_rolled_back",
        attempts: [{ attempt: 2, passed: false, checks: [] }],
      },
    });
    expect(screen.getByTestId("outcome-reason-label").textContent).toMatch(label);
    expect(screen.getByTestId("outcome-stop-reason").textContent).toBe(reason);
  });

  it("requires confirmation before ending the run and supports cancel", async () => {
    const user = userEvent.setup();
    const onConfirmingEndChange = vi.fn();
    const onEndRun = vi.fn();
    const { rerender, props } = renderOutcome({
      onConfirmingEndChange,
      onEndRun,
      confirmingEnd: false,
    });

    await user.click(screen.getByTestId("outcome-end-run-button"));
    expect(onConfirmingEndChange).toHaveBeenCalledWith(true);
    expect(onEndRun).not.toHaveBeenCalled();

    rerender(
      <SequenceOutcome
        {...props}
        confirmingEnd
        onConfirmingEndChange={onConfirmingEndChange}
        onEndRun={onEndRun}
      />,
    );

    expect(screen.getByTestId("outcome-end-confirm")).toBeTruthy();
    await user.click(screen.getByTestId("outcome-end-confirm-cancel"));
    expect(onConfirmingEndChange).toHaveBeenCalledWith(false);
    expect(onEndRun).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("outcome-end-confirm-submit"));
    expect(onEndRun).toHaveBeenCalledTimes(1);
  });

  it("recovers from failed deletion while preserving the outcome", async () => {
    const user = userEvent.setup();
    const onConfirmingEndChange = vi.fn();
    const onEndRun = vi.fn();
    renderOutcome({
      endError: "DELETE failed (503)",
      confirmingEnd: false,
      onConfirmingEndChange,
      onEndRun,
    });

    expect(screen.getByTestId("outcome-end-error").textContent).toMatch(/End run did not complete/);
    expect(screen.getByTestId("outcome-end-error").textContent).toMatch(/DELETE failed/);
    expect(screen.getByTestId("sequence-outcome")).toBeTruthy();
    expect(screen.getByTestId("outcome-end-run-button").textContent).toMatch(/Retry end run/);

    await user.click(screen.getByTestId("outcome-end-run-button"));
    expect(onConfirmingEndChange).toHaveBeenCalledWith(true);
  });

  it("never claims rolled-back output is accepted", () => {
    const { container } = renderOutcome({ acceptedChangeSetCount: 0 });
    const text = container.textContent ?? "";
    expect(text).toMatch(/not promoted/i);
    expect(text).toMatch(/acceptance: not_granted/);
    expect(text).not.toMatch(/accepted artifact ready/i);
    expect(text).not.toMatch(/automatically accepted/i);
  });

  it("has no critical or serious axe violations on rollback", async () => {
    const { container } = renderOutcome();
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious).toEqual([]);
  });

  it("has no critical or serious axe violations on stopped outcome", async () => {
    const { container } = renderOutcome({
      kind: "sequence_stopped",
      presentation: presentationFor({ kind: "run", phase: "sequence_stopped" }),
      stopReason: "developer_rejected",
    });
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious).toEqual([]);
  });
});
