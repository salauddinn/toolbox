// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssessmentApp } from "./components/assessment-app";
import { MarketingLanding } from "./components/marketing-landing";

vi.mock("./components/dependency-graph", () => ({
  DependencyGraph: () => null,
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("product landing", () => {
  it("offers the work console and explains the product boundary", () => {
    render(<MarketingLanding />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Turn one tangled Express domain into an accepted module.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open work console" })).toHaveAttribute("href", "/app");
    expect(screen.getByText("no microservices required")).toBeInTheDocument();
    expect(screen.getByText("Bounded")).toBeInTheDocument();
  });

  it("makes the bounded workflow and supported contract discoverable", () => {
    render(<MarketingLanding />);

    expect(screen.getByText("Safety before AI")).toBeInTheDocument();
    expect(screen.getByText("Human authorization")).toBeInTheDocument();
    expect(screen.getByText("supported contract")).toBeInTheDocument();
    expect(screen.getByText("Jest/Supertest available via npm test")).toBeInTheDocument();
  });
});

describe("assessment no-run screen", () => {
  it("renders both supported assessment entry points", () => {
    render(<AssessmentApp />);

    expect(screen.getByRole("button", { name: "Try controlled example" })).toBeEnabled();
    expect(screen.getByLabelText("Public GitHub repository URL")).toHaveAttribute(
      "placeholder",
      "https://github.com/owner/repo",
    );
    expect(screen.getByRole("button", { name: "Assess" })).toBeDisabled();
    expect(screen.getByText("supported contract")).toBeInTheDocument();
  });

  it("enables URL assessment and posts the entered public repository", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse(400, { ok: false, code: "INVALID_GITHUB_URL", message: "Invalid URL" }),
      );
    render(<AssessmentApp />);

    const input = screen.getByLabelText("Public GitHub repository URL");
    await user.type(input, "https://github.com/example/repository");
    await user.click(screen.getByRole("button", { name: "Assess" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/runs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          source: "github",
          url: "https://github.com/example/repository",
        }),
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid URL");
  });

  it("offers active-run recovery and preserves it when replacement deletion fails", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(409, {
          ok: false,
          code: "RATE_LIMIT_ACTIVE_CLIENT",
          message: "An active run already exists",
          activeRunId: "active-run-123",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(500, {
          ok: false,
          code: "RUN_DELETE_FAILED",
          message: "Previous run could not be ended",
        }),
      );
    render(<AssessmentApp />);

    await user.click(screen.getByRole("button", { name: "Try controlled example" }));

    const recovery = await screen.findByRole("button", {
      name: "End previous run and start new",
    });
    expect(screen.getByRole("alert")).toHaveTextContent("An active run already exists");

    await user.click(recovery);

    expect(await screen.findByRole("alert")).toHaveTextContent("Previous run could not be ended");
    expect(screen.getByRole("button", { name: "End previous run and start new" })).toBeEnabled();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/runs/active-run-123",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
