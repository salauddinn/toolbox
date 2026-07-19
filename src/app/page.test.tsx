// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
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
  it("offers the work console and explains input, outcome, and human controls", () => {
    render(<MarketingLanding />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "From a Supported Repository to one accepted Domain Module.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open work console" })).toHaveAttribute("href", "/app");
    expect(screen.getByRole("link", { name: "Go to work console" })).toHaveAttribute(
      "href",
      "/app",
    );

    const hero = screen.getByRole("region", {
      name: "From a Supported Repository to one accepted Domain Module.",
    });
    expect(hero).toHaveTextContent(/Input:/i);
    expect(hero).toHaveTextContent(/public GitHub root repository/i);
    expect(hero).toHaveTextContent(/Outcome:/i);
    expect(hero).toHaveTextContent(/Domain Module/i);
    expect(hero).toHaveTextContent(/authorize a Stage Plan/i);
    expect(hero).toHaveTextContent(/Change Acceptance/i);
    expect(hero).toHaveTextContent(/Static Validation is not Runtime Validation/i);
    expect(screen.getByText("Bounded generation")).toBeInTheDocument();
    expect(screen.getByText("Per Stage Plan")).toBeInTheDocument();
    expect(screen.getByText("Developer only")).toBeInTheDocument();
  });

  it("shows a selectable terminal assessment specimen with meaningful evidence text", () => {
    render(<MarketingLanding />);

    const specimen = screen.getByRole("complementary", {
      name: "Illustrative Modernization Assessment specimen",
    });
    expect(specimen).toHaveTextContent("Orders");
    expect(specimen).toHaveTextContent("exclusive write");
    expect(specimen).toHaveTextContent("Static Validation only");
    expect(specimen).toHaveTextContent("Change Acceptance required");
    expect(specimen.querySelector("pre")).not.toBeNull();
  });

  it("presents the five-step workflow separating selection, authorization, validation, and acceptance", () => {
    render(<MarketingLanding />);

    const workflow = screen.getByRole("region", { name: "Modernization workflow" });
    expect(within(workflow).getByRole("heading", { name: "Assess" })).toBeInTheDocument();
    expect(within(workflow).getByRole("heading", { name: "Select candidate" })).toBeInTheDocument();
    expect(
      within(workflow).getByRole("heading", { name: "Authorize Stage Plan" }),
    ).toBeInTheDocument();
    expect(
      within(workflow).getByRole("heading", { name: "Validate Change Set" }),
    ).toBeInTheDocument();
    expect(within(workflow).getByRole("heading", { name: "Accept changes" })).toBeInTheDocument();
    expect(workflow).toHaveTextContent(/AI does not run until you authorize/i);
    expect(workflow).toHaveTextContent(/not Runtime Validation/i);
    expect(workflow).toHaveTextContent(/Change Acceptance/i);
  });

  it("exposes the deterministic-versus-AI responsibility ledger", () => {
    render(<MarketingLanding />);

    const ledger = screen.getByRole("region", { name: "Responsibility ledger" });
    expect(ledger).toHaveTextContent("Eligibility and Safety Screening");
    expect(ledger).toHaveTextContent("Domain Candidate ranking and readiness");
    expect(ledger).toHaveTextContent("Proposed source edits and one repair attempt");
    expect(ledger).toHaveTextContent("Promotion into the accepted snapshot");
    expect(within(ledger).getAllByText("Deterministic").length).toBeGreaterThanOrEqual(4);
    expect(within(ledger).getByText("AI")).toBeInTheDocument();
    expect(within(ledger).getByText("Developer")).toBeInTheDocument();
  });

  it("separates assessment requirements from transformation requirements", () => {
    render(<MarketingLanding />);

    expect(
      screen.getByRole("heading", { name: "Requirements for assessment" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Additional requirements for transformation" }),
    ).toBeInTheDocument();
    expect(screen.getByText("JavaScript CommonJS module system")).toBeInTheDocument();
    expect(
      screen.getByText("At least one Domain Candidate marked ready for transformation"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("CommonJS Jest/Supertest harness available via npm test"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Transformation Readiness is separate from repository eligibility/i),
    ).toBeInTheDocument();
  });

  it("states safety and non-goal boundaries without overclaiming", () => {
    render(<MarketingLanding />);

    const boundaries = screen.getByRole("region", { name: "Safety and non-goals" });
    expect(
      within(boundaries).getByRole("heading", {
        name: "Static Validation is not Runtime Validation",
      }),
    ).toBeInTheDocument();
    expect(
      within(boundaries).getByRole("heading", { name: "Safety Screening is not certification" }),
    ).toBeInTheDocument();
    expect(
      within(boundaries).getByRole("heading", { name: "No microservices or deploy splits" }),
    ).toBeInTheDocument();
    expect(
      within(boundaries).getByRole("heading", { name: "Developer authorizes and accepts" }),
    ).toBeInTheDocument();
    expect(boundaries).not.toHaveTextContent(/malware scan/i);
    expect(boundaries).not.toHaveTextContent(/microservice extraction/i);
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
