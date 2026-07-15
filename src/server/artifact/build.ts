import type { ChangeSet } from "@/core/changes";
import type { DomainCandidate } from "@/core/candidates";
import type { RunId } from "@/core/run-state";
import type { SourceSnapshot } from "@/core/repository";
import type { ModernizationSequencePlan } from "@/core/stages";
import type { ValidationReport } from "@/core/validation";
import type { SnapshotDiff } from "@/server/snapshot/diff";
import { buildFinalValidationReport, type ToolboxValidationReportDocument } from "./report";
import { buildZip } from "./zip";

export type ArtifactBundle = {
  report: ToolboxValidationReportDocument;
  zip: Buffer;
  filename: string;
};

/**
 * Build result ZIP: repository/* = accepted snapshot only;
 * toolbox-validation-report.json at archive root (Task 13).
 */
export function buildResultArtifact(input: {
  runId: RunId | string;
  sourceLabel: string;
  selectedCandidate: DomainCandidate;
  sequence: ModernizationSequencePlan;
  initialSnapshot: SourceSnapshot;
  finalSnapshot: SourceSnapshot;
  acceptedChangeSets: readonly ChangeSet[];
  validationReports: readonly ValidationReport[];
  stageDiffs?: readonly SnapshotDiff[];
}): ArtifactBundle {
  const report = buildFinalValidationReport({
    runId: String(input.runId),
    sourceLabel: input.sourceLabel,
    selectedCandidate: input.selectedCandidate,
    sequence: input.sequence,
    initialSnapshot: input.initialSnapshot,
    finalSnapshot: input.finalSnapshot,
    acceptedChangeSets: input.acceptedChangeSets,
    validationReports: input.validationReports,
    stageDiffs: input.stageDiffs,
  });

  const entries = [
    {
      path: "toolbox-validation-report.json",
      content: JSON.stringify(report, null, 2),
      method: "deflate" as const,
    },
    ...[...input.finalSnapshot.files.values()]
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((file) => ({
        path: `repository/${file.path}`,
        content: file.content,
        method: "deflate" as const,
      })),
  ];

  const zip = buildZip(entries);
  const safeName = input.selectedCandidate.id.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  return {
    report,
    zip,
    filename: `toolbox-${safeName}-result.zip`,
  };
}
