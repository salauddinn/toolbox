// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { presentationFor } from "./presentation-state";
import { CompletionArtifact } from "./completion-artifact";

const reports = [
  {
    stageId: "stage-behavior",
    changeSetId: "cs-1",
    finalOutcome: "passed",
    externalTestsLabel: "not_executed" as const,
    attempts: [{ attempt: 1, passed: true, checkCount: 4, failedCheckIds: [] }],
  },
  {
    stageId: "stage-extract",
    changeSetId: "cs-2",
    finalOutcome: "passed",
    externalTestsLabel: "not_executed" as const,
    attempts: [
      { attempt: 1, passed: false, checkCount: 4, failedCheckIds: ["static-parse"] },
      { attempt: 2, passed: true, checkCount: 4, failedCheckIds: [] },
    ],
  },
];

function renderCompletion(overrides: Partial<ComponentProps<typeof CompletionArtifact>> = {}) {
  const props: ComponentProps<typeof CompletionArtifact> = {
    presentation: presentationFor({ kind: "run", phase: "completed" }),
    sourceLabel: "fixture:controlled-example",
    selectedCandidateName: "Orders",
    acceptedChangeSetCount: 2,
    validationReports: reports,
    downloadAvailable: true,
    downloadPath: "/api/runs/done-run/download",
    busy: false,
    confirmingEnd: false,
    onConfirmingEndChange: vi.fn(),
    onEndRun: vi.fn(),
    endError: null,
    ...overrides,
  };
  const view = render(<CompletionArtifact {...props} />);
  return { ...view, props };
}

afterEach(() => {
  cleanup();
});

describe("CompletionArtifact", () => {
  it("renders accepted-change summary, per-stage reports, and ZIP structure from public fields", () => {
    renderCompletion();

    expect(screen.getByTestId("completion-artifact")).toBeTruthy();
    expect(screen.getByTestId("completion-count").textContent).toMatch(/2/);
    expect(screen.getByTestId("completion-count").textContent).toMatch(/accepted Change Set/);
    expect(screen.getByTestId("completion-candidate").textContent).toBe("Orders");
    expect(screen.getByTestId("completion-accepted-count").textContent).toBe("2");
    expect(screen.getByTestId("completion-report-count").textContent).toBe("2");

    expect(screen.getByTestId("completion-reports-list")).toBeTruthy();
    expect(screen.getByTestId("completion-report-stage-behavior").textContent).toMatch(/passed/);
    expect(screen.getByTestId("completion-report-stage-extract").textContent).toMatch(
      /attempt 2: passed/,
    );
    expect(screen.getByTestId("completion-external-tests").textContent).toMatch(/not executed/i);

    expect(screen.getByTestId("completion-download-panel").textContent).toMatch(/repository\//);
    expect(screen.getByTestId("completion-download-panel").textContent).toMatch(
      /toolbox-validation-report\.json/,
    );

    const download = screen.getByTestId("download-result-zip");
    expect(download.getAttribute("href")).toBe("/api/runs/done-run/download");
    expect(screen.getByTestId("completion-honesty-note").textContent).toMatch(
      /does not mean Runtime Validation/i,
    );
    expect(screen.getByTestId("completion-honesty-note").textContent).toMatch(
      /does not render the full accepted repository snapshot/i,
    );
  });

  it("hides download when the API does not provide availability and path", () => {
    renderCompletion({ downloadAvailable: false, downloadPath: null });
    expect(screen.queryByTestId("download-result-zip")).toBeNull();
    expect(screen.getByTestId("download-unavailable").textContent).toMatch(
      /Download is unavailable/i,
    );
  });

  it("hides download when path is missing even if availability is true", () => {
    renderCompletion({ downloadAvailable: true, downloadPath: null });
    expect(screen.queryByTestId("download-result-zip")).toBeNull();
    expect(screen.getByTestId("download-unavailable")).toBeTruthy();
  });

  it("labels external generated tests as not executed by default", () => {
    renderCompletion({
      validationReports: [
        {
          stageId: "stage-a",
          changeSetId: "cs-a",
          finalOutcome: "passed",
          attempts: [{ attempt: 1, passed: true, checkCount: 1 }],
        },
      ],
    });
    expect(screen.getByTestId("completion-external-tests").textContent).toMatch(/not executed/i);
  });

  it("requires confirmation before ending the completed run", async () => {
    const user = userEvent.setup();
    const onConfirmingEndChange = vi.fn();
    const onEndRun = vi.fn();
    const { rerender, props } = renderCompletion({
      onConfirmingEndChange,
      onEndRun,
    });

    await user.click(screen.getByTestId("completion-end-run-button"));
    expect(onConfirmingEndChange).toHaveBeenCalledWith(true);
    expect(onEndRun).not.toHaveBeenCalled();

    rerender(
      <CompletionArtifact
        {...props}
        confirmingEnd
        onConfirmingEndChange={onConfirmingEndChange}
        onEndRun={onEndRun}
      />,
    );

    await user.click(screen.getByTestId("completion-end-confirm-submit"));
    expect(onEndRun).toHaveBeenCalledTimes(1);
  });

  it("keeps completion and download available after failed deletion", () => {
    renderCompletion({
      endError: "DELETE failed (500)",
      downloadAvailable: true,
      downloadPath: "/api/runs/done-run/download",
    });

    expect(screen.getByTestId("completion-end-error").textContent).toMatch(/did not complete/);
    expect(screen.getByTestId("download-result-zip")).toBeTruthy();
    expect(screen.getByTestId("completion-end-run-button").textContent).toMatch(/Retry end run/);
    expect(screen.getByTestId("completion-artifact")).toBeTruthy();
  });

  it("does not invent browser snapshot access or automatic acceptance", () => {
    const { container } = renderCompletion();
    const text = container.textContent ?? "";
    expect(text).toMatch(/accepted snapshot only/i);
    expect(text).not.toMatch(/automatically accepted/i);
    expect(text).not.toMatch(/full repository is shown below/i);
    expect(text).not.toMatch(/Runtime Validation passed for the live app/i);
  });

  it("has no critical or serious axe violations when download is available", async () => {
    const { container } = renderCompletion();
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious).toEqual([]);
  });

  it("has no critical or serious axe violations when download is unavailable", async () => {
    const { container } = renderCompletion({
      downloadAvailable: false,
      downloadPath: undefined,
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
