import { describe, expect, it } from "vitest";
import { assertNormalizedPath } from "@/core/paths";
import { createExpressAnalyzer } from "@/server/analysis/express-analyzer";
import { loadFixtureSnapshot } from "@/fixtures/load-fixture";
import { rankDomainCandidates } from "@/server/ranking/candidates";
import { planModernizationSequence, resolveConditionalStage } from "@/server/sequence/plan";
import { applyOperationsToSnapshot } from "@/server/snapshot/apply";
import { validateChangeSetStatic } from "./static";
import { generateDeterministicOperations } from "@/server/generation/deterministic";
import { loadDoubleFailureAiFixture } from "@/fixtures/load-fixture";

async function controlledCycleRepair() {
  const snapshot = loadFixtureSnapshot("controlled-example");
  const files = [...snapshot.files.values()];
  const analysis = await createExpressAnalyzer().analyze(files);
  const candidate = rankDomainCandidates(analysis).candidates.find((item) => item.id === "orders");
  if (!candidate) throw new Error("Orders candidate missing from controlled example");
  const controlledCandidate = candidate;
  const sequence = planModernizationSequence({ candidate: controlledCandidate, analysis, files });
  const moduleStage = sequence.requiredStages.find((stage) => stage.kind === "domain_module");
  if (!moduleStage) throw new Error("Domain Module stage missing");
  const moduleOperations = generateDeterministicOperations({
    stage: moduleStage,
    candidate: controlledCandidate,
    analysis,
    files,
  });
  const moduleApplied = applyOperationsToSnapshot(snapshot, moduleOperations);
  if (!moduleApplied.ok) throw new Error("Could not prepare controlled module snapshot");
  const moduleSnapshot = moduleApplied.snapshot;
  const resolved = resolveConditionalStage({
    candidate: controlledCandidate,
    analysis,
    files: [...moduleSnapshot.files.values()],
    sequence,
    entryPath: analysis.entryPath,
  });
  const stage = resolved.conditionalStage;
  if (!stage) throw new Error("Controlled example must retain its cycle repair stage");
  const cycleStage = stage;
  const operations = generateDeterministicOperations({
    stage: cycleStage,
    candidate: controlledCandidate,
    analysis,
    files: [...moduleSnapshot.files.values()],
  });

  function validate(operationsToValidate = operations) {
    const applied = applyOperationsToSnapshot(moduleSnapshot, operationsToValidate);
    if (!applied.ok) throw new Error("Could not apply controlled cycle repair operations");
    const candidateSnapshot = applied.snapshot;
    return validateChangeSetStatic({
      stage: cycleStage,
      operations: operationsToValidate,
      baseSnapshot: moduleSnapshot,
      candidateSnapshot,
      analysis,
      candidate: controlledCandidate,
    });
  }

  return { operations, validate };
}

describe("static validation", () => {
  it("accepts deterministic behaviour capture operations", async () => {
    const snapshot = loadFixtureSnapshot("controlled-example");
    const files = [...snapshot.files.values()];
    const analysis = await createExpressAnalyzer().analyze(files);
    const ranking = rankDomainCandidates(analysis);
    const candidate = ranking.candidates.find((c) => c.id === "orders") ?? ranking.candidates[0]!;
    const sequence = planModernizationSequence({ candidate, analysis, files });
    const stage = sequence.requiredStages[0];
    const operations = generateDeterministicOperations({
      stage,
      candidate,
      analysis,
      files,
    });
    const applied = applyOperationsToSnapshot(snapshot, operations);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    const result = validateChangeSetStatic({
      stage,
      operations,
      baseSnapshot: snapshot,
      candidateSnapshot: applied.snapshot,
      analysis,
      candidate,
    });
    expect(result.passed).toBe(true);
    expect(result.checks.some((c) => c.outcome === "not_executed")).toBe(true);
  });

  it("accepts the controlled composition-root factory repair", async () => {
    const { validate } = await controlledCycleRepair();
    const result = validate();

    expect(result.passed).toBe(true);
    expect(result.checks).toContainEqual({
      id: "factory-injection",
      kind: "static",
      title: "Public module factory has the supported injection shape",
      outcome: "passed",
      detail: "factory:createOrdersModule; dependency:paymentsApi",
    });
    expect(result.checks).toContainEqual({
      id: "composition-root-injection",
      kind: "static",
      title: "Recognized composition root supplies the factory dependency",
      outcome: "passed",
      detail: "root:app.js; paymentsApi:routes/payments.js",
    });
    expect(result.checks).toContainEqual({
      id: "cycle-absent",
      kind: "static",
      title: "Original entry-reachable circular dependency must be removed",
      outcome: "passed",
      detail: "entry_reachable_cycle_absent",
    });
  });

  it.each([
    {
      name: "lookalike public factory export",
      path: "src/modules/orders/index.js",
      replace: (content: string) =>
        content.replace(
          "  createOrdersModule,\n  // read-only facade",
          "  createOrdersModule: function lookalikeFactory() { return {}; },\n  // read-only facade",
        ),
      error: "factory_not_public_export",
    },
    {
      name: "factory property export overwritten by later module exports",
      path: "src/modules/orders/index.js",
      replace: (content: string) =>
        content
          .replace(
            "module.exports = {",
            "module.exports.createOrdersModule = createOrdersModule;\nmodule.exports = {",
          )
          .replace("  createOrdersModule,\n", ""),
      error: "factory_not_public_export",
    },
    {
      name: "factory property reassigned after valid public export",
      path: "src/modules/orders/index.js",
      replace: (content: string) => `${content}\nmodule.exports.createOrdersModule = null;\n`,
      error: "factory_not_public_export",
    },
    {
      name: "wrong composition-root factory argument",
      path: "app.js",
      replace: (content: string) =>
        content.replace("{ paymentsApi: paymentsRouter }", "{ paymentsApi: ordersModule }"),
      error: "wrong_composition_root_factory_argument",
    },
    {
      name: "omitted composition-root factory injection",
      path: "app.js",
      replace: (content: string) =>
        content.replace("\nordersModule.createOrdersModule({ paymentsApi: paymentsRouter });", ""),
      error: "missing_composition_root_factory_call",
    },
    {
      name: "unused injected dependency",
      path: "src/modules/orders/index.js",
      replace: (content: string) =>
        content
          .replace(
            '  if (!paymentsApi || typeof paymentsApi.summarizeForOrder !== "function") {\n    throw new Error("paymentsApi is required by the Orders module");\n  }\n',
            "",
          )
          .replace("paymentsApi: paymentsApi,", "paymentsApi: null,"),
      error: "unused_injected_dependency",
    },
    {
      name: "no-op injected dependency reference",
      path: "src/modules/orders/index.js",
      replace: (content: string) =>
        content
          .replace(
            '  if (!paymentsApi || typeof paymentsApi.summarizeForOrder !== "function") {\n    throw new Error("paymentsApi is required by the Orders module");\n  }\n',
            "  void paymentsApi;\n",
          )
          .replace("paymentsApi: paymentsApi,", "paymentsApi: null,"),
      error: "unused_injected_dependency",
    },
    {
      name: "standalone injected dependency expression",
      path: "src/modules/orders/index.js",
      replace: (content: string) =>
        content
          .replace(
            '  if (!paymentsApi || typeof paymentsApi.summarizeForOrder !== "function") {\n    throw new Error("paymentsApi is required by the Orders module");\n  }\n',
            "  paymentsApi;\n",
          )
          .replace("paymentsApi: paymentsApi,", "paymentsApi: null,"),
      error: "unused_injected_dependency",
    },
    {
      name: "guard-only injected dependency reference",
      path: "src/modules/orders/index.js",
      replace: (content: string) =>
        content.replace("paymentsApi: paymentsApi,", "paymentsApi: null,"),
      error: "unused_injected_dependency",
    },
    {
      name: "standalone dependency invocation without result wiring",
      path: "src/modules/orders/index.js",
      replace: (content: string) =>
        content
          .replace(
            '  if (!paymentsApi || typeof paymentsApi.summarizeForOrder !== "function") {\n    throw new Error("paymentsApi is required by the Orders module");\n  }\n',
            "  paymentsApi.summarizeForOrder();\n",
          )
          .replace("paymentsApi: paymentsApi,", "paymentsApi: null,"),
      error: "unused_injected_dependency",
    },
  ])("rejects $name with an exact static error", async ({ path, replace, error }) => {
    const { operations, validate } = await controlledCycleRepair();
    const altered = operations.map((operation) =>
      operation.type === "update" && operation.path === path
        ? { ...operation, content: replace(operation.content) }
        : operation,
    );
    const result = validate(altered);

    expect(result.passed).toBe(false);
    expect(result.structuredErrors).toContain(error);
    expect(result.checks.find((check) => check.outcome === "failed")?.detail).toContain(error);
  });

  it("accepts a dependency invocation whose result is wired into the returned facade", async () => {
    const { operations, validate } = await controlledCycleRepair();
    const altered = operations.map((operation) =>
      operation.type === "update" && operation.path === "src/modules/orders/index.js"
        ? {
            ...operation,
            content: operation.content.replace(
              "paymentsApi: paymentsApi,",
              "paymentSummary: paymentsApi.summarizeForOrder(),",
            ),
          }
        : operation,
    );

    const result = validate(altered);

    expect(result.passed).toBe(true);
    expect(result.structuredErrors).not.toContain("unused_injected_dependency");
  });

  it("rejects a repair when the original cycle remains entry-reachable", async () => {
    const { operations, validate } = await controlledCycleRepair();
    const result = validate(
      operations.filter((operation) => operation.path !== "routes/payments.js"),
    );

    expect(result.passed).toBe(false);
    expect(result.structuredErrors).toContain("cycle_still_present");
    expect(result.checks).toContainEqual({
      id: "cycle-absent",
      kind: "static",
      title: "Original entry-reachable circular dependency must be removed",
      outcome: "failed",
      detail: "entry_reachable_cycle:routes/orders.js→routes/payments.js",
    });
  });

  it("rejects double-failure fixture attempt 1 operations", async () => {
    const snapshot = loadFixtureSnapshot("controlled-example");
    const files = [...snapshot.files.values()];
    const analysis = await createExpressAnalyzer().analyze(files);
    const ranking = rankDomainCandidates(analysis);
    const candidate = ranking.candidates.find((c) => c.id === "orders") ?? ranking.candidates[0]!;
    const sequence = planModernizationSequence({ candidate, analysis, files });
    const stage = sequence.requiredStages[0];
    const fixture = loadDoubleFailureAiFixture();
    const ops = fixture.attempts[0]!.operations.map((op) => {
      if (op.type === "delete") {
        return { type: "delete" as const, path: assertNormalizedPath(op.path) };
      }
      // paths like ../outside-repo.js fail normalize — keep raw for apply failure path
      try {
        return {
          type: op.type as "create" | "update",
          path: assertNormalizedPath(op.path),
          content: (op as { content: string }).content,
        };
      } catch {
        return op as typeof op & { content?: string };
      }
    });

    // Validate using operations as-is through envelope (path normalize inside)
    const applied = applyOperationsToSnapshot(
      snapshot,
      // only ops with valid paths for apply
      ops.filter((o) => {
        try {
          assertNormalizedPath(o.path);
          return true;
        } catch {
          return false;
        }
      }) as never,
    );

    const result = validateChangeSetStatic({
      stage,
      operations: fixture.attempts[0]!.operations as never,
      baseSnapshot: snapshot,
      candidateSnapshot: applied.ok ? applied.snapshot : snapshot,
      analysis,
      candidate,
    });
    expect(result.passed).toBe(false);
    expect(
      result.structuredErrors.some(
        (e) =>
          e.includes("disallowed_manifest") ||
          e.includes("javascript_parse") ||
          e.includes("outside") ||
          e.includes("behavior"),
      ),
    ).toBe(true);
  });
});
