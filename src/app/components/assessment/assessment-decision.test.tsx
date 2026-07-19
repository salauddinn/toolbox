// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssessmentDecision } from "./assessment-decision";

const candidates = [
  {
    id: "orders",
    name: "Orders",
    technicalScore: 0.91,
    confidence: 0.84,
    routes: [
      {
        method: "get",
        path: "/orders",
        file: "routes/orders.js",
        line: 12,
        mountPrefix: "/api",
      },
    ],
    primaryModel: {
      modelName: "Order",
      collectionName: "orders",
      file: "models/order.js",
      line: 4,
    },
    files: ["routes/orders.js", "models/order.js"],
    signals: [
      {
        ruleId: "SIGNAL_EXCLUSIVE_WRITE",
        message: "Exclusive write ownership on Order",
        severity: "info",
        file: "routes/orders.js",
        line: 40,
        snippet: "Order.create(body)",
      },
    ],
    conflictingEvidence: [],
  },
  {
    id: "payments",
    name: "Payments",
    technicalScore: 0.55,
    confidence: 0.42,
    routes: [
      {
        method: "post",
        path: "/payments",
        file: "routes/payments.js",
        line: 8,
      },
    ],
    primaryModel: {
      modelName: "Payment",
      collectionName: "payments",
      file: "models/payment.js",
      line: 3,
    },
    files: ["routes/payments.js"],
    signals: [],
    conflictingEvidence: [
      {
        ruleId: "SIGNAL_CROSS_DOMAIN_READ",
        message: "Reads Order from Payments handlers",
        severity: "warning",
        file: "routes/payments.js",
        line: 22,
        snippet: "Order.findById",
      },
    ],
  },
] as const;

const readinessByCandidateId = {
  orders: {
    ready: true as const,
    candidateId: "orders",
    rules: [],
  },
  payments: {
    ready: false as const,
    candidateId: "payments",
    rules: [],
    failedRules: [
      {
        ruleId: "READINESS_CROSS_DOMAIN_WRITE",
        passed: false as const,
        summary: "Writes outside exclusive ownership",
        evidence: [],
      },
    ],
  },
};

function renderDecision(overrides: Partial<ComponentProps<typeof AssessmentDecision>> = {}) {
  const onPickCandidate = vi.fn();
  const onConfirm = vi.fn();
  const props: ComponentProps<typeof AssessmentDecision> = {
    sourceLabel: "fixture:controlled-example",
    entryPath: "app.js",
    routeCount: 6,
    modelCount: 3,
    cycleCount: 1,
    candidates: [...candidates],
    readinessByCandidateId,
    safestTechnicalCandidateId: "orders",
    pickedCandidateId: null,
    onPickCandidate,
    allowConfirmation: true,
    canConfirm: false,
    busy: false,
    onConfirm,
    ...overrides,
  };
  const view = render(<AssessmentDecision {...props} />);
  return { ...view, onPickCandidate, onConfirm, props };
}

afterEach(() => {
  cleanup();
});

describe("AssessmentDecision workspace", () => {
  it("renders assessment facts and starts with no candidate selected", () => {
    renderDecision();

    expect(screen.getByRole("heading", { name: "Assessment facts" })).toBeInTheDocument();
    expect(screen.getByText("fixture:controlled-example")).toBeInTheDocument();
    expect(screen.getByText("app.js")).toBeInTheDocument();
    const facts = screen.getByRole("heading", { name: "Assessment facts" }).closest("section");
    expect(facts).not.toBeNull();
    expect(within(facts as HTMLElement).getByText("6")).toBeInTheDocument();
    expect(within(facts as HTMLElement).getByText("3")).toBeInTheDocument();
    expect(within(facts as HTMLElement).getByText("1")).toBeInTheDocument();

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    for (const radio of radios) {
      expect(radio).not.toBeChecked();
    }
    expect(screen.getByText(/none selected/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm Domain Candidate" })).toBeDisabled();
    expect(screen.queryByLabelText(/modernization intent/i)).not.toBeInTheDocument();
    expect(screen.getByText(/not a business-priority order/i)).toBeInTheDocument();
    expect(screen.getByText(/Safest technical candidate \(advisory\)/i)).toBeInTheDocument();
  });

  it("keeps comparison compact and reveals detail only after selection", async () => {
    const user = userEvent.setup();
    const { onPickCandidate, rerender, props } = renderDecision();

    expect(screen.queryByText("GET /api/orders")).not.toBeInTheDocument();
    expect(screen.queryByText("Exclusive write ownership on Order")).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Orders/i }));
    expect(onPickCandidate).toHaveBeenCalledWith("orders");

    rerender(
      <AssessmentDecision
        {...props}
        pickedCandidateId="orders"
        canConfirm
        onPickCandidate={onPickCandidate}
      />,
    );

    const detail = screen
      .getByRole("heading", { name: "Selected candidate detail" })
      .closest("section");
    expect(detail).not.toBeNull();
    expect(within(detail as HTMLElement).getByText("GET /api/orders")).toBeInTheDocument();
    expect(within(detail as HTMLElement).getByText("Order")).toBeInTheDocument();
    expect(
      within(detail as HTMLElement).getByText("Exclusive write ownership on Order"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm Domain Candidate" })).toBeEnabled();
  });

  it("allows inspecting a not-ready candidate without enabling confirmation", async () => {
    const user = userEvent.setup();
    const { onPickCandidate, onConfirm, rerender, props } = renderDecision();

    await user.click(screen.getByRole("radio", { name: /Payments/i }));
    expect(onPickCandidate).toHaveBeenCalledWith("payments");

    rerender(
      <AssessmentDecision
        {...props}
        pickedCandidateId="payments"
        canConfirm={false}
        onPickCandidate={onPickCandidate}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("READINESS_CROSS_DOMAIN_WRITE")).toBeInTheDocument();
    expect(screen.getByText(/cannot be confirmed/i)).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Confirm Domain Candidate" });
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("hides confirmation entirely for assessment-only mode", () => {
    renderDecision({ allowConfirmation: false, canConfirm: false });

    expect(
      screen.queryByRole("button", { name: "Confirm Domain Candidate" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Assessment-only result/i)).toBeInTheDocument();
  });

  it("supports keyboard radio navigation within the group", async () => {
    const user = userEvent.setup();
    const { onPickCandidate, rerender, props } = renderDecision();

    const orders = screen.getByRole("radio", { name: /Orders/i });
    const payments = screen.getByRole("radio", { name: /Payments/i });

    orders.focus();
    expect(orders).toHaveFocus();

    await user.keyboard(" ");
    expect(onPickCandidate).toHaveBeenCalledWith("orders");

    rerender(
      <AssessmentDecision
        {...props}
        pickedCandidateId="orders"
        canConfirm
        onPickCandidate={onPickCandidate}
      />,
    );

    const ordersSelected = screen.getByRole("radio", { name: /Orders/i });
    expect(ordersSelected).toBeChecked();
    ordersSelected.focus();

    await user.keyboard("{ArrowDown}");
    expect(onPickCandidate).toHaveBeenCalledWith("payments");

    // Native radio groups move focus even before controlled state catches up.
    expect(document.activeElement).toBe(payments);
  });

  it("opens evidence collections and path-only route/model context without inventing fields", async () => {
    const user = userEvent.setup();
    const onInspect = vi.fn();
    const { rerender, props } = renderDecision({ onInspect });

    rerender(
      <AssessmentDecision {...props} pickedCandidateId="orders" canConfirm onInspect={onInspect} />,
    );

    await user.click(screen.getByRole("button", { name: "routes/orders.js:40" }));
    expect(onInspect).toHaveBeenCalledWith({
      kind: "evidence",
      items: candidates[0]!.signals,
      index: 0,
    });

    await user.click(screen.getByRole("button", { name: /GET \/api\/orders/i }));
    expect(onInspect).toHaveBeenCalledWith({
      kind: "file-context",
      file: "routes/orders.js",
      line: 12,
      origin: "route",
    });

    await user.click(screen.getByRole("button", { name: "models/order.js:4" }));
    expect(onInspect).toHaveBeenCalledWith({
      kind: "file-context",
      file: "models/order.js",
      line: 4,
      origin: "model",
    });
  });

  it("exposes accessible names on radios and has no critical axe violations", async () => {
    const { container } = renderDecision({
      pickedCandidateId: "orders",
      canConfirm: true,
    });

    const group = screen.getByRole("radiogroup", { name: /Domain Candidate decision/i });
    expect(within(group).getByRole("radio", { name: /Orders/i })).toHaveAccessibleName(
      /safest technical candidate, advisory only/i,
    );
    expect(within(group).getByRole("radio", { name: /Payments/i })).toHaveAccessibleName(
      /Not ready/i,
    );

    const results = await axe.run(container, {
      rules: {
        // jsdom lacks full CSS layout; landmark/region contrast rules stay useful.
        "color-contrast": { enabled: false },
      },
    });
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious).toEqual([]);
  });
});
