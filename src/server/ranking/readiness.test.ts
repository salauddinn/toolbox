import { describe, expect, it } from "vitest";
import { loadFixtureSnapshot } from "@/fixtures/load-fixture";
import { ExpressAnalyzer } from "@/server/analysis/express-analyzer";
import { rankDomainCandidates } from "./candidates";
import {
  evaluateAllCandidateReadiness,
  evaluateCandidateReadiness,
  isAssessmentOnly,
} from "./readiness";

describe("ranking and readiness", () => {
  it("ranks Orders among candidates for the controlled example", async () => {
    const snapshot = loadFixtureSnapshot("controlled-example");
    const analysis = await new ExpressAnalyzer().analyze([...snapshot.files.values()]);
    const ranking = rankDomainCandidates(analysis);
    expect(ranking.candidates.length).toBeGreaterThan(0);
    expect(ranking.candidates.length).toBeLessThanOrEqual(3);
    expect(ranking.safestTechnicalCandidateId).toBeTruthy();
    const names = ranking.candidates.map((c) => c.name.toLowerCase());
    expect(names.some((n) => n.includes("order"))).toBe(true);
  });

  it("marks controlled-example Orders ready when harness and ownership hold", async () => {
    const snapshot = loadFixtureSnapshot("controlled-example");
    const files = [...snapshot.files.values()];
    const analysis = await new ExpressAnalyzer().analyze(files);
    const ranking = rankDomainCandidates(analysis);
    const readiness = evaluateAllCandidateReadiness(ranking.candidates, analysis, files);
    expect(isAssessmentOnly(readiness)).toBe(false);

    const orders = ranking.candidates.find((c) => c.id.includes("order") || c.name === "Orders");
    expect(orders).toBeTruthy();
    if (!orders) return;
    const result = evaluateCandidateReadiness(orders, analysis, files);
    expect(result.ready).toBe(true);
  });

  it("fails only the relevant candidate for unsupported conventional syntax with exact evidence", async () => {
    const snapshot = loadFixtureSnapshot("unsupported-syntax");
    const files = [...snapshot.files.values()];
    const analyzer = new ExpressAnalyzer();

    // Unsupported conventional shapes remain eligible for assessment; readiness blocks generation.
    expect(analyzer.supports(files).eligible).toBe(true);
    const analysis = await analyzer.analyze(files);
    const ranking = rankDomainCandidates(analysis);
    const orders = ranking.candidates.find((candidate) => candidate.id === "order");
    const users = ranking.candidates.find((candidate) => candidate.id === "user");
    expect(orders).toBeTruthy();
    expect(users).toBeTruthy();
    if (!orders || !users) return;

    const allReadiness = evaluateAllCandidateReadiness(ranking.candidates, analysis, files);
    const readiness = allReadiness.get(orders.id);
    const unrelatedReadiness = allReadiness.get(users.id);
    expect(readiness?.ready).toBe(false);
    expect(unrelatedReadiness?.ready).toBe(true);
    if (!readiness || readiness.ready) return;

    const syntaxRule = readiness.failedRules.find(
      (rule) => rule.ruleId === "READINESS_SUPPORTED_TRANSFORMATION_SYNTAX",
    );
    expect(syntaxRule).toMatchObject({
      passed: false,
      summary: "Candidate contains unsupported route, mount, handler, model, or CRUD syntax",
    });
    expect(syntaxRule?.evidence).toEqual([
      {
        ruleId: "READINESS_UNSUPPORTED_MOUNT_NON_LITERAL_PREFIX",
        message: "Unsupported mount syntax: computed_or_non_literal_mount_prefix",
        severity: "critical",
        file: "app.js",
        line: 6,
        snippet: "app.use(ordersPrefix, ordersRouter);",
      },
      {
        ruleId: "READINESS_UNSUPPORTED_MOUNT_DIRECT_REQUIRE_TARGET",
        message: "Unsupported mount syntax: direct_require_mount_target",
        severity: "critical",
        file: "app.js",
        line: 10,
        snippet: 'app.use("/orders-direct", require("./routes/orders"));',
      },
      {
        ruleId: "READINESS_UNSUPPORTED_MOUNT_MIDDLEWARE_BEFORE_ROUTER",
        message: "Unsupported mount syntax: middleware_before_router_mount",
        severity: "critical",
        file: "app.js",
        line: 11,
        snippet: 'app.use("/orders-secured", auth, ordersRouter);',
      },
      {
        ruleId: "READINESS_UNSUPPORTED_MODEL_NON_LITERAL_NAME",
        message: "Unsupported model syntax: non_literal_model_name",
        severity: "critical",
        file: "models/Order.js",
        line: 6,
        snippet: "const Order = mongoose.model(modelName, orderSchema);",
      },
      {
        ruleId: "READINESS_UNSUPPORTED_ROUTE_NON_LITERAL_PATH",
        message: "Unsupported route syntax: computed_or_non_literal_route_path",
        severity: "critical",
        file: "routes/orders.js",
        line: 12,
        snippet: "router.get(dynamicPath, function dynamic(_req, res) {",
      },
      {
        ruleId: "READINESS_UNSUPPORTED_HANDLER_SHAPE",
        message: "Unsupported handler syntax: unsupported_handler_shape",
        severity: "critical",
        file: "routes/orders.js",
        line: 15,
        snippet: 'router.get("/unsupported-handler", handlers[0]);',
      },
      {
        ruleId: "READINESS_UNSUPPORTED_CRUD_METHOD",
        message: "Unsupported crud syntax: unsupported_crud_method",
        severity: "critical",
        file: "routes/orders.js",
        line: 21,
        snippet: "  await Order.bulkWrite([]);",
      },
    ]);
  });

  it("assessment-only for no-ready-candidate fixture", async () => {
    const snapshot = loadFixtureSnapshot("no-ready-candidate");
    const files = [...snapshot.files.values()];
    const analysis = await new ExpressAnalyzer().analyze(files);
    const ranking = rankDomainCandidates(analysis);
    const readiness = evaluateAllCandidateReadiness(ranking.candidates, analysis, files);
    expect(isAssessmentOnly(readiness)).toBe(true);
    for (const value of readiness.values()) {
      expect(value.ready).toBe(false);
      if (!value.ready) {
        expect(value.failedRules.some((r) => r.ruleId === "READINESS_EXISTING_TEST_HARNESS")).toBe(
          true,
        );
      }
    }
  });

  it("is reproducible for the same snapshot", async () => {
    const snapshot = loadFixtureSnapshot("controlled-example");
    const files = [...snapshot.files.values()];
    const analyzer = new ExpressAnalyzer();
    const a = await analyzer.analyze(files);
    const b = await analyzer.analyze(files);
    const ra = rankDomainCandidates(a);
    const rb = rankDomainCandidates(b);
    expect(ra.candidates.map((c) => c.id)).toEqual(rb.candidates.map((c) => c.id));
    expect(ra.candidates.map((c) => c.technicalScore)).toEqual(
      rb.candidates.map((c) => c.technicalScore),
    );
  });
});
