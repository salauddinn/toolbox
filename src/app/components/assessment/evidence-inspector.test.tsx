// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EvidenceInspector } from "./evidence-inspector";
import type { EvidenceInspectorState, EvidenceRecord } from "./evidence-types";
import { toInspectorState } from "./evidence-types";

const evidenceItems: EvidenceRecord[] = [
  {
    ruleId: "SIGNAL_EXCLUSIVE_WRITE",
    message: "Exclusive write ownership on Order",
    severity: "info",
    file: "routes/orders.js",
    line: 40,
    snippet: "Order.create(body)",
  },
  {
    ruleId: "SIGNAL_CROSS_DOMAIN_READ",
    message: "Reads Order from Payments handlers",
    severity: "warning",
    file: "routes/payments.js",
    line: 22,
    snippet: "Order.findById",
  },
];

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

function Harness({ initial }: { initial: EvidenceInspectorState }) {
  const [state, setState] = useState<EvidenceInspectorState | null>(initial);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div>
      <h1 id="assessment-workspace-heading" tabIndex={-1}>
        Modernization Assessment
      </h1>
      <button ref={triggerRef} type="button">
        Open evidence
      </button>
      <EvidenceInspector
        state={state}
        triggerRef={triggerRef}
        fallbackFocusId="assessment-workspace-heading"
        onClose={() => setState(null)}
        onNavigate={(index) =>
          setState((current) =>
            current && current.mode === "evidence" ? { ...current, index } : current,
          )
        }
      />
    </div>
  );
}

describe("EvidenceInspector", () => {
  it("renders full evidence fields for an evidence selection", () => {
    render(
      <Harness
        initial={{
          mode: "evidence",
          items: evidenceItems,
          index: 0,
        }}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Evidence inspector" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByText("routes/orders.js:40")).toBeInTheDocument();
    expect(within(dialog).getByText("SIGNAL_EXCLUSIVE_WRITE")).toBeInTheDocument();
    expect(within(dialog).getByText("info")).toBeInTheDocument();
    expect(within(dialog).getByText("Exclusive write ownership on Order")).toBeInTheDocument();
    expect(within(dialog).getByText("Order.create(body)")).toBeInTheDocument();
    expect(within(dialog).getByText("1 of 2")).toBeInTheDocument();
  });

  it("navigates previous and next within the current evidence collection only", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{
          mode: "evidence",
          items: evidenceItems,
          index: 0,
        }}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByTestId("evidence-inspector-prev")).toBeDisabled();
    await user.click(within(dialog).getByTestId("evidence-inspector-next"));

    expect(within(dialog).getByText("routes/payments.js:22")).toBeInTheDocument();
    expect(within(dialog).getByText("SIGNAL_CROSS_DOMAIN_READ")).toBeInTheDocument();
    expect(within(dialog).getByText("2 of 2")).toBeInTheDocument();
    expect(within(dialog).getByTestId("evidence-inspector-next")).toBeDisabled();

    await user.click(within(dialog).getByTestId("evidence-inspector-prev"));
    expect(within(dialog).getByText("routes/orders.js:40")).toBeInTheDocument();
    expect(within(dialog).getByText("1 of 2")).toBeInTheDocument();
  });

  it("opens graph file context without inventing rule, severity, message, or snippet", () => {
    render(
      <Harness
        initial={{
          mode: "file-context",
          file: "services/orders.js",
          line: 18,
          origin: "graph",
        }}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Dependency file context" });
    expect(within(dialog).getByText("services/orders.js")).toBeInTheDocument();
    expect(within(dialog).getByText("18")).toBeInTheDocument();
    expect(within(dialog).getByText("Dependency graph")).toBeInTheDocument();
    expect(within(dialog).getByTestId("file-context-no-evidence-fields")).toBeInTheDocument();
    expect(within(dialog).queryByText(/rule id/i)).not.toBeInTheDocument();
    expect(screen.queryByText("SIGNAL_EXCLUSIVE_WRITE")).not.toBeInTheDocument();
    expect(screen.queryByTestId("evidence-inspector-next")).not.toBeInTheDocument();
  });

  it("shows path-only graph node context when line is unavailable", () => {
    render(
      <Harness
        initial={{
          mode: "file-context",
          file: "app.js",
          origin: "graph",
        }}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Dependency file context" });
    expect(within(dialog).getByText("app.js")).toBeInTheDocument();
    expect(within(dialog).getByText("Not available for this selection")).toBeInTheDocument();
  });

  it("moves initial focus into the dialog and restores focus on close", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{
          mode: "evidence",
          items: evidenceItems,
          index: 0,
        }}
      />,
    );

    const close = screen.getByTestId("evidence-inspector-close");
    expect(close).toHaveFocus();

    await user.click(close);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open evidence" })).toHaveFocus();
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{
          mode: "file-context",
          file: "models/order.js",
          line: 4,
          origin: "model",
        }}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open evidence" })).toHaveFocus();
  });

  it("traps Tab focus within the dialog", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{
          mode: "evidence",
          items: evidenceItems,
          index: 0,
        }}
      />,
    );

    const dialog = screen.getByRole("dialog");
    const close = within(dialog).getByTestId("evidence-inspector-close");
    const prev = within(dialog).getByTestId("evidence-inspector-prev");
    const next = within(dialog).getByTestId("evidence-inspector-next");

    expect(close).toHaveFocus();
    await user.tab();
    expect(next).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(next).toHaveFocus();
    expect(prev).toBeDisabled();
  });

  it("falls back to the workspace heading when the trigger is gone", async () => {
    const user = userEvent.setup();

    function FallbackHarness() {
      const [state, setState] = useState<EvidenceInspectorState | null>({
        mode: "evidence",
        items: evidenceItems,
        index: 0,
      });
      const [showTrigger, setShowTrigger] = useState(true);
      const triggerRef = useRef<HTMLButtonElement | null>(null);

      return (
        <div>
          <h1 id="assessment-workspace-heading" tabIndex={-1}>
            Modernization Assessment
          </h1>
          {showTrigger ? (
            <button ref={triggerRef} type="button">
              Temporary trigger
            </button>
          ) : null}
          <button type="button" onClick={() => setShowTrigger(false)}>
            Remove trigger
          </button>
          <EvidenceInspector
            state={state}
            triggerRef={triggerRef}
            fallbackFocusId="assessment-workspace-heading"
            onClose={() => setState(null)}
            onNavigate={() => undefined}
          />
        </div>
      );
    }

    render(<FallbackHarness />);
    await user.click(screen.getByRole("button", { name: "Remove trigger" }));
    await user.click(screen.getByTestId("evidence-inspector-close"));
    expect(screen.getByRole("heading", { name: "Modernization Assessment" })).toHaveFocus();
  });

  it("has no critical or serious axe violations when open", async () => {
    const { container } = render(
      <Harness
        initial={{
          mode: "evidence",
          items: evidenceItems,
          index: 0,
        }}
      />,
    );

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

describe("toInspectorState", () => {
  it("clamps evidence index into the collection bounds", () => {
    expect(toInspectorState({ kind: "evidence", items: evidenceItems, index: 99 })).toEqual({
      mode: "evidence",
      items: evidenceItems,
      index: 1,
    });
    expect(toInspectorState({ kind: "evidence", items: evidenceItems, index: -3 })).toEqual({
      mode: "evidence",
      items: evidenceItems,
      index: 0,
    });
  });
});

describe("EvidenceInspector controlled callbacks", () => {
  it("invokes onNavigate and onClose from chrome controls", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onNavigate = vi.fn();

    render(
      <EvidenceInspector
        state={{ mode: "evidence", items: evidenceItems, index: 0 }}
        onClose={onClose}
        onNavigate={onNavigate}
      />,
    );

    await user.click(screen.getByTestId("evidence-inspector-next"));
    expect(onNavigate).toHaveBeenCalledWith(1);
    await user.click(screen.getByTestId("evidence-inspector-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
