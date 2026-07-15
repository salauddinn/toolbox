import { randomBytes } from "node:crypto";
import type { RunId, RunState } from "@/core/run-state";
import { createRun, expireRun } from "@/core/run-state";

/** Inactive runs expire after 30 minutes (ADR-0014). */
export const RUN_TTL_MS = 30 * 60 * 1000;

export const DEFAULT_MAX_ACTIVE_RUNS = 5;

export type RunStoreOptions = {
  ttlMs?: number;
  maxActiveRuns?: number;
  now?: () => number;
};

/**
 * Process-local run store for the long-lived single-process host (ADR-0015).
 * Process restart discards all active runs.
 */
export class RunStore {
  private readonly runs = new Map<RunId, RunState>();
  private readonly ttlMs: number;
  private readonly maxActiveRuns: number;
  private readonly now: () => number;

  constructor(options: RunStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? RUN_TTL_MS;
    this.maxActiveRuns = options.maxActiveRuns ?? DEFAULT_MAX_ACTIVE_RUNS;
    this.now = options.now ?? Date.now;
  }

  create(clientKeyHash: string): RunState {
    this.evictExpired();
    if (this.activeCount() >= this.maxActiveRuns) {
      throw new Error("RUN_CAPACITY: maximum active runs reached for this process");
    }
    const runId = randomBytes(24).toString("base64url") as RunId;
    const state = createRun({ runId, clientKeyHash });
    this.runs.set(runId, state);
    return state;
  }

  get(runId: RunId): RunState | undefined {
    this.evictExpired();
    const state = this.runs.get(runId);
    if (!state) {
      return undefined;
    }
    if (this.isExpired(state)) {
      this.runs.delete(runId);
      return undefined;
    }
    return state;
  }

  set(state: RunState): void {
    this.runs.set(state.runId, state);
  }

  delete(runId: RunId): void {
    this.runs.delete(runId);
  }

  activeCount(): number {
    this.evictExpired();
    return this.runs.size;
  }

  /** Test helper. */
  clear(): void {
    this.runs.clear();
  }

  private isExpired(state: RunState): boolean {
    if (state.phase === "expired" || state.phase === "completed") {
      return false;
    }
    const last = Date.parse(state.lastActiveAt);
    if (Number.isNaN(last)) {
      return true;
    }
    return this.now() - last > this.ttlMs;
  }

  private evictExpired(): void {
    for (const [id, state] of this.runs) {
      if (state.phase === "completed") {
        continue;
      }
      if (this.isExpired(state)) {
        const expired = expireRun(state);
        if (expired.ok) {
          this.runs.set(id, expired.state);
        }
        this.runs.delete(id);
      }
    }
  }
}

/** Singleton used by route handlers in the long-lived process. */
export const globalRunStore = new RunStore();
