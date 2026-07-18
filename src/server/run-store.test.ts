import { beforeEach, describe, expect, it } from "vitest";
import { beginLoading } from "@/core/run-state";
import { globalRateLimiter } from "@/server/ai/rate-limit";
import { startAssessment } from "@/server/workflow/assess";
import { RunStore } from "./run-store";

describe("RunStore", () => {
  beforeEach(() => {
    globalRateLimiter.reset();
  });

  it("expires inactive runs after the TTL", () => {
    let now = Date.now();
    const store = new RunStore({ ttlMs: 1_000, now: () => now });
    const created = store.create("client-hash");
    const loading = beginLoading(created, "example");
    expect(loading.ok).toBe(true);
    if (!loading.ok) return;
    // Freeze lastActiveAt to the mocked clock so TTL math is deterministic.
    store.set({
      ...loading.state,
      lastActiveAt: new Date(now).toISOString(),
    });

    now += 2_000;
    expect(store.get(created.runId)).toBeUndefined();
  });

  it("enforces max active runs", () => {
    const store = new RunStore({ maxActiveRuns: 1 });
    store.create("a");
    expect(() => store.create("b")).toThrow(/RUN_CAPACITY/);
  });

  it("finds only an owner's idle capacity-holding run", async () => {
    const store = new RunStore();
    const result = await startAssessment({
      clientKeyHash: "client-a",
      source: { type: "fixture", fixtureId: "controlled-example" },
      store,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.run.phase !== "assessed") return;

    expect(store.findReplaceableByClient("client-a")?.runId).toBe(result.run.runId);
    expect(store.findReplaceableByClient("client-b")).toBeUndefined();

    const busyStore = new RunStore();
    const loading = beginLoading(busyStore.create("client-busy"), "fixture:test");
    expect(loading.ok).toBe(true);
    if (!loading.ok) return;
    busyStore.set(loading.state);
    expect(busyStore.findReplaceableByClient("client-busy")).toBeUndefined();
  });

  it("does not let an expired terminal run release a newer run's slot", async () => {
    const now = Date.now();
    const store = new RunStore({ ttlMs: 1_000, maxActiveRuns: 10, now: () => now });
    const terminal = await startAssessment({
      clientKeyHash: "same-client",
      source: { type: "fixture", fixtureId: "missing-mongoose" },
      store,
    });
    expect(terminal.ok).toBe(true);
    if (!terminal.ok) return;

    const active = await startAssessment({
      clientKeyHash: "same-client",
      source: { type: "fixture", fixtureId: "controlled-example" },
      store,
    });
    expect(active.ok).toBe(true);
    if (!active.ok) return;

    store.set({
      ...terminal.run,
      lastActiveAt: new Date(now - 2_000).toISOString(),
    });
    store.set({ ...active.run, lastActiveAt: new Date(now).toISOString() });

    expect(store.get(terminal.run.runId)).toBeUndefined();
    const blocked = globalRateLimiter.tryStart("same-client");
    expect(blocked).toMatchObject({ ok: false, code: "RATE_LIMIT_ACTIVE_CLIENT" });
  });
});
