"use client";

type Evidence = {
  ruleId: string;
  message: string;
  severity: string;
  file: string;
  line: number;
  snippet: string;
};

type CandidateRoute = {
  method: string;
  path: string;
  file: string;
  line: number;
  mountPrefix?: string;
};

type DecisionCandidate = {
  id: string;
  name: string;
  technicalScore: number;
  confidence: number;
  routes: readonly CandidateRoute[];
  primaryModel?: {
    modelName: string;
    collectionName?: string;
    file: string;
    line: number;
  };
  files?: readonly string[];
  signals: readonly Evidence[];
  conflictingEvidence: readonly Evidence[];
};

type FailedReadinessRule = {
  ruleId: string;
  summary: string;
  evidence?: readonly Evidence[];
};

type DecisionReadiness = {
  ready: boolean;
  failedRules?: readonly FailedReadinessRule[];
};

export type AssessmentDecisionProps = {
  sourceLabel: string;
  entryPath: string;
  routeCount: number;
  modelCount: number;
  cycleCount: number;
  candidates: readonly DecisionCandidate[];
  readinessByCandidateId: Readonly<Record<string, DecisionReadiness | undefined>>;
  safestTechnicalCandidateId?: string;
  pickedCandidateId: string | null;
  onPickCandidate: (candidateId: string) => void;
  /** When false, radios remain usable for inspection but confirmation is hidden. */
  allowConfirmation: boolean;
  canConfirm: boolean;
  busy: boolean;
  onConfirm: () => void;
  onFile?: (file: string) => void;
};

function routeLabel(route: CandidateRoute): string {
  const mount = route.mountPrefix ?? "";
  return `${route.method.toUpperCase()} ${mount}${route.path}`;
}

function CompactEvidenceList({
  items,
  emptyLabel,
  onFile,
}: {
  items: readonly Evidence[];
  emptyLabel: string;
  onFile?: (file: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-[12px] text-text-quiet">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={`${item.ruleId}-${item.file}-${item.line}-${index}`}
          className="rounded-md border border-border-subtle bg-surface-inset/50 px-2.5 py-2"
        >
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
              {item.severity}
            </span>
            <span className="tb-mono text-[11px] text-text-quiet">{item.ruleId}</span>
          </div>
          {item.file ? (
            <button
              type="button"
              className="mt-1 tb-mono text-[12px] text-accent hover:underline"
              onClick={() => onFile?.(item.file)}
            >
              {item.file}:{item.line}
            </button>
          ) : null}
          <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">{item.message}</p>
        </li>
      ))}
    </ul>
  );
}

function readinessLabel(ready: boolean | undefined): string {
  if (ready === true) return "Ready";
  if (ready === false) return "Not ready";
  return "Unknown";
}

export function AssessmentDecision({
  sourceLabel,
  entryPath,
  routeCount,
  modelCount,
  cycleCount,
  candidates,
  readinessByCandidateId,
  safestTechnicalCandidateId,
  pickedCandidateId,
  onPickCandidate,
  allowConfirmation,
  canConfirm,
  busy,
  onConfirm,
  onFile,
}: AssessmentDecisionProps) {
  const selected = candidates.find((candidate) => candidate.id === pickedCandidateId) ?? null;
  const selectedReadiness = selected ? readinessByCandidateId[selected.id] : undefined;
  const selectedReady = selectedReadiness?.ready === true;
  const selectedBlockers = selectedReadiness?.ready ? [] : (selectedReadiness?.failedRules ?? []);
  const radioName = "domain-candidate";

  return (
    <div className="min-w-0 space-y-5">
      <section aria-labelledby="assessment-facts-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
              modernization assessment
            </p>
            <h2 id="assessment-facts-heading" className="text-[15px] font-semibold text-ink">
              Assessment facts
            </h2>
          </div>
          <span className="tb-chip">deterministic</span>
        </div>
        <p className="max-w-3xl text-[13px] leading-relaxed text-text-secondary">
          Technical ranking is advisory only. It is not a business-priority order. Scan candidates
          below, inspect one detail pane, then confirm a ready Domain Candidate separately.
        </p>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg border border-border-subtle bg-surface-inset/40 p-3">
            <dt className="text-[11px] text-text-quiet">Source</dt>
            <dd
              className="mt-1 truncate text-[13px] font-medium text-text-primary"
              title={sourceLabel}
            >
              {sourceLabel}
            </dd>
          </div>
          <div className="rounded-lg border border-border-subtle bg-surface-inset/40 p-3">
            <dt className="text-[11px] text-text-quiet">Entry</dt>
            <dd className="mt-1 truncate font-mono text-[12px] text-text-primary" title={entryPath}>
              {entryPath}
            </dd>
          </div>
          <div className="rounded-lg border border-border-subtle bg-surface-inset/40 p-3">
            <dt className="text-[11px] text-text-quiet">Routes</dt>
            <dd className="mt-1 text-[13px] font-medium text-text-primary">{routeCount}</dd>
          </div>
          <div className="rounded-lg border border-border-subtle bg-surface-inset/40 p-3">
            <dt className="text-[11px] text-text-quiet">Models</dt>
            <dd className="mt-1 text-[13px] font-medium text-text-primary">{modelCount}</dd>
          </div>
          <div className="rounded-lg border border-border-subtle bg-surface-inset/40 p-3">
            <dt className="text-[11px] text-text-quiet">Entry-reachable cycles</dt>
            <dd className="mt-1 text-[13px] font-medium text-text-primary">{cycleCount}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="candidate-decision-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 id="candidate-decision-heading" className="text-[14px] font-semibold text-ink">
              Domain Candidate decision
            </h3>
            <p className="mt-1 text-[12px] text-text-secondary">
              No candidate is preselected. The safest technical candidate is annotated only as an
              advisory start, never as business priority.
            </p>
          </div>
          <span className="tb-chip">up to 3</span>
        </div>

        {candidates.length === 0 ? (
          <p className="rounded-lg border border-border-subtle bg-surface-inset/50 px-3 py-3 text-[13px] text-text-secondary">
            No Domain Candidates were ranked for this assessment.
          </p>
        ) : (
          <div
            role="radiogroup"
            aria-labelledby="candidate-decision-heading"
            className="overflow-x-auto rounded-lg border border-border-subtle"
          >
            <table className="min-w-full border-collapse text-left text-[12px]">
              <thead className="bg-surface-inset/70 text-text-quiet">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Select
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Candidate
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Technical score
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Evidence strength
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Readiness
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Primary model
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Blockers
                  </th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => {
                  const readiness = readinessByCandidateId[candidate.id];
                  const ready = readiness?.ready === true;
                  const blockers = ready ? 0 : (readiness?.failedRules?.length ?? 0);
                  const safest = safestTechnicalCandidateId === candidate.id;
                  const checked = pickedCandidateId === candidate.id;
                  const inputId = `candidate-radio-${candidate.id}`;
                  const labelParts = [
                    candidate.name,
                    `technical score ${candidate.technicalScore.toFixed(2)}`,
                    `evidence strength ${candidate.confidence.toFixed(2)}`,
                    readinessLabel(readiness?.ready),
                    blockers === 1 ? "1 blocker" : `${blockers} blockers`,
                  ];
                  if (safest) {
                    labelParts.push("safest technical candidate, advisory only");
                  }

                  return (
                    <tr
                      key={candidate.id}
                      className={`border-t border-border-subtle ${
                        checked ? "bg-accent-soft/40" : "bg-surface-paper"
                      } ${safest ? "shadow-[inset_3px_0_0_0_var(--accent-action)]" : ""}`}
                    >
                      <td className="px-3 py-2.5 align-middle">
                        <input
                          id={inputId}
                          type="radio"
                          name={radioName}
                          value={candidate.id}
                          checked={checked}
                          onChange={() => onPickCandidate(candidate.id)}
                          className="h-4 w-4 accent-[var(--accent-action)]"
                          aria-label={labelParts.join(", ")}
                        />
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <label
                          htmlFor={inputId}
                          className="cursor-pointer font-medium text-text-primary"
                        >
                          {candidate.name}
                        </label>
                        {safest ? (
                          <p className="mt-0.5 text-[11px] text-accent">
                            Safest technical candidate (advisory)
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 align-middle tb-mono text-text-secondary">
                        {candidate.technicalScore.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 align-middle tb-mono text-text-secondary">
                        {candidate.confidence.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <span className={`tb-chip ${ready ? "tb-chip-ok" : "tb-chip-warn"}`}>
                          {readinessLabel(readiness?.ready)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-middle text-text-secondary">
                        {candidate.primaryModel?.modelName ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 align-middle tb-mono text-text-secondary">
                        {blockers}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        aria-labelledby="candidate-detail-heading"
        className="space-y-3 rounded-lg border border-border-subtle p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="candidate-detail-heading" className="text-[14px] font-semibold text-ink">
            Selected candidate detail
          </h3>
          {selected ? (
            <span className={`tb-chip ${selectedReady ? "tb-chip-ok" : "tb-chip-warn"}`}>
              {readinessLabel(selectedReadiness?.ready)}
            </span>
          ) : (
            <span className="tb-chip">none selected</span>
          )}
        </div>

        {!selected ? (
          <p className="text-[13px] leading-relaxed text-text-secondary">
            Select a Domain Candidate in the table to inspect routes, primary model, signals,
            conflicts, and readiness blockers. Confirmation stays disabled until a ready candidate
            is selected.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-[15px] font-medium text-text-primary">{selected.name}</p>
              <p className="mt-1 text-[12px] text-text-secondary">
                technical score {selected.technicalScore.toFixed(2)} · evidence strength{" "}
                {selected.confidence.toFixed(2)}
                {safestTechnicalCandidateId === selected.id
                  ? " · safest technical candidate (advisory, not business priority)"
                  : ""}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h4 className="text-[12px] font-medium text-text-primary">Routes</h4>
                {selected.routes.length === 0 ? (
                  <p className="mt-1 text-[12px] text-text-quiet">No routes attached.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {selected.routes.map((route) => (
                      <li key={`${route.method}-${route.path}-${route.file}-${route.line}`}>
                        <button
                          type="button"
                          className="tb-mono text-[12px] text-accent hover:underline"
                          onClick={() => onFile?.(route.file)}
                        >
                          {routeLabel(route)}
                        </button>
                        <span className="ml-2 tb-mono text-[11px] text-text-quiet">
                          {route.file}:{route.line}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4 className="text-[12px] font-medium text-text-primary">Primary model</h4>
                {selected.primaryModel ? (
                  <div className="mt-1 space-y-1 text-[12px] text-text-secondary">
                    <p>
                      <span className="font-medium text-text-primary">
                        {selected.primaryModel.modelName}
                      </span>{" "}
                      · collection {selected.primaryModel.collectionName ?? "—"}
                    </p>
                    <button
                      type="button"
                      className="tb-mono text-accent hover:underline"
                      onClick={() => onFile?.(selected.primaryModel!.file)}
                    >
                      {selected.primaryModel.file}:{selected.primaryModel.line}
                    </button>
                  </div>
                ) : (
                  <p className="mt-1 text-[12px] text-text-quiet">No primary model attached.</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h4 className="mb-1 text-[12px] font-medium text-text-primary">
                  Signals ({selected.signals.length})
                </h4>
                <CompactEvidenceList
                  items={selected.signals}
                  emptyLabel="No supporting signals."
                  onFile={onFile}
                />
              </div>
              <div>
                <h4 className="mb-1 text-[12px] font-medium text-text-primary">
                  Conflicting evidence ({selected.conflictingEvidence.length})
                </h4>
                <CompactEvidenceList
                  items={selected.conflictingEvidence}
                  emptyLabel="No conflicting evidence."
                  onFile={onFile}
                />
              </div>
            </div>

            <div>
              <h4 className="mb-1 text-[12px] font-medium text-text-primary">
                Readiness blockers ({selectedBlockers.length})
              </h4>
              {selectedBlockers.length === 0 ? (
                <p className="text-[12px] text-text-quiet">
                  {selectedReady
                    ? "No failed readiness rules for this candidate."
                    : "No blocker details were returned."}
                </p>
              ) : (
                <ul className="space-y-2">
                  {selectedBlockers.map((rule) => (
                    <li
                      key={rule.ruleId}
                      className="rounded-md border border-border-subtle bg-surface-inset/50 px-2.5 py-2 text-[12px]"
                    >
                      <p className="tb-mono text-[11px] text-danger">{rule.ruleId}</p>
                      <p className="mt-1 text-text-secondary">{rule.summary}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {allowConfirmation ? (
          <div className="space-y-2 border-t border-border-subtle pt-4">
            <p className="text-[12px] text-text-secondary">
              Selection and confirmation are separate. Confirm only after reviewing a ready
              candidate. Not-ready candidates can be inspected but cannot enter transformation.
            </p>
            <button
              type="button"
              disabled={busy || !canConfirm}
              onClick={onConfirm}
              className="tb-btn tb-btn-primary"
              aria-disabled={busy || !canConfirm}
            >
              Confirm Domain Candidate
            </button>
            {!canConfirm ? (
              <p className="text-[12px] text-text-quiet" role="status">
                {!pickedCandidateId
                  ? "Select a ready Domain Candidate before confirming."
                  : !selectedReady
                    ? "The selected candidate is not ready and cannot be confirmed."
                    : "Confirmation is unavailable in the current state."}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="border-t border-border-subtle pt-4 text-[12px] text-text-secondary">
            Assessment-only result: no Domain Candidate may be confirmed for transformation.
          </p>
        )}
      </section>
    </div>
  );
}
