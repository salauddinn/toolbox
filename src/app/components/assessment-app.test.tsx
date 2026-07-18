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

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["/api/runs", "POST"],
      ["/api/runs/current-run", "DELETE"],
    ]);
    expect(container.textContent).toContain("no active run");
  });
});
