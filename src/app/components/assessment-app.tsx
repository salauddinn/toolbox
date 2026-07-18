"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { DependencyGraph, type GraphPayload } from "./dependency-graph";

const SUPPORTED_CONTRACT = [
  "Public GitHub repository that passes Safety Screening",
  "Single-root npm project with package.json",
  "JavaScript CommonJS (no type: module)",
  "Express.js and Mongoose declared dependencies",
  "Recognizable entry (app.js, server.js, or index.js)",
  "At least one route and one Mongoose model",
  "Existing CommonJS Jest/Supertest harness via npm test for transformation",
  "At most 150 analyzed source files and 2 MB analyzed source",
] as const;

type Evidence = {
  ruleId: string;
  message: string;
  severity: string;
  file: string;
  line: number;
  snippet: string;
};

type PublicCandidate = {
  id: string;
  name: string;
  technicalScore: number;
  confidence: number;
  routes: readonly {
    method: string;
    path: string;
    file: string;
    line: number;
    mountPrefix?: string;
  }[];
  primaryModel?: {
    modelName: string;
    collectionName?: string;
    file: string;
    line: number;
  };
  files: readonly string[];
  signals: readonly Evidence[];
  conflictingEvidence: readonly Evidence[];
};

type PublicReadiness = {
  ready: boolean;
  candidateId: string;
  rules: readonly {
    ruleId: string;
    passed: boolean;
    summary: string;
    evidence: readonly Evidence[];
  }[];
  failedRules?: readonly {
    ruleId: string;
    passed: false;
    summary: string;
    evidence: readonly Evidence[];
  }[];
};

type PublicStage = {
  id: string;
  kind: string;
  title: string;
  purpose: string;
  conditional: boolean;
  evidence: readonly Evidence[];
  expectedFiles: readonly string[];
  validationCriteria: readonly {
    id: string;
    description: string;
    kind: string;
  }[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunView = Record<string, any> & {
  runId: string;
  phase: string;
};

async function postJson(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

function EvidenceList({
  items,
  onFile,
}: {
  items: readonly Evidence[];
  onFile?: (f: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-muted">No evidence attached.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((e, i) => (
        <li
          key={`${e.ruleId}-${e.file}-${e.line}-${i}`}
          className="rounded-md border border-border bg-background p-2 text-xs"
        >
          <button
            type="button"
            className="font-mono text-accent hover:underline"
            onClick={() => onFile?.(e.file)}
          >
            {e.file}:{e.line}
          </button>
          <p className="mt-1 text-foreground">{e.message}</p>
          {e.snippet ? (
            <pre className="mt-1 overflow-x-auto rounded bg-surface p-2 text-[11px] text-muted">
              {e.snippet}
            </pre>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function AssessmentApp() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<RunView | null>(null);
  const [selectedEvidenceFile, setSelectedEvidenceFile] = useState<string | null>(null);
  const [intent, setIntent] = useState("");
  const [pickedCandidateId, setPickedCandidateId] = useState<string | null>(null);
  const [pendingDiff, setPendingDiff] = useState<{
    created: number;
    updated: number;
    deleted: number;
    files: { path: string; kind: string; beforePreview?: string; afterPreview?: string }[];
  } | null>(null);

  const startFixture = useCallback(async () => {
    setBusy(true);
    setError(null);
    setSelectedEvidenceFile(null);
    try {
      const result = await postJson("/api/runs", {
        source: "fixture",
        fixtureId: "controlled-example",
      });
      const data = result.data as { ok?: boolean; run?: RunView; message?: string; code?: string };
      if (!result.ok || !data.ok || !data.run) {
        setError(data.message ?? data.code ?? `Request failed (${result.status})`);
        setRun(null);
        return;
      }
      setRun(data.run);
      setPendingDiff(null);
      setPickedCandidateId(data.run.ranking?.safestTechnicalCandidateId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const startGithub = useCallback(async () => {
    setBusy(true);
    setError(null);
    setSelectedEvidenceFile(null);
    setPendingDiff(null);
    try {
      const result = await postJson("/api/runs", {
        source: "github",
        url: url.trim(),
      });
      const data = result.data as { ok?: boolean; run?: RunView; message?: string; code?: string };
      if (!result.ok || !data.ok || !data.run) {
        setError(data.message ?? data.code ?? `Request failed (${result.status})`);
        setRun(null);
        return;
      }
      setRun(data.run);
      setPickedCandidateId(data.run.ranking?.safestTechnicalCandidateId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [url]);

  const confirmSelection = useCallback(async () => {
    if (!run || !pickedCandidateId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await postJson(`/api/runs/${run.runId}/select`, {
        candidateId: pickedCandidateId,
        modernizationIntent: intent.trim() || undefined,
      });
      const data = result.data as { ok?: boolean; run?: RunView; message?: string; code?: string };
      if (!result.ok || !data.ok || !data.run) {
        setError(data.message ?? data.code ?? `Request failed (${result.status})`);
        return;
      }
      setRun(data.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [run, pickedCandidateId, intent]);

  const authorizeStage = useCallback(async () => {
    if (!run) return;
    setBusy(true);
    setError(null);
    try {
      const result = await postJson(`/api/runs/${run.runId}/authorize`, {});
      const data = result.data as {
        ok?: boolean;
        run?: RunView;
        message?: string;
        code?: string;
        diff?: {
          created: number;
          updated: number;
          deleted: number;
          files: {
            path: string;
            kind: string;
            beforePreview?: string;
            afterPreview?: string;
          }[];
        };
        validationReport?: unknown;
      };
      if (!result.ok || !data.ok || !data.run) {
        if (data.run) setRun(data.run);
        setError(data.message ?? data.code ?? `Request failed (${result.status})`);
        return;
      }
      setRun(data.run);
      setPendingDiff(data.diff ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [run]);

  const acceptStage = useCallback(async () => {
    if (!run) return;
    setBusy(true);
    setError(null);
    try {
      const result = await postJson(`/api/runs/${run.runId}/accept`, {});
      const data = result.data as { ok?: boolean; run?: RunView; message?: string; code?: string };
      if (!result.ok || !data.ok || !data.run) {
        setError(data.message ?? data.code ?? `Request failed (${result.status})`);
        return;
      }
      setRun(data.run);
      setPendingDiff(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [run]);

  const rejectStage = useCallback(async () => {
    if (!run) return;
    setBusy(true);
    setError(null);
    try {
      const result = await postJson(`/api/runs/${run.runId}/reject`, {});
      const data = result.data as { ok?: boolean; run?: RunView; message?: string; code?: string };
      if (!result.ok || !data.ok || !data.run) {
        setError(data.message ?? data.code ?? `Request failed (${result.status})`);
        return;
      }
      setRun(data.run);
      setPendingDiff(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [run]);

  const graph: GraphPayload | null = useMemo(() => {
    if (!run?.analysis?.graph) return null;
    return run.analysis.graph as GraphPayload;
  }, [run]);

  const candidates: PublicCandidate[] = run?.ranking?.candidates ?? [];
  const readinessMap: Record<string, PublicReadiness> = run?.readinessByCandidateId ?? {};

  return (
    <div className="space-y-4">
      <section className="tb-panel overflow-hidden">
        <div className="tb-panel-head">
          <div className="min-w-0">
            <p className="tb-mono text-[10px] uppercase tracking-wide text-muted">work console</p>
            <h1 className="truncate text-[14px] font-semibold text-ink">
              {run ? "Modernization Assessment" : "Start assessment"}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {run ? (
              <>
                <span className="tb-chip tb-chip-accent">phase: {run.phase}</span>
                <span className="tb-chip">run: {run.runId.slice(0, 10)}…</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setRun(null);
                    setPendingDiff(null);
                    setError(null);
                    setSelectedEvidenceFile(null);
                  }}
                  className="tb-btn tb-btn-secondary h-8 px-2.5 text-[12px]"
                >
                  New
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void startFixture()}
                  className="tb-btn tb-btn-primary h-8 px-2.5 text-[12px]"
                >
                  Retry example
                </button>
              </>
            ) : (
              <>
                <span className="tb-chip">no active run</span>
                <Link href="/" className="tb-btn tb-btn-ghost h-8 px-2.5 text-[12px]">
                  Product page
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {!run ? (
        <section className="tb-panel overflow-hidden">
          <div className="tb-panel-head">
            <p className="tb-mono text-[11px] font-medium text-ink">new run</p>
            <span className="tb-mono text-[10px] text-muted">POST /api/runs</span>
          </div>
          <div className="space-y-4 p-5">
            <p className="max-w-2xl text-[13px] leading-relaxed text-muted">
              Deterministic checks build the assessment before any AI call. After you confirm a
              Domain Candidate, AI generates only within the approved Stage Plan and static
              validation checks every proposed change.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={busy}
                onClick={() => void startFixture()}
                className="tb-btn tb-btn-primary sm:shrink-0"
              >
                {busy ? "Running…" : "Try controlled example"}
              </button>
              <div className="flex min-w-0 flex-1 gap-2">
                <label className="sr-only" htmlFor="github-url">
                  Public GitHub repository URL
                </label>
                <input
                  id="github-url"
                  name="github-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={busy}
                  placeholder="https://github.com/owner/repo"
                  className="tb-input tb-mono"
                />
                <button
                  type="button"
                  disabled={busy || url.trim().length === 0}
                  onClick={() => void startGithub()}
                  className="tb-btn tb-btn-secondary shrink-0"
                >
                  Assess
                </button>
              </div>
            </div>
            {error ? (
              <p
                className="rounded border border-danger/25 bg-danger/8 px-2.5 py-2 text-[12px] text-danger"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            {busy ? (
              <p className="tb-mono text-[11px] text-muted" aria-live="polite">
                load → safety → eligibility → analyze → rank…
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {run && error ? (
        <p
          className="rounded-md border border-danger/25 bg-danger/8 px-3 py-2.5 text-[13px] text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {run && busy ? (
        <p className="tb-mono text-[11px] text-muted" aria-live="polite">
          working…
        </p>
      ) : null}

      <section className="tb-panel overflow-hidden">
        <div className="tb-panel-head">
          <p className="tb-mono text-[11px] font-medium text-ink">supported contract</p>
        </div>
        <ul className="grid gap-0 sm:grid-cols-2">
          {SUPPORTED_CONTRACT.map((item, i) => (
            <li
              key={item}
              className="flex gap-2 border-b border-border px-3.5 py-2 text-[12px] text-muted last:border-b-0 sm:odd:border-r"
            >
              <span className="tb-mono text-[10px] text-muted-soft">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {run ? (
        <section className="tb-panel space-y-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-ink">Assessment detail</h2>
            <p className="tb-mono text-[11px] text-muted">phase={run.phase}</p>
          </div>

          {run.phase === "eligibility_failed" ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                Repository is not eligible
              </p>
              <ul className="space-y-2 text-sm">
                {(run.eligibility?.rejections ?? []).map(
                  (r: { code: string; message: string; evidence?: Evidence[] }, i: number) => (
                    <li key={`${r.code}-${i}`} className="rounded-md border border-border p-3">
                      <p className="font-mono text-xs text-muted">{r.code}</p>
                      <p>{r.message}</p>
                      {r.evidence ? (
                        <div className="mt-2">
                          <EvidenceList items={r.evidence} onFile={setSelectedEvidenceFile} />
                        </div>
                      ) : null}
                    </li>
                  ),
                )}
              </ul>
            </div>
          ) : null}

          {run.phase === "safety_failed" ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                Safety Screening rejected this repository
              </p>
              <p className="text-xs text-muted">
                Passing Safety Screening is not malware certification.
              </p>
              <ul className="space-y-2 text-sm">
                {(run.safety?.rejections ?? []).map(
                  (r: { code: string; message: string; evidence?: Evidence[] }, i: number) => (
                    <li key={`${r.code}-${i}`} className="rounded-md border border-border p-3">
                      <p className="font-mono text-xs text-muted">{r.code}</p>
                      <p>{r.message}</p>
                      {r.evidence ? (
                        <div className="mt-2">
                          <EvidenceList items={r.evidence} onFile={setSelectedEvidenceFile} />
                        </div>
                      ) : null}
                    </li>
                  ),
                )}
              </ul>
            </div>
          ) : null}

          {run.phase === "assessed" || run.phase === "not_ready" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted">Source</p>
                  <p className="truncate text-sm font-medium">{run.sourceLabel}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted">Routes / models</p>
                  <p className="text-sm font-medium">
                    {run.analysis?.routeCount ?? 0} / {run.analysis?.modelCount ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted">Entry</p>
                  <p className="font-mono text-sm">{run.analysis?.entryPath}</p>
                </div>
              </div>

              {run.phase === "not_ready" ? (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  Assessment-only: no Domain Candidate passed Transformation Readiness. Ranking is
                  technical evidence only — not business priority. AI was not called.
                </p>
              ) : (
                <p className="text-sm text-muted">
                  Up to three technical Domain Candidates. The highlighted candidate is the safest
                  technical start; it is not a business priority ranking.
                </p>
              )}

              {graph ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Entry-reachable dependency graph</h3>
                  <p className="text-xs text-muted">
                    Red animated edges are entry-reachable cycles. Click a node to focus evidence.
                  </p>
                  <DependencyGraph graph={graph} onSelectFile={setSelectedEvidenceFile} />
                </div>
              ) : null}

              {selectedEvidenceFile ? (
                <p className="text-xs text-muted">
                  Focused file:{" "}
                  <span className="font-mono text-foreground">{selectedEvidenceFile}</span>
                </p>
              ) : null}

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Domain Candidates</h3>
                {candidates.map((c) => {
                  const readiness = readinessMap[c.id];
                  const safest = run.ranking?.safestTechnicalCandidateId === c.id;
                  const selected = pickedCandidateId === c.id;
                  return (
                    <article
                      key={c.id}
                      className={`rounded-lg border p-4 ${
                        safest ? "border-accent" : "border-border"
                      } ${selected ? "ring-2 ring-accent/40" : ""}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium">
                            {c.name}{" "}
                            {safest ? (
                              <span className="ml-2 text-xs font-normal text-accent">
                                safest technical candidate
                              </span>
                            ) : null}
                          </h4>
                          <p className="text-xs text-muted">
                            technical score {c.technicalScore.toFixed(2)} · evidence strength{" "}
                            {c.confidence.toFixed(2)} · {readiness?.ready ? "ready" : "not ready"}
                          </p>
                        </div>
                        {run.phase === "assessed" && readiness?.ready ? (
                          <button
                            type="button"
                            className="rounded-md border border-border px-3 py-1 text-xs font-medium"
                            onClick={() => setPickedCandidateId(c.id)}
                          >
                            {selected ? "Selected" : "Select"}
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs font-medium">Signals</p>
                          <EvidenceList items={c.signals} onFile={setSelectedEvidenceFile} />
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-medium">Conflicting evidence</p>
                          <EvidenceList
                            items={c.conflictingEvidence}
                            onFile={setSelectedEvidenceFile}
                          />
                        </div>
                      </div>

                      {readiness && !readiness.ready ? (
                        <div className="mt-3">
                          <p className="mb-1 text-xs font-medium text-red-600 dark:text-red-400">
                            Failed readiness rules
                          </p>
                          <ul className="space-y-1 text-xs">
                            {(readiness.failedRules ?? []).map((rule) => (
                              <li key={rule.ruleId}>
                                <span className="font-mono">{rule.ruleId}</span>: {rule.summary}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {c.routes.length > 0 ? (
                        <p className="mt-2 text-xs text-muted">
                          Routes:{" "}
                          {c.routes
                            .slice(0, 6)
                            .map((r) => `${r.method.toUpperCase()} ${r.mountPrefix ?? ""}${r.path}`)
                            .join(", ")}
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </div>

              {run.phase === "assessed" ? (
                <div className="space-y-3 border-t border-border pt-4">
                  <label className="block text-sm font-medium" htmlFor="intent">
                    Modernization Intent (optional)
                  </label>
                  <textarea
                    id="intent"
                    value={intent}
                    onChange={(e) => setIntent(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Optional constraints for the selected domain (not a free-form AI prompt)"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={busy || !pickedCandidateId}
                    onClick={() => void confirmSelection()}
                    className="tb-btn tb-btn-primary"
                  >
                    Confirm Domain Candidate
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {run.phase === "awaiting_authorization" ||
          run.phase === "generating" ||
          run.phase === "validating" ||
          run.phase === "awaiting_acceptance" ||
          run.phase === "sequence_stopped" ||
          run.phase === "completed" ||
          run.phase === "stage_failed_rolled_back" ? (
            <div className="space-y-4">
              <p className="text-sm">
                Selected domain:{" "}
                <strong>{run.selectedCandidate?.name ?? run.currentStage?.title}</strong>
              </p>
              {run.phase === "sequence_stopped" ? (
                <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
                  Sequence stopped ({run.reason}). Current snapshot was kept; rejected or
                  rolled-back output did not leak forward.
                </p>
              ) : null}
              {run.phase === "completed" ? (
                <div className="space-y-3 rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm">
                  <p>
                    Modernization Sequence completed with {run.acceptedChangeSetCount} accepted
                    Change Set(s).
                  </p>
                  {run.downloadAvailable && run.downloadPath ? (
                    <a href={run.downloadPath} className="tb-btn tb-btn-primary">
                      Download result ZIP
                    </a>
                  ) : null}
                  <p className="text-xs text-muted">
                    ZIP contains repository/ (accepted snapshot only) and
                    toolbox-validation-report.json. External generated tests: not executed.
                  </p>
                </div>
              ) : null}
              {run.sequence?.pendingConditional ? (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  Pending conditional stage: {run.sequence.pendingConditional.reason}. Final
                  insertion is decided only after Domain Module acceptance.
                </p>
              ) : null}
              <ol className="space-y-3">
                {(run.sequence?.stages as PublicStage[] | undefined)?.map((stage, index) => (
                  <li
                    key={stage.id}
                    className={`rounded-lg border p-4 ${
                      index === run.stageIndex ? "border-accent" : "border-border"
                    }`}
                  >
                    <p className="text-xs text-muted">
                      Stage {index + 1}
                      {stage.conditional ? " · conditional" : ""}
                      {index === run.stageIndex ? " · current" : ""}
                    </p>
                    <h4 className="font-medium">{stage.title}</h4>
                    <p className="mt-1 text-sm text-muted">{stage.purpose}</p>
                    <p className="mt-2 text-xs font-medium">Expected files</p>
                    <ul className="font-mono text-xs text-muted">
                      {stage.expectedFiles.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs font-medium">Validation criteria</p>
                    <ul className="list-disc pl-5 text-xs text-muted">
                      {stage.validationCriteria.map((c) => (
                        <li key={c.id}>
                          [{c.kind}] {c.description}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2">
                      <p className="mb-1 text-xs font-medium">Evidence</p>
                      <EvidenceList items={stage.evidence} onFile={setSelectedEvidenceFile} />
                    </div>
                  </li>
                ))}
              </ol>

              {run.phase === "awaiting_authorization" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void authorizeStage()}
                  className="tb-btn tb-btn-primary"
                >
                  Authorize AI generation for this stage
                </button>
              ) : null}

              {run.phase === "awaiting_acceptance" ? (
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <p className="text-sm font-medium">
                    AI-generated, validated Change Set — review before acceptance
                  </p>
                  <p className="text-xs text-muted">
                    Attempt {run.changeSet?.attempt} · {run.changeSet?.operations?.length ?? 0}{" "}
                    operations · candidate files {run.candidateFileCount}
                  </p>
                  {run.validationReport?.externalTestsLabel === "not_executed" ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      External generated tests: not executed
                    </p>
                  ) : null}
                  {pendingDiff ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium">
                        Candidate snapshot diff (+{pendingDiff.created} ~{pendingDiff.updated} −
                        {pendingDiff.deleted})
                      </p>
                      <ul className="max-h-56 space-y-2 overflow-auto text-xs">
                        {pendingDiff.files.map((f) => (
                          <li
                            key={`${f.kind}-${f.path}`}
                            className="rounded border border-border p-2"
                          >
                            <p className="font-mono">
                              {f.kind} {f.path}
                            </p>
                            {f.beforePreview ? (
                              <pre className="mt-1 max-h-24 overflow-auto bg-background p-1 text-[10px] text-muted">
                                − {f.beforePreview}
                              </pre>
                            ) : null}
                            {f.afterPreview ? (
                              <pre className="mt-1 max-h-24 overflow-auto bg-background p-1 text-[10px] text-muted">
                                + {f.afterPreview}
                              </pre>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <ul className="max-h-40 overflow-auto font-mono text-xs text-muted">
                    {(run.changeSet?.operations ?? []).map(
                      (op: { type: string; path: string; bytes?: number }, i: number) => (
                        <li key={`${op.type}-${op.path}-${i}`}>
                          {op.type} {op.path}
                          {op.bytes != null ? ` (${op.bytes} B)` : ""}
                        </li>
                      ),
                    )}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void acceptStage()}
                      className="tb-btn tb-btn-primary"
                    >
                      Accept Change Set
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void rejectStage()}
                      className="tb-btn tb-btn-secondary"
                    >
                      Reject and stop
                    </button>
                  </div>
                </div>
              ) : null}

              {run.validationReport ? (
                <div className="rounded-lg border border-border p-3 text-xs">
                  <p className="font-medium">Validation Report</p>
                  <p className="text-muted">final: {run.validationReport.finalOutcome}</p>
                  <ul className="mt-2 space-y-1">
                    {(run.validationReport.attempts ?? []).map(
                      (a: {
                        attempt: number;
                        passed: boolean;
                        checks: { id: string; outcome: string; detail?: string }[];
                      }) => (
                        <li key={a.attempt}>
                          Attempt {a.attempt}: {a.passed ? "passed" : "failed"} (
                          {a.checks?.filter((c) => c.outcome === "failed").length ?? 0} failures)
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ) : null}

              <p className="text-xs text-muted">
                AI cannot change stage count, trigger outcome, or purpose. Only Change Acceptance
                promotes the candidate snapshot.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
