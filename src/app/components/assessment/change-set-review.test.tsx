// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { presentationFor, type ReviewReadiness } from "./presentation-state";
import { ChangeSetReview } from "./change-set-review";
import type { ChangeSetReviewPayload } from "./change-set-review";

const completePayload: ChangeSetReviewPayload = {
  changeSetId: "cs-review-1",
  attempt: 1,
  totals: { created: 1, updated: 1, deleted: 1 },
  files: [
    {
      path: "tests/behavior/orders.test.js",
      kind: "create",
      bytes: 240,
      afterPreview: "describe('orders', () => {",
    },
    {
      path: "routes/orders.js",
      kind: "update",
      bytes: 512,
      beforePreview: "router.get('/orders', list)",
      afterPreview: "router.get('/orders', domain.list)",
    },
    {
      path: "legacy/orders-helper.js",
      kind: "delete",
      beforePreview: "module.exports = helper",
    },
  ],
  validationReport: {
    stageId: "stage-behavior",
    changeSetId: "cs-review-1",
    finalOutcome: "passed",
    externalTestsLabel: "not_executed",
    attempts: [
      {
        attempt: 1,
        passed: true,
        checks: [
          {
            id: "static-parse",
            kind: "static",
            title: "Candidate snapshot parses",
            outcome: "passed",
            detail: "All changed JS files parsed.",
          },
          {
            id: "static-envelope",
            kind: "static",
            title: "Path envelope honored",
            outcome: "passed",
          },
          {
            id: "runtime-smoke",
            kind: "runtime",
            title: "Runtime smoke (advisory)",
            outcome: "passed",
            detail: "Not executed in browser; labelled for review.",
          },
        ],
      },
    ],
  },
  truncationLabels: ["previews_truncated"],
};

function renderReview(overrides: Partial<ComponentProps<typeof ChangeSetReview>> = {}) {
  const props: ComponentProps<typeof ChangeSetReview> = {
    presentation: presentationFor({
      kind: "run",
      phase: "awaiting_acceptance",
      review: "complete-current",
    }),
    review: "complete-current",
    reviewPayload: completePayload,
    currentStageTitle: "Capture current behaviour",
    canAccept: true,
    canReject: true,
    busy: false,
    onAccept: vi.fn(),
    onReject: vi.fn(),
    onRefreshReview: vi.fn(),
    ...overrides,
  };
  const view = render(<ChangeSetReview {...props} />);
  return { ...view, props };
}

afterEach(() => {
  cleanup();
});

describe("ChangeSetReview workspace", () => {
  it("renders decision-grade totals, navigator, previews, and validation ledger", async () => {
    const user = userEvent.setup();
    renderReview();

    expect(screen.getByTestId("change-set-review").getAttribute("data-review-readiness")).toBe(
      "complete-current",
    );
    const totals = screen.getByTestId("review-totals-terminal").textContent ?? "";
    expect(totals).toMatch(/change_set: cs-review-1/);
    expect(totals).toMatch(/attempt: 1/);
    expect(totals).toMatch(/\+1 ~1 -1/);
    expect(totals).toMatch(/truncation: previews_truncated/);
    expect(screen.getByTestId("truncation-labels").textContent).toMatch(
      /previews are intentionally truncated/i,
    );

    const navigator = screen.getByTestId("changed-file-navigator");
    expect(within(navigator).getByRole("option", { name: /orders\.test\.js/i })).toBeTruthy();
    expect(within(navigator).getByText("created")).toBeTruthy();
    expect(within(navigator).getByText("updated")).toBeTruthy();
    expect(within(navigator).getByText("deleted")).toBeTruthy();

    // Default selection is the first file (create) with all-additions diff.
    const firstDiff = screen.getByTestId("unified-diff");
    expect(firstDiff.textContent).toMatch(/diff --git a\/tests\/behavior\/orders\.test\.js/);
    expect(firstDiff.textContent).toMatch(/\+describe\('orders'/);

    await user.click(screen.getByTestId("review-file-routes/orders.js"));
    const updateDiff = screen.getByTestId("unified-diff");
    expect(updateDiff.textContent).toMatch(/-router\.get\('\/orders', list\)/);
    expect(updateDiff.textContent).toMatch(/\+router\.get\('\/orders', domain\.list\)/);

    await user.click(screen.getByTestId("review-file-legacy/orders-helper.js"));
    expect(screen.getByTestId("delete-consequence").textContent).toMatch(/Delete operation/);
    const deleteDiff = screen.getByTestId("unified-diff");
    expect(deleteDiff.textContent).toMatch(/-module\.exports = helper/);

    expect(screen.getByTestId("validation-ledger")).toBeTruthy();
    expect(screen.getByTestId("validation-final-outcome").textContent).toMatch(/passed/);
    expect(screen.getByTestId("external-tests-label").textContent).toMatch(/not executed/i);
    expect(screen.getByTestId("check-group-static").textContent).toMatch(/Static Validation/);
    expect(screen.getByTestId("check-group-runtime").textContent).toMatch(/Runtime Validation/);
    expect(screen.getByTestId("validation-check-static-parse").textContent).toMatch(/parses/);
    expect(screen.getByTestId("validation-check-runtime-smoke").textContent).toMatch(/advisory/i);

    expect(screen.getByTestId("accept-consequence").textContent).toMatch(
      /promotes the validated candidate snapshot/i,
    );
    expect(screen.getByTestId("reject-consequence").textContent).toMatch(
      /stops the Modernization Sequence/i,
    );
    expect(screen.getByTestId("accept-change-set-button")).toBeEnabled();
  });

  it.each(["loading", "incomplete", "failed", "stale"] satisfies readonly ReviewReadiness[])(
    "disables Accept for %s review readiness",
    (review) => {
      renderReview({
        review,
        canAccept: false,
        presentation: presentationFor({
          kind: "run",
          phase: "awaiting_acceptance",
          review,
        }),
        reviewPayload: review === "incomplete" ? null : completePayload,
      });

      expect(screen.queryByTestId("accept-change-set-button")).toBeNull();
      expect(screen.getByTestId("accept-unavailable")).toBeTruthy();
      expect(screen.getByTestId("review-recovery")).toBeTruthy();
      expect(screen.getByTestId("review-readiness").textContent).toMatch(
        /Acceptance stays unavailable/i,
      );
      if (review !== "loading") {
        expect(screen.getByTestId("refresh-review-button")).toBeEnabled();
      }
    },
  );

  it("refreshes stale or incomplete review payloads via recovery action", async () => {
    const user = userEvent.setup();
    const onRefreshReview = vi.fn();
    renderReview({
      review: "stale",
      canAccept: false,
      presentation: presentationFor({
        kind: "run",
        phase: "awaiting_acceptance",
        review: "stale",
      }),
      onRefreshReview,
    });

    await user.click(screen.getByTestId("refresh-review-button"));
    expect(onRefreshReview).toHaveBeenCalledTimes(1);
  });

  it("requires confirmation before Reject and stop, with keyboard Escape restore", async () => {
    const user = userEvent.setup();
    const onReject = vi.fn();
    renderReview({ onReject });

    const rejectButton = screen.getByTestId("reject-change-set-button");
    await user.click(rejectButton);

    const dialog = screen.getByTestId("reject-confirm-dialog");
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.textContent).toMatch(/stops the Modernization Sequence/i);
    expect(document.activeElement).toBe(screen.getByTestId("reject-confirm-cancel"));

    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("reject-confirm-dialog")).toBeNull();
    expect(onReject).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(rejectButton);

    await user.click(rejectButton);
    await user.click(screen.getByTestId("reject-confirm-submit"));
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("reject-confirm-dialog")).toBeNull();
  });

  it("keeps focus inside the reject dialog while open (Tab cycle)", async () => {
    const user = userEvent.setup();
    renderReview();

    await user.click(screen.getByTestId("reject-change-set-button"));
    const cancel = screen.getByTestId("reject-confirm-cancel");
    const confirm = screen.getByTestId("reject-confirm-submit");
    expect(document.activeElement).toBe(cancel);

    await user.tab();
    expect(document.activeElement).toBe(confirm);
    await user.tab();
    expect(document.activeElement).toBe(cancel);
  });

  it("calls Accept only when complete-current and enabled", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    renderReview({ onAccept, canAccept: true, review: "complete-current" });

    await user.click(screen.getByTestId("accept-change-set-button"));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("has no critical or serious axe violations on the complete review workspace", async () => {
    const { container } = renderReview();

    const results = await axe.run(container, {
      rules: {
        "color-contrast": { enabled: false },
      },
    });
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious).toEqual([]);
  });

  it("has no critical or serious axe violations on incomplete recovery state", async () => {
    const { container } = renderReview({
      review: "incomplete",
      canAccept: false,
      reviewPayload: null,
      presentation: presentationFor({
        kind: "run",
        phase: "awaiting_acceptance",
        review: "incomplete",
      }),
    });

    const results = await axe.run(container, {
      rules: {
        "color-contrast": { enabled: false },
      },
    });
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious).toEqual([]);
  });
});
