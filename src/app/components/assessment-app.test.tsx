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

const stageFixture = {
  id: "stage-behavior",
  kind: "behavior_capture",
  title: "Capture current behaviour",
  purpose: "Freeze observable behaviour before modularization.",
  conditional: false,
  evidence: [
    {
      ruleId: "EVIDENCE_ROUTE_CLUSTER",
      message: "Orders routes form a cluster",
      severity: "info",
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
      kind: "static",
    },
  ],
  budgets: {
    maxOperations: 20,
    maxBytesPerFile: 131072,
    maxTotalChangedBytes: 524288,
  },
};

const sequenceFixture = {
  stages: [
    stageFixture,
    {
      ...stageFixture,
      id: "stage-module",
      kind: "domain_module",
      title: "Extract Domain Module",
      purpose: "Move exclusive ownership into a Domain Module.",
      evidence: [],
      expectedFiles: ["src/domains/orders/index.js"],
    },
    {
      ...stageFixture,
      id: "stage-cleanup",
      kind: "integration_cleanup",
      title: "Integrate and clean up",
      purpose: "Wire the module and remove dead paths.",
      evidence: [],
      expectedFiles: ["app.js"],
    },
  ],
  hasConditionalStage: false,
};

describe("AssessmentApp Stage Plan and operation status (U08)", () => {
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

  it("renders authorization gate with Stage Plan contract and no acceptance control", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse(200, {
        ok: true,
        run: {
          runId: "auth-run",
          phase: "awaiting_authorization",
          sourceLabel: "fixture:controlled-example",
          selectedCandidate: { id: "orders", name: "Orders" },
          sequence: sequenceFixture,
          stageIndex: 0,
          currentStage: stageFixture,
          acceptedChangeSetCount: 0,
        },
      }),
    );

    await act(async () => root.render(<AssessmentApp />));
    await act(async () => buttonByText(container, "Try controlled example")!.click());

    expect(container.querySelector('[data-testid="stage-plan-view"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="authorization-gate"]')).not.toBeNull();
    expect(container.textContent).toContain("Freeze observable behaviour before modularization.");
    expect(container.textContent).toContain("tests/behavior/orders.test.js");
    expect(container.textContent).toContain("Max operations:");
    expect(container.textContent).toContain("Candidate snapshot must parse");
    expect(container.textContent).toContain("Authorize AI generation for this stage");
    expect(container.textContent).toMatch(/not Change Acceptance/i);
    expect(buttonByText(container, "Accept Change Set")).toBeUndefined();
    expect(container.querySelector('[data-testid="accept-change-set-button"]')).toBeNull();
  });

  it("shows honest authorize-pending status without acceptance or fabricated progress", async () => {
    let resolveAuthorize: ((value: Response) => void) | undefined;
    const authorizeResponse = new Promise<Response>((resolve) => {
      resolveAuthorize = resolve;
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/runs" && init?.method === "POST") {
        return jsonResponse(200, {
          ok: true,
          run: {
            runId: "pending-auth-run",
            phase: "awaiting_authorization",
            sourceLabel: "fixture:controlled-example",
            selectedCandidate: { id: "orders", name: "Orders" },
            sequence: sequenceFixture,
            stageIndex: 0,
            currentStage: stageFixture,
            acceptedChangeSetCount: 0,
          },
        });
      }
      if (url === "/api/runs/pending-auth-run/authorize" && init?.method === "POST") {
        return authorizeResponse;
      }
      throw new Error(`Unexpected fetch: ${url} ${init?.method}`);
    });

    await act(async () => root.render(<AssessmentApp />));
    await act(async () => buttonByText(container, "Try controlled example")!.click());

    const authorize = buttonByText(container, "Authorize AI generation for this stage");
    expect(authorize).toBeDefined();

    await act(async () => {
      authorize!.click();
    });

    expect(container.querySelector('[data-testid="honest-authorize-pending"]')).not.toBeNull();
    expect(container.textContent).toMatch(/Working on the authorized stage/i);
    expect(container.querySelector('[data-testid="indeterminate-progress"]')).not.toBeNull();
    expect(container.textContent).toContain("no live subphase, percentage, or polling feed");
    expect(container.textContent).not.toMatch(/\d+%/);
    expect(buttonByText(container, "Accept Change Set")).toBeUndefined();
    expect(container.querySelector('[data-testid="authorization-gate"]')).toBeNull();

    await act(async () => {
      resolveAuthorize?.(
        jsonResponse(200, {
          ok: true,
          run: {
            runId: "pending-auth-run",
            phase: "awaiting_acceptance",
            sourceLabel: "fixture:controlled-example",
            selectedCandidate: { id: "orders", name: "Orders" },
            sequence: sequenceFixture,
            stageIndex: 0,
            currentStage: stageFixture,
            acceptedChangeSetCount: 0,
            changeSet: {
              id: "cs-1",
              stageId: stageFixture.id,
              stageKind: stageFixture.kind,
              status: "validated",
              attempt: 1,
              operations: [{ type: "create", path: "tests/behavior/orders.test.js", bytes: 120 }],
            },
            candidateFileCount: 12,
            reviewPayload: {
              changeSetId: "cs-1",
              attempt: 1,
              totals: { created: 1, updated: 0, deleted: 0 },
              files: [{ path: "tests/behavior/orders.test.js", kind: "create", bytes: 120 }],
              validationReport: {
                stageId: stageFixture.id,
                changeSetId: "cs-1",
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
                        title: "parse",
                        outcome: "passed",
                      },
                    ],
                  },
                ],
              },
              truncationLabels: [],
            },
            validationReport: {
              stageId: stageFixture.id,
              changeSetId: "cs-1",
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
                      title: "parse",
                      outcome: "passed",
                    },
                  ],
                },
              ],
            },
          },
        }),
      );
    });

    expect(container.querySelector('[data-testid="change-set-review"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="review-totals-terminal"]')).not.toBeNull();
    expect(container.textContent).toContain("validation: passed");
    expect(container.querySelector('[data-testid="accept-change-set-button"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="validation-ledger"]')).not.toBeNull();
    expect(container.textContent).toMatch(/promotes the validated candidate snapshot/i);
  });

  it("keeps Accept unavailable when review payload is incomplete", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse(200, {
        ok: true,
        run: {
          runId: "incomplete-review-run",
          phase: "awaiting_acceptance",
          sourceLabel: "fixture:controlled-example",
          selectedCandidate: { id: "orders", name: "Orders" },
          sequence: sequenceFixture,
          stageIndex: 0,
          currentStage: stageFixture,
          acceptedChangeSetCount: 0,
          changeSet: {
            id: "cs-missing",
            stageId: stageFixture.id,
            stageKind: stageFixture.kind,
            status: "validated",
            attempt: 1,
            operations: [],
          },
          candidateFileCount: 10,
          reviewPayload: null,
          validationReport: undefined,
        },
      }),
    );

    await act(async () => root.render(<AssessmentApp />));
    await act(async () => buttonByText(container, "Try controlled example")!.click());

    expect(container.querySelector('[data-testid="change-set-review"]')).not.toBeNull();
    expect(
      container
        .querySelector('[data-testid="change-set-review"]')
        ?.getAttribute("data-review-readiness"),
    ).toBe("incomplete");
    expect(container.querySelector('[data-testid="accept-unavailable"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="accept-change-set-button"]')).toBeNull();
    expect(container.querySelector('[data-testid="review-recovery"]')).not.toBeNull();
    expect(container.textContent).toMatch(/Acceptance stays unavailable/i);
  });

  it("refreshes incomplete review payload from the same-origin run GET", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(200, {
          ok: true,
          run: {
            runId: "recover-review-run",
            phase: "awaiting_acceptance",
            sourceLabel: "fixture:controlled-example",
            selectedCandidate: { id: "orders", name: "Orders" },
            sequence: sequenceFixture,
            stageIndex: 0,
            currentStage: stageFixture,
            acceptedChangeSetCount: 0,
            changeSet: {
              id: "cs-recover",
              stageId: stageFixture.id,
              stageKind: stageFixture.kind,
              status: "validated",
              attempt: 1,
              operations: [{ type: "create", path: "tests/behavior/orders.test.js", bytes: 80 }],
            },
            candidateFileCount: 10,
            reviewPayload: null,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          ok: true,
          run: {
            runId: "recover-review-run",
            phase: "awaiting_acceptance",
            sourceLabel: "fixture:controlled-example",
            selectedCandidate: { id: "orders", name: "Orders" },
            sequence: sequenceFixture,
            stageIndex: 0,
            currentStage: stageFixture,
            acceptedChangeSetCount: 0,
            changeSet: {
              id: "cs-recover",
              stageId: stageFixture.id,
              stageKind: stageFixture.kind,
              status: "validated",
              attempt: 1,
              operations: [{ type: "create", path: "tests/behavior/orders.test.js", bytes: 80 }],
            },
            candidateFileCount: 10,
            reviewPayload: {
              changeSetId: "cs-recover",
              attempt: 1,
              totals: { created: 1, updated: 0, deleted: 0 },
              files: [
                {
                  path: "tests/behavior/orders.test.js",
                  kind: "create",
                  bytes: 80,
                  afterPreview: "describe('orders')",
                },
              ],
              validationReport: {
                stageId: stageFixture.id,
                changeSetId: "cs-recover",
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
                        title: "parse",
                        outcome: "passed",
                      },
                    ],
                  },
                ],
              },
              truncationLabels: [],
            },
            validationReport: {
              stageId: stageFixture.id,
              changeSetId: "cs-recover",
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
                      title: "parse",
                      outcome: "passed",
                    },
                  ],
                },
              ],
            },
          },
        }),
      );

    await act(async () => root.render(<AssessmentApp />));
    await act(async () => buttonByText(container, "Try controlled example")!.click());

    expect(
      container
        .querySelector('[data-testid="change-set-review"]')
        ?.getAttribute("data-review-readiness"),
    ).toBe("incomplete");
    expect(container.querySelector('[data-testid="accept-change-set-button"]')).toBeNull();

    await act(async () => buttonByText(container, "Refresh current review")!.click());

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/runs/recover-review-run",
      expect.objectContaining({ method: "GET" }),
    );
    expect(
      container
        .querySelector('[data-testid="change-set-review"]')
        ?.getAttribute("data-review-readiness"),
    ).toBe("complete-current");
    expect(container.querySelector('[data-testid="accept-change-set-button"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="changed-file-navigator"]')).not.toBeNull();
  });

  it("distinguishes durable rollback status without acceptance", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse(200, {
        ok: true,
        run: {
          runId: "rollback-run",
          phase: "stage_failed_rolled_back",
          sourceLabel: "fixture:controlled-example",
          selectedCandidate: { id: "orders", name: "Orders" },
          sequence: sequenceFixture,
          stageIndex: 0,
          currentStage: stageFixture,
          acceptedChangeSetCount: 0,
          validationReport: {
            stageId: stageFixture.id,
            changeSetId: "cs-fail",
            finalOutcome: "failed_rolled_back",
            attempts: [{ attempt: 2, passed: false, checks: [] }],
          },
        },
      }),
    );

    await act(async () => root.render(<AssessmentApp />));
    await act(async () => buttonByText(container, "Try controlled example")!.click());

    expect(
      container
        .querySelector('[data-testid="sequence-outcome"]')
        ?.getAttribute("data-outcome-kind"),
    ).toBe("stage_failed_rolled_back");
    expect(container.querySelector('[data-testid="rollback-status"]')?.textContent).toMatch(
      /stage_failed_rolled_back/,
    );
    expect(container.querySelector('[data-testid="outcome-not-promoted"]')?.textContent).toMatch(
      /not promoted|Failed candidate/i,
    );
    expect(container.querySelector('[data-testid="accept-change-set-button"]')).toBeNull();
    expect(container.querySelector('[data-testid="download-result-zip"]')).toBeNull();
    expect(
      container
        .querySelector('[data-testid="stage-rail-stage-behavior"]')
        ?.getAttribute("data-stage-label"),
    ).toBe("failed");
  });

  it("renders developer-rejected stop with retained accepted state and no download", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse(200, {
        ok: true,
        run: {
          runId: "stopped-run",
          phase: "sequence_stopped",
          sourceLabel: "fixture:controlled-example",
          selectedCandidate: { id: "orders", name: "Orders" },
          reason: "developer_rejected",
          acceptedChangeSetCount: 1,
          validationReport: {
            stageId: stageFixture.id,
            changeSetId: "cs-reject",
            finalOutcome: "passed",
            attempts: [{ attempt: 1, passed: true, checks: [] }],
          },
        },
      }),
    );

    await act(async () => root.render(<AssessmentApp />));
    await act(async () => buttonByText(container, "Try controlled example")!.click());

    expect(
      container
        .querySelector('[data-testid="sequence-outcome"]')
        ?.getAttribute("data-outcome-kind"),
    ).toBe("sequence_stopped");
    expect(container.querySelector('[data-testid="outcome-stop-reason"]')?.textContent).toBe(
      "developer_rejected",
    );
    expect(container.querySelector('[data-testid="outcome-accepted-count"]')?.textContent).toBe(
      "1",
    );
    expect(container.querySelector('[data-testid="download-result-zip"]')).toBeNull();
    expect(container.querySelector('[data-testid="accept-change-set-button"]')).toBeNull();
    expect(container.textContent).toMatch(/not a completed Modernization Sequence/i);
  });

  it("renders completion with accepted summary and download only when provided", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse(200, {
        ok: true,
        run: {
          runId: "done-run",
          phase: "completed",
          sourceLabel: "fixture:controlled-example",
          selectedCandidate: { id: "orders", name: "Orders" },
          sequence: sequenceFixture,
          acceptedChangeSetCount: 2,
          downloadAvailable: true,
          downloadPath: "/api/runs/done-run/download",
          validationReports: [
            {
              stageId: "stage-behavior",
              changeSetId: "cs-1",
              finalOutcome: "passed",
              externalTestsLabel: "not_executed",
              attempts: [{ attempt: 1, passed: true, checkCount: 3, failedCheckIds: [] }],
            },
          ],
        },
      }),
    );

    await act(async () => root.render(<AssessmentApp />));
    await act(async () => buttonByText(container, "Try controlled example")!.click());

    expect(container.querySelector('[data-testid="completion-artifact"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="completion-accepted-count"]')?.textContent).toBe(
      "2",
    );
    expect(
      container.querySelector('[data-testid="completion-external-tests"]')?.textContent,
    ).toMatch(/not executed/i);
    expect(
      container.querySelector('[data-testid="download-result-zip"]')?.getAttribute("href"),
    ).toBe("/api/runs/done-run/download");
    expect(container.querySelector('[data-testid="accept-change-set-button"]')).toBeNull();
    expect(container.textContent).toMatch(/does not mean Runtime Validation/i);
  });

  it("preserves completed run when end-run deletion fails and allows retry", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(200, {
          ok: true,
          run: {
            runId: "done-run",
            phase: "completed",
            sourceLabel: "fixture:controlled-example",
            selectedCandidate: { id: "orders", name: "Orders" },
            acceptedChangeSetCount: 1,
            downloadAvailable: true,
            downloadPath: "/api/runs/done-run/download",
            validationReports: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(500, {
          ok: false,
          code: "DELETE_FAILED",
          message: "Could not delete run",
        }),
      );

    await act(async () => root.render(<AssessmentApp />));
    await act(async () => buttonByText(container, "Try controlled example")!.click());

    await act(async () => buttonByText(container, "End run / Start over")!.click());
    await act(async () => buttonByText(container, "Confirm end run")!.click());

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["/api/runs", "POST"],
      ["/api/runs/done-run", "DELETE"],
    ]);
    expect(container.querySelector('[data-testid="completion-artifact"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="download-result-zip"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="completion-end-error"]')?.textContent).toMatch(
      /Could not delete run|did not complete/i,
    );
    expect(buttonByText(container, "Retry end run / Start over")).toBeDefined();
  });
});
