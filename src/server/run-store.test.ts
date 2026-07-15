import { describe, expect, it } from "vitest";
import { beginLoading } from "@/core/run-state";
import { RunStore } from "./run-store";

describe("RunStore", () => {
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
});
