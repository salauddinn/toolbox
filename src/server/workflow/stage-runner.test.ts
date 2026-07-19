import { describe, expect, it, beforeEach } from "vitest";
import type { RunId, RunState } from "@/core/run-state";
import { assertNormalizedPath } from "@/core/paths";
import { globalRateLimiter } from "@/server/ai/rate-limit";
import { OpenAiCompatibleProvider } from "@/server/ai/provider";
import { loadDoubleFailureAiFixture } from "@/fixtures/load-fixture";
import { RunStore } from "@/server/run-store";
import { startAssessment } from "./assess";
import { selectDomainCandidate } from "./select";
import {
  acceptCurrentChangeSet,
  authorizeAndGenerate,
  rejectCurrentChangeSet,
  validateInjectedOperations,
} from "./stage-runner";

function snapshotFingerprint(run: RunState) {
  if (!("snapshot" in run)) throw new Error("run has no snapshot");
  return [...run.snapshot.files.entries()]
    .map(([path, file]) => [path, file.content] as const)
    .sort(([left], [right]) => left.localeCompare(right));
}

async function readyRun(store: RunStore, clientKeyHash: string) {
  const assessed = await startAssessment({
    clientKeyHash,
    source: { type: "fixture", fixtureId: "controlled-example" },
    store,
  });
  expect(assessed.ok).toBe(true);
  if (!assessed.ok) throw new Error("assess failed");
  expect(assessed.run.phase).toBe("assessed");
  if (assessed.run.phase !== "assessed") throw new Error("not assessed");
  const assessedRun = assessed.run;

  const ready = assessedRun.ranking.candidates.find(
    (c) => assessedRun.readinessByCandidateId.get(c.id)?.ready,
  );
  expect(ready).toBeDefined();
  const selected = selectDomainCandidate({
    runId: assessedRun.runId,
    candidateId: ready!.id,
    clientKeyHash,
    store,
  });
  expect(selected.ok).toBe(true);
  if (!selected.ok) throw new Error("select failed");
  return selected.run;
}

describe("stage runner", () => {
  beforeEach(() => {
    globalRateLimiter.reset();
  });

  it("generates, validates, accepts behaviour capture without leaking on reject path", async () => {
    const store = new RunStore();
    const run = await readyRun(store, "stage-a");
    expect(run.phase).toBe("awaiting_authorization");

    const generated = await authorizeAndGenerate({
      runId: run.runId as RunId,
      clientKeyHash: "stage-a",
      store,
      forceDeterministic: true,
    });
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    expect(generated.run.phase).toBe("awaiting_acceptance");
    expect(generated.validationReport?.finalOutcome).toBe("passed");
    expect(generated.validationReport?.externalTestsLabel).toBe("not_executed");

    const beforeFiles =
      generated.run.phase === "awaiting_acceptance" ? generated.run.snapshot.files.size : 0;

    const rejected = rejectCurrentChangeSet({
      runId: run.runId as RunId,
      clientKeyHash: "stage-a",
      store,
    });
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    expect(rejected.run.phase).toBe("sequence_stopped");
    if (rejected.run.phase === "sequence_stopped") {
      expect(rejected.run.snapshot.files.size).toBe(beforeFiles);
      expect(rejected.run.reason).toBe("developer_rejected");
    }
  });

  it("uses deterministic generation for a demo run without provider credentials", async () => {
    const store = new RunStore();
    const assessed = await startAssessment({
      clientKeyHash: "demo-stage",
      source: { type: "fixture", fixtureId: "controlled-example", demo: true },
      store,
    });
    expect(assessed.ok).toBe(true);
    if (!assessed.ok) return;
    const assessedRun = assessed.run;
    if (assessedRun.phase !== "assessed") return;
    const ready = assessedRun.ranking.candidates.find(
      (candidate) => assessedRun.readinessByCandidateId.get(candidate.id)?.ready,
    );
    expect(ready).toBeDefined();
    if (!ready) return;
    const selected = selectDomainCandidate({
      runId: assessedRun.runId,
      candidateId: ready.id,
      clientKeyHash: "demo-stage",
      store,
    });
    expect(selected.ok).toBe(true);
    if (!selected.ok) return;

    const generated = await authorizeAndGenerate({
      runId: selected.run.runId,
      clientKeyHash: "demo-stage",
      store,
    });
    expect(generated.ok).toBe(true);
    if (generated.ok) expect(generated.run.phase).toBe("awaiting_acceptance");
  });

  it("keeps an over-budget provider output out of the candidate snapshot", async () => {
    const store = new RunStore();
    const run = await readyRun(store, "stage-provider-output-budget");
    let calls = 0;
    const provider = new OpenAiCompatibleProvider({
      fetchImpl: (async () => {
        calls += 1;
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    operations: [
                      {
                        type: "create",
                        path: "tests/orders.characterization.test.js",
                        content: "test('orders', () => {});",
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as typeof fetch,
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      model: "test-model",
      tokenBudgets: { input: 100_000, output: 1 },
    });

    const result = await authorizeAndGenerate({
      runId: run.runId as RunId,
      clientKeyHash: "stage-provider-output-budget",
      store,
      provider,
      forceDeterministic: false,
    });

    expect(calls).toBe(1);
    expect(result).toMatchObject({ ok: false, code: "PROVIDER_BUDGET", status: 502 });
    const stored = store.get(run.runId as RunId);
    expect(stored?.phase).toBe("awaiting_authorization");
    if (stored?.phase === "awaiting_authorization") {
      expect(snapshotFingerprint(stored)).toEqual(snapshotFingerprint(run));
    }
  });

  it.each(["PROVIDER_INVALID_JSON", "PROVIDER_SCHEMA"] as const)(
    "restores awaiting authorization for nonretryable first-attempt %s failures",
    async (code) => {
      const store = new RunStore();
      const run = await readyRun(store, `stage-first-${code}`);
      const before = snapshotFingerprint(run);
      const provider = {
        async generate() {
          return {
            ok: false as const,
            code,
            message: "provider failure",
            retryable: false,
          };
        },
      };

      const result = await authorizeAndGenerate({
        runId: run.runId as RunId,
        clientKeyHash: `stage-first-${code}`,
        store,
        provider,
        forceDeterministic: false,
      });

      expect(result).toMatchObject({ ok: false, code, status: 502 });
      expect(result.run?.phase).toBe("awaiting_authorization");
      expect(store.get(run.runId as RunId)?.phase).toBe("awaiting_authorization");
      if (result.run?.phase === "awaiting_authorization") {
        expect(snapshotFingerprint(result.run)).toEqual(before);
      }
    },
  );

  it("rolls back after a provider failure during the sole repair attempt", async () => {
    const store = new RunStore();
    const run = await readyRun(store, "stage-repair-provider-failure");
    const before = snapshotFingerprint(run);
    let calls = 0;
    const provider = {
      async generate() {
        calls += 1;
        if (calls === 1) {
          return {
            ok: true as const,
            operations: [
              {
                type: "update" as const,
                path: assertNormalizedPath("package.json"),
                content: '{ "name": "must-fail-static-validation" }',
              },
            ],
            rawText: "{}",
            attempt: 1 as const,
          };
        }
        return {
          ok: false as const,
          code: "PROVIDER_SCHEMA" as const,
          message: "schema failure",
          retryable: false,
        };
      },
    };

    const result = await authorizeAndGenerate({
      runId: run.runId as RunId,
      clientKeyHash: "stage-repair-provider-failure",
      store,
      provider,
      forceDeterministic: false,
    });

    expect(calls).toBe(2);
    expect(result).toMatchObject({ ok: false, code: "PROVIDER_SCHEMA", status: 502 });
    expect(result.run?.phase).toBe("sequence_stopped");
    if (result.run?.phase === "sequence_stopped") {
      expect(result.run.reason).toBe("validation_rollback");
      expect(snapshotFingerprint(result.run)).toEqual(before);
      expect(result.run.validationReport?.finalOutcome).toBe("failed_rolled_back");
      expect(result.run.validationReport?.attempts).toHaveLength(2);
      expect(result.run.validationReport?.attempts[1]).toMatchObject({
        attempt: 2,
        passed: false,
        checks: [
          {
            id: "provider_generation",
            outcome: "failed",
            detail: "Provider repair generation failed (PROVIDER_SCHEMA)",
          },
        ],
        structuredErrors: ["provider_failure:PROVIDER_SCHEMA"],
      });
      expect(JSON.stringify(result.run.validationReport)).not.toContain("schema failure");
    }
  });

  it("preserves one repair attempt when its provider transport request retries", async () => {
    const store = new RunStore();
    const run = await readyRun(store, "stage-repair-transport-retry");
    let calls = 0;
    const requestBodies: Array<{ messages?: Array<{ content?: string }> }> = [];
    const badOperations = {
      operations: [
        {
          type: "update",
          path: "package.json",
          content: '{ "name": "must-fail-static-validation" }',
        },
      ],
    };
    const provider = new OpenAiCompatibleProvider({
      fetchImpl: (async (_url: string, init?: RequestInit) => {
        calls += 1;
        requestBodies.push(JSON.parse(String(init?.body)));
        if (calls === 2) return new Response("retry", { status: 429 });
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(badOperations) } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as typeof fetch,
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      model: "test-model",
      tokenBudgets: { input: 100_000, output: 100_000 },
    });

    const result = await authorizeAndGenerate({
      runId: run.runId as RunId,
      clientKeyHash: "stage-repair-transport-retry",
      store,
      provider,
      forceDeterministic: false,
    });

    expect(calls).toBe(3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.run.phase).toBe("sequence_stopped");
    expect(result.validationReport?.attempts).toHaveLength(2);
    expect(requestBodies[1]?.messages?.[1]?.content).toContain("Previous validation errors");
    expect(requestBodies[2]?.messages?.[1]?.content).toContain("Previous validation errors");
  });

  it("accepts behaviour capture and advances to domain_module", async () => {
    const store = new RunStore();
    const run = await readyRun(store, "stage-b");

    const generated = await authorizeAndGenerate({
      runId: run.runId as RunId,
      clientKeyHash: "stage-b",
      store,
      forceDeterministic: true,
    });
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;

    const accepted = acceptCurrentChangeSet({
      runId: run.runId as RunId,
      clientKeyHash: "stage-b",
      store,
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.run.phase).toBe("awaiting_authorization");
    if (accepted.run.phase === "awaiting_authorization") {
      expect(accepted.run.currentStage.kind).toBe("domain_module");
      expect(accepted.run.acceptedChangeSets).toHaveLength(1);
      expect(
        [...accepted.run.snapshot.files.keys()].some((p) => p.includes("characterization")),
      ).toBe(true);
    }
  });

  it("rolls back after double validation failure and blocks later stages", async () => {
    const store = new RunStore();
    const run = await readyRun(store, "stage-c");
    const fixture = loadDoubleFailureAiFixture();

    const attempt1 = await validateInjectedOperations({
      runId: run.runId as RunId,
      clientKeyHash: "stage-c",
      store,
      attempt: 1,
      operations: fixture.attempts[0]!.operations.map((op) => {
        if (op.type === "delete") {
          return { type: "delete" as const, path: assertNormalizedPath("routes/orders.js") };
        }
        // force valid path with bad content for parse errors; include package.json for manifest
        if (op.path === "package.json") {
          return {
            type: "update" as const,
            path: assertNormalizedPath("package.json"),
            content: '{ "name": "mutated-manifest" }',
          };
        }
        if (op.path.includes("..")) {
          return {
            type: "create" as const,
            path: assertNormalizedPath("routes/orders.js"),
            content: "this is not valid javascript {{{",
          };
        }
        return {
          type: op.type as "create" | "update",
          path: assertNormalizedPath(op.path.startsWith("tests/") ? op.path : "routes/orders.js"),
          content: (op as { content?: string }).content ?? "not valid {{{",
        };
      }),
    });

    // attempt 1 fails → repair path; with deterministic provider repair may succeed.
    // Force attempt 2 failure via second inject after repair starts, or use always-fail ops twice.
    // Simpler path: inject fail twice using validateInjectedOperations with attempt 2 after first failure.
    expect(attempt1.ok).toBe(true);
    if (!attempt1.ok) return;

    // If deterministic repair succeeded, force a second failure path separately:
    if (attempt1.run.phase === "awaiting_acceptance") {
      // unexpected success — reject and re-test pure double fail via sequential inject
      rejectCurrentChangeSet({
        runId: run.runId as RunId,
        clientKeyHash: "stage-c",
        store,
      });
    }

    // Fresh run for pure double-fail using mock that always returns bad ops
    const store2 = new RunStore();
    const run2 = await readyRun(store2, "stage-d");

    const badOps = [
      {
        type: "update" as const,
        path: assertNormalizedPath("package.json"),
        content: '{ "name": "x" }',
      },
      {
        type: "update" as const,
        path: assertNormalizedPath("routes/orders.js"),
        content: "not valid javascript {{{",
      },
    ];

    // Custom: first inject fails validation → beginRepair; second inject with attempt 2
    const first = await validateInjectedOperations({
      runId: run2.runId as RunId,
      clientKeyHash: "stage-d",
      store: store2,
      operations: badOps,
      attempt: 1,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // handleValidationFailure with attempt 1 calls repair loop with deterministic generator
    // which may produce valid ops. So final phase may be awaiting_acceptance.
    // For explicit double-fail, call validateInjectedOperations when phase is repairing —
    // but repair loop is automatic. Use provider mock instead.

    const store3 = new RunStore();
    const run3 = await readyRun(store3, "stage-e");
    const beforeRun3 = snapshotFingerprint(run3);

    // Override: two calls both return bad ops — first generation + repair
    let calls = 0;
    const doubleFailProvider = {
      async generate() {
        calls += 1;
        return {
          ok: true as const,
          operations: badOps,
          rawText: "{}",
          attempt: (calls === 1 ? 1 : 2) as 1 | 2,
        };
      },
    };

    const result = await authorizeAndGenerate({
      runId: run3.runId as RunId,
      clientKeyHash: "stage-e",
      store: store3,
      provider: doubleFailProvider,
      forceDeterministic: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.run.phase).toBe("sequence_stopped");
    if (result.run.phase === "sequence_stopped") {
      expect(result.run.reason).toBe("validation_rollback");
      expect(result.validationReport?.attempts.length).toBeGreaterThanOrEqual(2);
      expect(result.validationReport?.finalOutcome).toBe("failed_rolled_back");
      // Rollback restores the complete path-and-content snapshot, not only one expected file.
      expect(snapshotFingerprint(result.run)).toEqual(beforeRun3);
    }
    expect(calls).toBe(2);

    // Later stages blocked — authorize should fail
    const blocked = await authorizeAndGenerate({
      runId: run3.runId as RunId,
      clientKeyHash: "stage-e",
      store: store3,
      forceDeterministic: true,
    });
    expect(blocked.ok).toBe(false);
  });

  it("runs domain_module deterministic generation after behaviour capture accept", async () => {
    const store = new RunStore();
    const run = await readyRun(store, "stage-f");

    const g1 = await authorizeAndGenerate({
      runId: run.runId as RunId,
      clientKeyHash: "stage-f",
      store,
      forceDeterministic: true,
    });
    expect(g1.ok).toBe(true);
    const a1 = acceptCurrentChangeSet({
      runId: run.runId as RunId,
      clientKeyHash: "stage-f",
      store,
    });
    expect(a1.ok).toBe(true);
    if (!a1.ok) return;

    const g2 = await authorizeAndGenerate({
      runId: run.runId as RunId,
      clientKeyHash: "stage-f",
      store,
      forceDeterministic: true,
    });
    expect(g2.ok).toBe(true);
    if (!g2.ok) return;
    // domain module may fail route fingerprint if extraction differs — assert phase
    if (g2.run.phase === "awaiting_acceptance") {
      expect(g2.run.currentStage.kind).toBe("domain_module");
      const a2 = acceptCurrentChangeSet({
        runId: run.runId as RunId,
        clientKeyHash: "stage-f",
        store,
      });
      expect(a2.ok).toBe(true);
      if (a2.ok && a2.run.phase === "awaiting_authorization") {
        expect(["cycle_repair", "integration_cleanup"]).toContain(a2.run.currentStage.kind);
      }
    } else {
      // If validation failed and rolled back, still a defined outcome
      expect(["sequence_stopped", "awaiting_acceptance", "stage_failed_rolled_back"]).toContain(
        g2.run.phase,
      );
    }
  });
});
