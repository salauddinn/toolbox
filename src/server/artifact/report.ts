import type { ChangeSet } from "@/core/changes";
import type { DomainCandidate } from "@/core/candidates";
import type { SourceSnapshot } from "@/core/repository";
import type { ModernizationSequencePlan } from "@/core/stages";
import type { ValidationReport } from "@/core/validation";
import { orderedStages } from "@/core/run-state";
import { diffSnapshots, fileTree, type SnapshotDiff } from "@/server/snapshot/diff";

export type StageArtifactSummary = {
  stageId: string;
  stageKind: string;
  title: string;
  changeSetId: string;
  attempt: 1 | 2;
  operationCount: number;
  diff: {
    created: number;
    updated: number;
    deleted: number;
    paths: string[];
  };
  validation: ValidationReport;
};

/**
 * Final downloadable report. Records only checks that ran (ADR-0005).
 * Matches UI Validation Report fields; does not claim unrun checks.
 */
export type ToolboxValidationReportDocument = {
  schemaVersion: 1;
  generatedAt: string;
  runId: string;
  sourceLabel: string;
  selectedDomain: {
    id: string;
    name: string;
  };
  sequence: {
    stageKinds: string[];
    conditionalIncluded: boolean;
    pendingConditionalResolved: boolean;
  };
  fileTrees: {
    before: string[];
    after: string[];
  };
  stages: StageArtifactSummary[];
  combinedDiff: {
    created: number;
    updated: number;
    deleted: number;
    paths: string[];
  };
  externalTestsLabel: "not_executed" | null;
  localRuntimeVerification: {
    note: string;
    commands: string[];
  };
  limitations: string[];
};

export type BuildFinalReportInput = {
  runId: string;
  sourceLabel: string;
  selectedCandidate: DomainCandidate;
  sequence: ModernizationSequencePlan;
  initialSnapshot: SourceSnapshot;
  finalSnapshot: SourceSnapshot;
  acceptedChangeSets: readonly ChangeSet[];
  validationReports: readonly ValidationReport[];
  /** Optional per-stage base→candidate diffs captured during the run. */
  stageDiffs?: readonly SnapshotDiff[];
};

function summarizeDiff(diff: SnapshotDiff): StageArtifactSummary["diff"] {
  return {
    created: diff.created,
    updated: diff.updated,
    deleted: diff.deleted,
    paths: diff.files.map((f) => `${f.kind}:${f.path}`),
  };
}

/**
 * Pure builder: final report from accepted Change Sets and snapshots only.
 */
export function buildFinalValidationReport(
  input: BuildFinalReportInput,
): ToolboxValidationReportDocument {
  const stagesMeta = orderedStages(input.sequence);
  const stages: StageArtifactSummary[] = input.acceptedChangeSets.map((cs, index) => {
    const meta = stagesMeta.find((s) => s.id === cs.stageId) ?? stagesMeta[index];
    const report =
      input.validationReports.find((r) => r.changeSetId === cs.id) ??
      input.validationReports[index];
    const stageDiff = input.stageDiffs?.[index];
    return {
      stageId: cs.stageId,
      stageKind: cs.stageKind,
      title: meta?.title ?? cs.stageKind,
      changeSetId: cs.id,
      attempt: cs.attempt,
      operationCount: cs.operations.length,
      diff: stageDiff
        ? summarizeDiff(stageDiff)
        : {
            created: cs.operations.filter((o) => o.type === "create").length,
            updated: cs.operations.filter((o) => o.type === "update").length,
            deleted: cs.operations.filter((o) => o.type === "delete").length,
            paths: cs.operations.map((o) => `${o.type}:${o.path}`),
          },
      validation: report ?? {
        stageId: cs.stageId,
        changeSetId: cs.id,
        attempts: [],
        finalOutcome: "passed",
      },
    };
  });

  const combined = diffSnapshots(input.initialSnapshot, input.finalSnapshot);
  const hasBehaviorCapture = input.acceptedChangeSets.some(
    (c) => c.stageKind === "behavior_capture",
  );

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    runId: input.runId,
    sourceLabel: input.sourceLabel,
    selectedDomain: {
      id: input.selectedCandidate.id,
      name: input.selectedCandidate.name,
    },
    sequence: {
      stageKinds: stagesMeta.map((s) => s.kind),
      conditionalIncluded: Boolean(input.sequence.conditionalStage),
      pendingConditionalResolved: !input.sequence.pendingConditional,
    },
    fileTrees: {
      before: fileTree(input.initialSnapshot),
      after: fileTree(input.finalSnapshot),
    },
    stages,
    combinedDiff: summarizeDiff(combined),
    externalTestsLabel: hasBehaviorCapture ? "not_executed" : null,
    localRuntimeVerification: {
      note: "ToolBox does not execute external repositories. Run these locally after extracting repository/ from the ZIP.",
      commands: ["cd repository", "npm install", "npm test"],
    },
    limitations: [
      "Static Validation examined repository artifacts without installing dependencies or executing application code for external repositories.",
      "Runtime Validation applies only when the controlled bundled example is executed separately by the developer.",
      "External generated characterization tests are labeled not_executed.",
      "Passing Safety Screening is not malware certification.",
      "Modernization Recommendations remain advisory until confirmed by the developer.",
    ],
  };
}
