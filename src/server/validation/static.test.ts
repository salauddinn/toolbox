import { describe, expect, it } from "vitest";
import { assertNormalizedPath } from "@/core/paths";
import { createExpressAnalyzer } from "@/server/analysis/express-analyzer";
import { loadFixtureSnapshot } from "@/fixtures/load-fixture";
import { rankDomainCandidates } from "@/server/ranking/candidates";
import { planModernizationSequence } from "@/server/sequence/plan";
import { applyOperationsToSnapshot } from "@/server/snapshot/apply";
import { validateChangeSetStatic } from "./static";
import { generateDeterministicOperations } from "@/server/generation/deterministic";
import { loadDoubleFailureAiFixture } from "@/fixtures/load-fixture";

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
