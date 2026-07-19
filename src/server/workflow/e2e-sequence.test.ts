import { inflateRawSync } from "node:zlib";
import { describe, expect, it, beforeEach } from "vitest";
import type { RunId } from "@/core/run-state";
import { globalRateLimiter } from "@/server/ai/rate-limit";
import { RunStore } from "@/server/run-store";
import { startAssessment } from "./assess";
import { selectDomainCandidate } from "./select";
import { acceptCurrentChangeSet, authorizeAndGenerate } from "./stage-runner";
import { buildDownloadArtifact } from "./download";

async function selectReady(store: RunStore, clientKeyHash: string) {
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
  if (!selected.ok) throw new Error(selected.message);
  return selected.run;
}

describe("controlled-example end-to-end sequence", () => {
  beforeEach(() => {
    globalRateLimiter.reset();
  });

  it("runs all stages to completed and produces a valid result ZIP", async () => {
    const store = new RunStore();
    const client = "e2e-client";
    let run = await selectReady(store, client);
    const runId = run.runId as RunId;
    const maxStages = 4;
    const generatedStageKinds: string[] = [];

    for (let i = 0; i < maxStages; i += 1) {
      const current = store.get(runId);
      expect(current).toBeDefined();
      if (!current) return;
      if (current.phase === "completed") break;
      expect(current.phase).toBe("awaiting_authorization");

      const generated = await authorizeAndGenerate({
        runId,
        clientKeyHash: client,
        store,
        forceDeterministic: true,
      });
      expect(generated.ok).toBe(true);
      if (!generated.ok) {
        throw new Error(`${generated.code}: ${generated.message}`);
      }
      expect(generated.run.phase).toBe("awaiting_acceptance");
      if (generated.run.phase !== "awaiting_acceptance") {
        throw new Error(`expected awaiting_acceptance, got ${generated.run.phase}`);
      }
      expect(generated.validationReport?.finalOutcome).toBe("passed");
      generatedStageKinds.push(generated.run.currentStage.kind);
      if (generated.run.currentStage.kind === "cycle_repair") {
        expect(generated.validationReport?.attempts[0]?.checks).toContainEqual({
          id: "factory-injection",
          kind: "static",
          title: "Public module factory has the supported injection shape",
          outcome: "passed",
          detail: "factory:createOrdersModule; dependency:paymentsApi",
        });
        expect(generated.validationReport?.attempts[0]?.checks).toContainEqual({
          id: "composition-root-injection",
          kind: "static",
          title: "Recognized composition root supplies the factory dependency",
          outcome: "passed",
          detail: "root:app.js; paymentsApi:routes/payments.js",
        });
      }

      const accepted = acceptCurrentChangeSet({ runId, clientKeyHash: client, store });
      expect(accepted.ok).toBe(true);
      if (!accepted.ok) throw new Error(accepted.message);
      run = accepted.run;
    }

    expect(run.phase).toBe("completed");
    if (run.phase !== "completed") return;

    expect(run.acceptedChangeSets).toHaveLength(4);
    expect(generatedStageKinds).toEqual([
      "behavior_capture",
      "domain_module",
      "cycle_repair",
      "integration_cleanup",
    ]);
    expect(run.validationReports).toHaveLength(run.acceptedChangeSets.length);
    expect(run.initialSnapshot.contentHash).not.toBe(run.snapshot.contentHash);
    expect([...run.snapshot.files.keys()].some((p) => p.includes("src/modules/"))).toBe(true);

    const download = buildDownloadArtifact({ runId, clientKeyHash: client, store });
    expect(download.ok).toBe(true);
    if (!download.ok) return;

    expect(download.artifact.filename).toMatch(/toolbox-.*-result\.zip/);
    expect(download.artifact.report.schemaVersion).toBe(1);
    expect(download.artifact.report.externalTestsLabel).toBe("not_executed");
    expect(download.artifact.report.localRuntimeVerification.commands).toContain("npm test");
    expect(download.artifact.report.fileTrees.after.some((p) => p.startsWith("src/modules/"))).toBe(
      true,
    );

    // ZIP structure: report at root, repository/ prefix only for snapshot files
    const zip = download.artifact.zip;
    const names: string[] = [];
    let offset = 0;
    while (offset + 4 <= zip.length) {
      const sig = zip.readUInt32LE(offset);
      if (sig !== 0x04034b50) break;
      const method = zip.readUInt16LE(offset + 8);
      const compSize = zip.readUInt32LE(offset + 18);
      const nameLen = zip.readUInt16LE(offset + 26);
      const extraLen = zip.readUInt16LE(offset + 28);
      const name = zip.subarray(offset + 30, offset + 30 + nameLen).toString("utf8");
      names.push(name);
      if (name === "toolbox-validation-report.json") {
        const dataStart = offset + 30 + nameLen + extraLen;
        const payload = zip.subarray(dataStart, dataStart + compSize);
        const json =
          method === 0 ? payload.toString("utf8") : inflateRawSync(payload).toString("utf8");
        const doc = JSON.parse(json) as { runId: string; stages: unknown[] };
        expect(doc.runId).toBe(String(runId));
        expect(doc.stages.length).toBe(run.acceptedChangeSets.length);
      }
      offset += 30 + nameLen + extraLen + compSize;
    }
    expect(names[0]).toBe("toolbox-validation-report.json");
    expect(
      names.every((n) => n === "toolbox-validation-report.json" || n.startsWith("repository/")),
    ).toBe(true);
  }, 60_000);

  it("honest rejection fixture never reaches generation", async () => {
    const store = new RunStore();
    const result = await startAssessment({
      clientKeyHash: "reject-client",
      source: { type: "fixture", fixtureId: "unsupported-esm" },
      store,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.run.phase).toBe("eligibility_failed");
    const blocked = await authorizeAndGenerate({
      runId: result.run.runId as RunId,
      clientKeyHash: "reject-client",
      store,
      forceDeterministic: true,
    });
    expect(blocked.ok).toBe(false);
  });
});
