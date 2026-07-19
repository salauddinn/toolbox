import { describe, expect, it, beforeEach } from "vitest";
import { beginLoading } from "@/core/run-state";
import { RunStore } from "@/server/run-store";
import { globalRateLimiter } from "@/server/ai/rate-limit";
import { endAssessmentRun, startAssessment } from "./assess";
import { selectDomainCandidate } from "./select";
import { toPublicRunView } from "./public-view";
import type { RunId } from "@/core/run-state";

describe("assessment workflow", () => {
  beforeEach(() => {
    globalRateLimiter.reset();
  });

  it("assesses the controlled example without AI and ranks candidates", async () => {
    const store = new RunStore();
    const result = await startAssessment({
      clientKeyHash: "client-a",
      source: { type: "fixture", fixtureId: "controlled-example" },
      store,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(["assessed", "not_ready"]).toContain(result.run.phase);
    const view = toPublicRunView(result.run);
    expect(view.phase).toBe(result.run.phase);
    expect(JSON.stringify(view)).not.toContain("AI_API_KEY");
    if (result.run.phase === "assessed" || result.run.phase === "not_ready") {
      expect(result.run.ranking.candidates.length).toBeGreaterThan(0);
      expect(result.run.analysis.routes.length).toBeGreaterThan(0);
    }
  });

  it("stops on unsupported ESM with eligibility failure and no analysis ranking", async () => {
    const store = new RunStore();
    const result = await startAssessment({
      clientKeyHash: "client-b",
      source: { type: "fixture", fixtureId: "unsupported-esm" },
      store,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.run.phase).toBe("eligibility_failed");
  });

  it("selects a ready candidate and plans three required stages", async () => {
    const store = new RunStore();
    const assessed = await startAssessment({
      clientKeyHash: "client-c",
      source: { type: "fixture", fixtureId: "controlled-example" },
      store,
    });
    expect(assessed.ok).toBe(true);
    if (!assessed.ok) return;
    if (assessed.run.phase !== "assessed") {
      // If no ready candidate, selection must fail — still a valid path
      const fail = selectDomainCandidate({
        runId: assessed.run.runId as RunId,
        candidateId:
          assessed.run.phase === "not_ready" ? assessed.run.ranking.candidates[0]!.id : "x",
        clientKeyHash: "client-c",
        store,
      });
      expect(fail.ok).toBe(false);
      return;
    }

    const assessedRun = assessed.run;
    if (assessedRun.phase !== "assessed") return;

    const ready = assessedRun.ranking.candidates.find((c) => {
      const r = assessedRun.readinessByCandidateId.get(c.id);
      return r?.ready;
    });
    expect(ready).toBeDefined();
    if (!ready) return;

    const selected = selectDomainCandidate({
      runId: assessedRun.runId,
      candidateId: ready.id,
      clientKeyHash: "client-c",
      store,
    });
    expect(selected.ok).toBe(true);
    if (!selected.ok) return;
    expect(selected.run.phase).toBe("awaiting_authorization");
    if (selected.run.phase === "awaiting_authorization") {
      expect(selected.run.sequence.requiredStages).toHaveLength(3);
      expect(selected.run.currentStage.kind).toBe("behavior_capture");
    }
  });

  it("binds runs to client key hash", async () => {
    const store = new RunStore();
    const result = await startAssessment({
      clientKeyHash: "owner",
      source: { type: "fixture", fixtureId: "controlled-example" },
      store,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stolen = selectDomainCandidate({
      runId: result.run.runId,
      candidateId: "orders",
      clientKeyHash: "other",
      store,
    });
    expect(stolen.ok).toBe(false);
    if (!stolen.ok) expect(stolen.code).toBe("RUN_FORBIDDEN");
  });

  it("rate-limits starts per client", async () => {
    // Use isolated limiter via direct unit already covered; here ensure assess fails when global saturated
    const store = new RunStore({ maxActiveRuns: 10 });
    // Saturate starts for client
    for (let i = 0; i < 3; i += 1) {
      const r = await startAssessment({
        clientKeyHash: "limited",
        source: { type: "fixture", fixtureId: "missing-mongoose" },
        store,
      });
      expect(r.ok).toBe(true);
    }
    const blocked = await startAssessment({
      clientKeyHash: "limited",
      source: { type: "fixture", fixtureId: "missing-mongoose" },
      store,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.code).toBe("RATE_LIMIT_STARTS");
  });

  it("ends an owned idle run and immediately allows another assessment", async () => {
    const store = new RunStore();
    const assessed = await startAssessment({
      clientKeyHash: "owner",
      source: { type: "fixture", fixtureId: "controlled-example" },
      store,
    });
    expect(assessed.ok).toBe(true);
    if (!assessed.ok) return;

    expect(
      endAssessmentRun({
        runId: assessed.run.runId,
        clientKeyHash: "owner",
        store,
      }),
    ).toEqual({ ok: true });
    expect(store.get(assessed.run.runId)).toBeUndefined();

    const restarted = await startAssessment({
      clientKeyHash: "owner",
      source: { type: "fixture", fixtureId: "controlled-example" },
      store,
    });
    expect(restarted.ok).toBe(true);
  });

  it("does not end another client's run or a server-busy run", async () => {
    const store = new RunStore();
    const assessed = await startAssessment({
      clientKeyHash: "owner",
      source: { type: "fixture", fixtureId: "controlled-example" },
      store,
    });
    expect(assessed.ok).toBe(true);
    if (!assessed.ok) return;

    expect(
      endAssessmentRun({
        runId: assessed.run.runId,
        clientKeyHash: "other",
        store,
      }),
    ).toMatchObject({ ok: false, code: "RUN_FORBIDDEN", status: 403 });
    expect(store.get(assessed.run.runId)).toBeDefined();

    const busyStore = new RunStore();
    const created = busyStore.create("busy-owner");
    const loading = beginLoading(created, "fixture:test");
    expect(loading.ok).toBe(true);
    if (!loading.ok) return;
    busyStore.set(loading.state);

    expect(
      endAssessmentRun({
        runId: loading.state.runId,
        clientKeyHash: "busy-owner",
        store: busyStore,
      }),
    ).toMatchObject({ ok: false, code: "RUN_BUSY", status: 409 });
    expect(busyStore.get(loading.state.runId)).toBeDefined();
  });

  it("returns the replaceable run id with an active-client limit", async () => {
    const store = new RunStore();
    const assessed = await startAssessment({
      clientKeyHash: "owner",
      source: { type: "fixture", fixtureId: "controlled-example" },
      store,
    });
    expect(assessed.ok).toBe(true);
    if (!assessed.ok) return;

    const blocked = await startAssessment({
      clientKeyHash: "owner",
      source: { type: "fixture", fixtureId: "controlled-example" },
      store,
    });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked).toMatchObject({
      code: "RATE_LIMIT_ACTIVE_CLIENT",
      activeRunId: assessed.run.runId,
    });
  });
});
