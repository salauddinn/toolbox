import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { assertNormalizedPath } from "@/core/paths";
import { createRepositoryFile, createSourceSnapshot } from "@/core/repository";
import {
  DEFAULT_STAGE_BUDGETS,
  type ModernizationSequencePlan,
  type StagePlan,
} from "@/core/stages";
import { buildResultArtifact } from "./build";

function stage(kind: StagePlan["kind"], id: string): StagePlan {
  return {
    id,
    kind,
    title: kind,
    purpose: "test purpose that is long enough",
    conditional: kind === "cycle_repair",
    evidence: [],
    expectedFiles: [],
    pathEnvelope: { create: [], update: [], delete: [] },
    mutableRegions: [],
    protectedFingerprints: [],
    validationCriteria: [],
    budgets: { ...DEFAULT_STAGE_BUDGETS },
  };
}

function sequence(): ModernizationSequencePlan {
  return {
    requiredStages: [
      stage("behavior_capture", "s1") as StagePlan & { kind: "behavior_capture" },
      stage("domain_module", "s2") as StagePlan & { kind: "domain_module" },
      stage("integration_cleanup", "s3") as StagePlan & { kind: "integration_cleanup" },
    ],
  };
}

function readLocalNames(zip: Buffer): string[] {
  const names: string[] = [];
  let offset = 0;
  while (offset + 4 <= zip.length) {
    const sig = zip.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;
    const compSize = zip.readUInt32LE(offset + 18);
    const nameLen = zip.readUInt16LE(offset + 26);
    const extraLen = zip.readUInt16LE(offset + 28);
    const name = zip.subarray(offset + 30, offset + 30 + nameLen).toString("utf8");
    names.push(name);
    offset += 30 + nameLen + extraLen + compSize;
  }
  return names;
}

describe("buildResultArtifact", () => {
  it("puts report at ZIP root and only final snapshot under repository/", () => {
    const initial = createSourceSnapshot({
      snapshotId: "init",
      sourceLabel: "fixture://controlled-example",
      files: [
        createRepositoryFile(
          assertNormalizedPath("app.js"),
          "module.exports = { createApp() {} };\n",
        ),
        createRepositoryFile(assertNormalizedPath("legacy.js"), "module.exports = 1;\n"),
      ],
      contentHash: "i",
    });
    const final = createSourceSnapshot({
      snapshotId: "final",
      sourceLabel: initial.sourceLabel,
      files: [
        createRepositoryFile(
          assertNormalizedPath("app.js"),
          "module.exports = { createApp() {} };\n",
        ),
        createRepositoryFile(
          assertNormalizedPath("src/modules/orders/index.js"),
          "module.exports = {};\n",
        ),
      ],
      contentHash: "f",
    });

    const artifact = buildResultArtifact({
      runId: "run_test",
      sourceLabel: initial.sourceLabel,
      selectedCandidate: {
        id: "orders",
        name: "Orders",
        technicalScore: 1,
        confidence: 1,
        routes: [],
        files: [],
        signals: [],
        conflictingEvidence: [],
      },
      sequence: sequence(),
      initialSnapshot: initial,
      finalSnapshot: final,
      acceptedChangeSets: [
        {
          id: "cs1",
          stageId: "s1",
          stageKind: "behavior_capture",
          operations: [],
          status: "accepted",
          attempt: 1,
          createdAt: new Date().toISOString(),
        },
      ],
      validationReports: [
        {
          stageId: "s1",
          changeSetId: "cs1",
          attempts: [{ attempt: 1, checks: [], passed: true }],
          finalOutcome: "passed",
          externalTestsLabel: "not_executed",
        },
      ],
    });

    expect(artifact.report.externalTestsLabel).toBe("not_executed");
    expect(artifact.report.fileTrees.before).toContain("legacy.js");
    expect(artifact.report.fileTrees.after).not.toContain("legacy.js");
    expect(artifact.report.localRuntimeVerification.commands).toContain("npm test");

    const names = readLocalNames(artifact.zip);
    expect(names).toContain("toolbox-validation-report.json");
    expect(names).toContain("repository/app.js");
    expect(names).toContain("repository/src/modules/orders/index.js");
    expect(names.some((n) => n.includes("legacy"))).toBe(false);

    // report JSON is valid
    const sig = artifact.zip.readUInt32LE(0);
    expect(sig).toBe(0x04034b50);
    const method = artifact.zip.readUInt16LE(8);
    const compSize = artifact.zip.readUInt32LE(18);
    const nameLen = artifact.zip.readUInt16LE(26);
    const extraLen = artifact.zip.readUInt16LE(28);
    const dataStart = 30 + nameLen + extraLen;
    const payload = artifact.zip.subarray(dataStart, dataStart + compSize);
    const reportJson =
      method === 0 ? payload.toString("utf8") : inflateRawSync(payload).toString("utf8");
    const parsed = JSON.parse(reportJson) as { schemaVersion: number };
    expect(parsed.schemaVersion).toBe(1);
  });
});
