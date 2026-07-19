// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssessmentApp } from "./assessment-app";

vi.mock("./dependency-graph", () => ({
  DependencyGraph: () => null,
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === text,
  );
}

describe("AssessmentApp active-run recovery", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("ends the previous run and retries the original start once", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(429, {
          ok: false,
          code: "RATE_LIMIT_ACTIVE_CLIENT",
          message: "Only one active run per client is allowed",
          activeRunId: "old-run",
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          ok: true,
          run: {
            runId: "new-run",
            phase: "assessed",
            ranking: { candidates: [] },
            readinessByCandidateId: {},
          },
        }),
      );

    await act(async () => root.render(<AssessmentApp />));
    const start = buttonByText(container, "Try controlled example");
    expect(start).toBeDefined();
    await act(async () => start!.click());

    const recover = buttonByText(container, "End previous run and start new");
    expect(recover).toBeDefined();
    await act(async () => recover!.click());

    const confirm = buttonByText(container, "Confirm end previous run and start new");
    expect(confirm).toBeDefined();
    await act(async () => confirm!.click());

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["/api/runs", "POST"],
      ["/api/runs/old-run", "DELETE"],
      ["/api/runs", "POST"],
    ]);
    expect(container.textContent).toContain("run: new-run");
  });

  it("ends the displayed run before returning to the start screen", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(200, {
          ok: true,
          run: {
            runId: "current-run",
            phase: "assessed",
            ranking: { candidates: [] },
            readinessByCandidateId: {},
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await act(async () => root.render(<AssessmentApp />));
    await act(async () => buttonByText(container, "Try controlled example")!.click());

    const end = buttonByText(container, "End run / Start over");
    expect(end).toBeDefined();
    await act(async () => end!.click());

    const confirm = buttonByText(container, "Confirm end run");
    expect(confirm).toBeDefined();
    await act(async () => confirm!.click());

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["/api/runs", "POST"],
      ["/api/runs/current-run", "DELETE"],
    ]);
    expect(container.textContent).toContain("no active run");
  });

  it("opens evidence inspector without losing candidate selection context", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse(200, {
        ok: true,
        run: {
          runId: "assessed-run",
          phase: "assessed",
          sourceLabel: "fixture:controlled-example",
          analysis: {
            entryPath: "app.js",
            routeCount: 2,
            modelCount: 1,
            graph: {
              entryPath: "app.js",
              nodes: ["app.js"],
              edges: [],
              cycles: [],
            },
          },
          ranking: {
            safestTechnicalCandidateId: "orders",
            candidates: [
              {
                id: "orders",
                name: "Orders",
                technicalScore: 0.9,
                confidence: 0.8,
                routes: [
                  {
                    method: "get",
                    path: "/orders",
                    file: "routes/orders.js",
                    line: 12,
                  },
                ],
                primaryModel: {
                  modelName: "Order",
                  collectionName: "orders",
                  file: "models/order.js",
                  line: 4,
                },
                files: ["routes/orders.js"],
                signals: [
                  {
                    ruleId: "SIGNAL_EXCLUSIVE_WRITE",
                    message: "Exclusive write ownership on Order",
                    severity: "info",
                    file: "routes/orders.js",
                    line: 40,
                    snippet: "Order.create(body)",
                  },
                  {
                    ruleId: "SIGNAL_ROUTE_CLUSTER",
                    message: "Route cluster for Orders",
                    severity: "info",
                    file: "routes/orders.js",
                    line: 12,
                    snippet: "router.get('/orders'",
                  },
                ],
                conflictingEvidence: [],
              },
            ],
          },
          readinessByCandidateId: {
            orders: {
              ready: true,
              candidateId: "orders",
              rules: [],
            },
          },
        },
      }),
    );

    await act(async () => root.render(<AssessmentApp />));
    await act(async () => buttonByText(container, "Try controlled example")!.click());

    const ordersRadio = container.querySelector(
      'input[type="radio"][value="orders"]',
    ) as HTMLInputElement | null;
    expect(ordersRadio).not.toBeNull();
    await act(async () => {
      ordersRadio!.click();
    });
    expect(ordersRadio!.checked).toBe(true);

    const evidenceButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "routes/orders.js:40",
    );
    expect(evidenceButton).toBeDefined();
    await act(async () => evidenceButton!.click());

    const dialog = container.querySelector('[data-testid="evidence-inspector"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain("Evidence inspector");
    expect(dialog?.textContent).toContain("SIGNAL_EXCLUSIVE_WRITE");
    expect(dialog?.textContent).toContain("Order.create(body)");
    expect(dialog?.textContent).toContain("1 of 2");

    // Candidate decision context remains under the inert workspace.
    expect(ordersRadio!.checked).toBe(true);
    expect(container.textContent).toContain("Selected candidate detail");
    expect(container.textContent).toContain("Orders");

    const next = container.querySelector(
      '[data-testid="evidence-inspector-next"]',
    ) as HTMLButtonElement | null;
    expect(next).not.toBeNull();
    await act(async () => next!.click());
    expect(dialog?.textContent).toContain("SIGNAL_ROUTE_CLUSTER");
    expect(dialog?.textContent).toContain("2 of 2");
    expect(ordersRadio!.checked).toBe(true);

    const close = container.querySelector(
      '[data-testid="evidence-inspector-close"]',
    ) as HTMLButtonElement | null;
    await act(async () => close!.click());
    expect(container.querySelector('[data-testid="evidence-inspector"]')).toBeNull();
    expect(ordersRadio!.checked).toBe(true);
  });
});
