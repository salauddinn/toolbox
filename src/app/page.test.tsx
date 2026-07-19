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
  it("renders distinct controlled-example and GitHub entry paths", () => {
    render(<AssessmentApp />);

    expect(screen.getByRole("heading", { name: "Controlled example" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Public GitHub repository" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try controlled example" })).toBeEnabled();
    expect(screen.getByLabelText("Public GitHub repository URL")).toHaveAttribute(
      "placeholder",
      "https://github.com/owner/repo",
    );
    expect(screen.getByRole("button", { name: "Assess" })).toBeDisabled();
    expect(screen.getByText("supported contract")).toBeInTheDocument();
    expect(screen.getByText(/expire after 30 minutes/i)).toBeInTheDocument();
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
    expect(screen.getByRole("alert")).toHaveTextContent(/Start did not create a run/i);
  });

  it("submits the GitHub URL form with Enter", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse(400, { ok: false, code: "INVALID_GITHUB_URL", message: "Invalid URL" }),
      );
    render(<AssessmentApp />);

    const input = screen.getByLabelText("Public GitHub repository URL");
    await user.type(input, "https://github.com/example/from-enter{Enter}");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/runs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          source: "github",
          url: "https://github.com/example/from-enter",
        }),
      }),
    );
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
    expect(
      screen.getByRole("heading", { name: "An active run must be ended first" }),
    ).toBeInTheDocument();

    await user.click(recovery);
    await user.click(
      screen.getByRole("button", { name: "Confirm end previous run and start new" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Previous run could not be ended");
    expect(screen.getByRole("button", { name: "End previous run and start new" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Keep previous run" })).toBeEnabled();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/runs/active-run-123",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("assessment gate failures", () => {
  it("renders eligibility failure as a stopped gate with evidence and no success framing", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        run: {
          runId: "elig-run",
          phase: "eligibility_failed",
          sourceLabel: "fixture:unsupported-esm",
          eligibility: {
            eligible: false,
            rejections: [
              {
                code: "ELIGIBILITY_ESM_MODULE",
                message: "type module is not supported",
                evidence: [
                  {
                    ruleId: "ELIGIBILITY_ESM_MODULE",
                    message: "package.json sets type module",
                    severity: "error",
                    file: "package.json",
                    line: 2,
                    snippet: '"type": "module"',
                  },
                ],
              },
            ],
          },
        },
      }),
    );
    render(<AssessmentApp />);

    await user.click(screen.getByRole("button", { name: "Try controlled example" }));

    expect(
      await screen.findByRole("heading", { name: "Repository is not eligible" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/AI was not called/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("ELIGIBILITY_ESM_MODULE").length).toBeGreaterThan(0);
    expect(screen.getByText(/package.json sets type module/i)).toBeInTheDocument();
    expect(screen.queryByText("Assessment detail")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End run / Start over" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Confirm Domain Candidate" }),
    ).not.toBeInTheDocument();
  });

  it("renders safety failure with disclaimer and terminal evidence", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        run: {
          runId: "safe-run",
          phase: "safety_failed",
          sourceLabel: "github:owner/risk",
          safety: {
            passed: false,
            rejections: [
              {
                code: "SAFETY_DYNAMIC_CODE_EXECUTION",
                message: "eval usage detected",
                evidence: [
                  {
                    ruleId: "SAFETY_DYNAMIC_CODE_EXECUTION",
                    message: 'eval("...")',
                    severity: "error",
                    file: "src/boot.js",
                    line: 12,
                    snippet: "eval(payload)",
                  },
                ],
              },
            ],
          },
        },
      }),
    );
    render(<AssessmentApp />);

    await user.click(screen.getByRole("button", { name: "Try controlled example" }));

    expect(
      await screen.findByRole("heading", { name: "Safety Screening rejected the repository" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/not malware certification/i)).toBeInTheDocument();
    expect(screen.getAllByText("SAFETY_DYNAMIC_CODE_EXECUTION").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/AI not called/i).length).toBeGreaterThan(0);
    expect(screen.queryByText("Assessment detail")).not.toBeInTheDocument();
  });

  it("renders not-ready as assessment-only stop without candidate confirmation", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        run: {
          runId: "not-ready-run",
          phase: "not_ready",
          sourceLabel: "fixture:unsupported-syntax",
          assessmentOnly: true,
          analysis: {
            entryPath: "app.js",
            runtime: "node",
            routeCount: 1,
            modelCount: 1,
            findings: [],
            graph: { nodes: [], edges: [], cycles: [], entryPath: "app.js" },
          },
          ranking: {
            candidates: [
              {
                id: "c1",
                name: "Orders",
                technicalScore: 0.4,
                confidence: 0.5,
                routes: [],
                files: [],
                signals: [],
                conflictingEvidence: [],
              },
            ],
            safestTechnicalCandidateId: "c1",
          },
          readinessByCandidateId: {
            c1: {
              ready: false,
              candidateId: "c1",
              rules: [],
              failedRules: [
                {
                  ruleId: "READINESS_UNSUPPORTED_HANDLER_SHAPE",
                  passed: false,
                  summary: "Handler shape is outside the MVP profile",
                  evidence: [],
                },
              ],
            },
          },
        },
      }),
    );
    render(<AssessmentApp />);

    await user.click(screen.getByRole("button", { name: "Try controlled example" }));

    expect(
      await screen.findByRole("heading", {
        name: "Assessment complete — no candidate is ready",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/AI was not called/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("READINESS_UNSUPPORTED_HANDLER_SHAPE").length).toBeGreaterThan(0);
    expect(screen.getByText(/Assessment evidence \(read-only\)/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirm Domain Candidate" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select" })).not.toBeInTheDocument();
  });

  it("blocks unknown phases without mutation actions", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        run: {
          runId: "future-run",
          phase: "future_phase",
        },
      }),
    );
    render(<AssessmentApp />);

    await user.click(screen.getByRole("button", { name: "Try controlled example" }));

    expect(await screen.findByText(/No unsupported mutations/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "End run / Start over" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirm Domain Candidate" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry example" })).not.toBeInTheDocument();
  });
});
