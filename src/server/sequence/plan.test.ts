import { describe, expect, it } from "vitest";
import { createExpressAnalyzer } from "@/server/analysis/express-analyzer";
import { loadFixtureSnapshot } from "@/fixtures/load-fixture";
import { rankDomainCandidates } from "@/server/ranking/candidates";
import { listSequenceStages, planModernizationSequence, resolveConditionalStage } from "./plan";

describe("modernization sequence planner", () => {
  it("always plans three required stages and marks pending cycle when present", async () => {
    const snapshot = loadFixtureSnapshot("controlled-example");
    const files = [...snapshot.files.values()];
    const analysis = await createExpressAnalyzer().analyze(files);
    const ranking = rankDomainCandidates(analysis);
    const orders = ranking.candidates.find((c) => c.id === "orders") ?? ranking.candidates[0]!;

    const sequence = planModernizationSequence({
      candidate: orders,
      analysis,
      files,
    });

    expect(sequence.requiredStages).toHaveLength(3);
    expect(sequence.requiredStages[0].kind).toBe("behavior_capture");
    expect(sequence.requiredStages[1].kind).toBe("domain_module");
    expect(sequence.requiredStages[2].kind).toBe("integration_cleanup");
    expect(sequence.conditionalStage).toBeUndefined();

    // Controlled example has Orders↔Payments cycle
    expect(sequence.pendingConditional?.kind).toBe("cycle_repair");
    expect(sequence.pendingConditional?.status).toBe("pending_post_module_recalc");

    const listed = listSequenceStages(sequence);
    expect(listed).toHaveLength(3);
  });

  it("inserts conditional cycle stage only when post-module graph still has the cycle", async () => {
    const snapshot = loadFixtureSnapshot("controlled-example");
    const files = [...snapshot.files.values()];
    const analysis = await createExpressAnalyzer().analyze(files);
    const ranking = rankDomainCandidates(analysis);
    const orders = ranking.candidates.find((c) => c.id === "orders") ?? ranking.candidates[0]!;

    const sequence = planModernizationSequence({ candidate: orders, analysis, files });
    expect(sequence.pendingConditional).toBeDefined();

    const stillCyclic = resolveConditionalStage({
      candidate: orders,
      analysis,
      files,
      sequence,
      entryPath: analysis.entryPath,
    });
    expect(stillCyclic.conditionalStage?.kind).toBe("cycle_repair");
    expect(listSequenceStages(stillCyclic)).toHaveLength(4);

    // Simulate cycle gone: empty files graph
    const emptyFiles = files.filter((f) => f.path === "package.json");
    const cleared = resolveConditionalStage({
      candidate: { ...orders, files: [] },
      analysis: {
        ...analysis,
        graph: {
          nodes: [],
          edges: [],
          entryReachable: new Set(),
          cycles: [],
        },
      },
      files: emptyFiles,
      sequence,
      entryPath: analysis.entryPath,
    });
    // With candidate files empty, remaining cycles filter is empty
    expect(cleared.conditionalStage).toBeUndefined();
    expect(listSequenceStages(cleared)).toHaveLength(3);
  });

  it("does not let stage purposes be empty or AI-mutable fields", async () => {
    const snapshot = loadFixtureSnapshot("controlled-example");
    const files = [...snapshot.files.values()];
    const analysis = await createExpressAnalyzer().analyze(files);
    const ranking = rankDomainCandidates(analysis);
    const candidate = ranking.candidates[0]!;
    const sequence = planModernizationSequence({ candidate, analysis, files });
    for (const stage of sequence.requiredStages) {
      expect(stage.purpose.length).toBeGreaterThan(20);
      expect(stage.validationCriteria.length).toBeGreaterThan(0);
      expect(stage.budgets.maxOperations).toBe(20);
    }
  });
});
