import { beforeEach, describe, expect, it } from "vitest";
import type { RunState } from "@/core/run-state";
import { globalRateLimiter } from "@/server/ai/rate-limit";
import { RunStore } from "@/server/run-store";
import { startAssessment } from "./assess";
import { toPublicRunView } from "./public-view";
import { buildReviewPayload } from "./review-payload";
import { selectDomainCandidate } from "./select";
import { acceptCurrentChangeSet, authorizeAndGenerate } from "./stage-runner";

async function validatedRun(store: RunStore) {
  const assessed = await startAssessment({
    clientKeyHash: "review-payload-client",
    source: { type: "fixture", fixtureId: "controlled-example" },
    store,
  });
  if (!assessed.ok || assessed.run.phase !== "assessed") throw new Error("expected assessed run");
  const assessedRun = assessed.run;
  const candidate = assessedRun.ranking.candidates.find(
    (item) => assessedRun.readinessByCandidateId.get(item.id)?.ready,
  );
  if (!candidate) throw new Error("expected ready candidate");
  const selected = selectDomainCandidate({
    runId: assessedRun.runId,
    candidateId: candidate.id,
    clientKeyHash: "review-payload-client",
    store,
  });
  if (!selected.ok) throw new Error("expected selected run");
  const generated = await authorizeAndGenerate({
    runId: assessed.run.runId,
    clientKeyHash: "review-payload-client",
    store,
    forceDeterministic: true,
  });
  if (!generated.ok || generated.run.phase !== "awaiting_acceptance") {
    throw new Error("expected validated change set");
  }
  return generated.run;
}

describe("ReviewPayload", () => {
  beforeEach(() => globalRateLimiter.reset());

  it("builds a bounded, client-safe review and exposes it only while awaiting acceptance", async () => {
    const run = await validatedRun(new RunStore());
    const payload = buildReviewPayload(run);

    expect(payload).toMatchObject({
      changeSetId: run.changeSet.id,
      attempt: run.changeSet.attempt,
      validationReport: { changeSetId: run.changeSet.id, finalOutcome: "passed" },
    });
    expect(payload?.files).toHaveLength(run.changeSet.operations.length);
    expect(
      payload?.files.every((file) => file.path !== ".env" && !file.path.endsWith(".lock")),
    ).toBe(true);
    expect(
      payload?.files.every(
        (file) => file.kind === "create" || file.kind === "update" || file.kind === "delete",
      ),
    ).toBe(true);
    expect(payload?.truncationLabels).toContain("previews_truncated");

    const changedContent = run.candidateSnapshot.files.get(
      run.changeSet.operations[0]!.path,
    )?.content;
    expect(changedContent).toBeTruthy();
    expect(JSON.stringify(payload)).not.toContain(changedContent!);

    const publicRun = toPublicRunView(run);
    expect("reviewPayload" in publicRun && publicRun.reviewPayload).toEqual(payload);
  });

  it("labels truncated paths and redacts bounded validation detail", async () => {
    const run = await validatedRun(new RunStore());
    const operation = run.changeSet.operations[0]!;
    const report = {
      ...run.validationReport,
      attempts: run.validationReport.attempts.map((attempt) => ({
        ...attempt,
        checks: [
          ...attempt.checks,
          {
            id: "safe-detail",
            kind: "static" as const,
            title: "Safe detail",
            outcome: "passed" as const,
            detail: `token=review-secret-value ${"x".repeat(1_000)}`,
          },
        ],
      })),
    };
    const manyPaths: RunState = {
      ...run,
      changeSet: { ...run.changeSet, operations: Array.from({ length: 21 }, () => operation) },
      validationReport: report,
    };

    const payload = buildReviewPayload(manyPaths);
    expect(payload?.files).toHaveLength(20);
    expect(payload?.truncationLabels).toContain("paths_truncated");
    expect(payload?.truncationLabels).toContain("validation_details_truncated");
    expect(JSON.stringify(payload)).not.toContain("review-secret-value");
    expect(JSON.stringify(payload)).toContain("[REDACTED]");

    const writableOperation = run.changeSet.operations.find((item) => item.type !== "delete");
    if (!writableOperation) throw new Error("expected writable operation");
    const secretContent = "const token = review-preview-secret;\nmodule.exports = {};";
    const candidateFiles = new Map(run.candidateSnapshot.files);
    const candidateFile = candidateFiles.get(writableOperation.path);
    if (!candidateFile) throw new Error("expected candidate file");
    candidateFiles.set(writableOperation.path, {
      ...candidateFile,
      content: secretContent,
      sizeBytes: Buffer.byteLength(secretContent, "utf8"),
    });
    const previewSecret = buildReviewPayload({
      ...run,
      changeSet: {
        ...run.changeSet,
        operations: [{ ...writableOperation, content: secretContent }],
      },
      candidateSnapshot: { ...run.candidateSnapshot, files: candidateFiles },
    });
    expect(JSON.stringify(previewSecret)).not.toContain("review-preview-secret");
    expect(JSON.stringify(previewSecret)).toContain("[REDACTED]");
  });

  it("rejects stale or protected review state and does not expose a review in other phases", async () => {
    const store = new RunStore();
    const run = await validatedRun(store);
    const stale = {
      ...run,
      validationReport: { ...run.validationReport, changeSetId: "cs_stale" },
    };
    expect(buildReviewPayload(stale)).toBeNull();
    store.set(stale);
    const refused = acceptCurrentChangeSet({
      runId: run.runId,
      clientKeyHash: "review-payload-client",
      store,
    });
    expect(refused).toMatchObject({ ok: false, code: "STALE_REVIEW", status: 409 });

    const protectedPath = {
      ...run,
      changeSet: {
        ...run.changeSet,
        operations: [{ type: "create" as const, path: ".env" as never, content: "TOKEN=secret" }],
      },
    };
    expect(buildReviewPayload(protectedPath)).toBeNull();

    expect(
      toPublicRunView({ ...run, phase: "awaiting_authorization" } as RunState),
    ).not.toHaveProperty("reviewPayload");
  });
});
