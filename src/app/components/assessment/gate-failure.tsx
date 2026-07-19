"use client";

import type { EvidenceRecord, InspectRequest } from "./evidence-types";
import type { Presentation } from "./presentation-state";

type GateRejection = {
  code: string;
  message: string;
  evidence?: readonly EvidenceRecord[];
};

export type GateFailureKind = "eligibility_failed" | "safety_failed" | "not_ready";

type GateFailureProps = {
  kind: GateFailureKind;
  presentation: Presentation;
  sourceLabel?: string;
  rejections?: readonly GateRejection[];
  readinessFailures?: readonly {
    candidateName: string;
    failedRules: readonly {
      ruleId: string;
      summary: string;
      evidence?: readonly EvidenceRecord[];
    }[];
  }[];
  busy: boolean;
  confirmingEnd: boolean;
  onConfirmingEndChange: (value: boolean) => void;
  onEndRun: () => void;
  onInspect?: (request: InspectRequest) => void;
};

function kindMeta(kind: GateFailureKind) {
  switch (kind) {
    case "eligibility_failed":
      return {
        eyebrow: "eligibility gate",
        nextStep:
          "Choose a different public repository that matches the supported contract, or try the controlled example.",
      };
    case "safety_failed":
      return {
        eyebrow: "safety screening",
        nextStep:
          "Safety Screening stopped this repository before analysis. Review the evidence, then end the run and try another source.",
      };
    case "not_ready":
      return {
        eyebrow: "transformation readiness",
        nextStep:
          "This assessment is available for inspection only. No Domain Candidate may enter transformation. End the run to start another source.",
      };
  }
}

function TerminalEvidence({
  title,
  items,
  onInspect,
}: {
  title: string;
  items: readonly EvidenceRecord[];
  onInspect?: (request: InspectRequest) => void;
}) {
  if (items.length === 0) {
    return <p className="tb-mono text-[11px] text-terminal-fg-muted">No evidence attached.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <li
          key={`${title}-${item.ruleId}-${item.file}-${item.line}-${index}`}
          className="min-w-0 border-t border-terminal-border pt-3 first:border-t-0 first:pt-0"
        >
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="tb-mono text-[10px] uppercase tracking-wide text-terminal-fg-muted">
              {item.severity}
            </span>
            <span className="tb-mono text-[11px] text-terminal-fg-muted">{item.ruleId}</span>
          </div>
          {item.file ? (
            <button
              type="button"
              className="mt-1 tb-mono text-[12px] text-diff-change hover:underline"
              onClick={() =>
                onInspect?.({
                  kind: "evidence",
                  items,
                  index,
                })
              }
            >
              {item.file}:{item.line}
            </button>
          ) : null}
          <p className="mt-1 text-[12px] leading-relaxed text-terminal-fg">{item.message}</p>
          {item.snippet ? (
            <pre className="mt-2 overflow-x-auto rounded border border-terminal-border bg-surface-terminal-raised p-2 tb-mono text-[11px] text-terminal-fg-muted">
              {item.snippet}
            </pre>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function GateFailure({
  kind,
  presentation,
  sourceLabel,
  rejections = [],
  readinessFailures = [],
  busy,
  confirmingEnd,
  onConfirmingEndChange,
  onEndRun,
  onInspect,
}: GateFailureProps) {
  const meta = kindMeta(kind);

  return (
    <div className="min-w-0 space-y-4" data-screen="gate-failure" data-gate={kind}>
      <section
        className="tb-panel overflow-hidden"
        role="alert"
        aria-labelledby="gate-failure-heading"
      >
        <div className="tb-panel-head">
          <div className="min-w-0">
            <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
              {meta.eyebrow}
            </p>
            <h2 id="gate-failure-heading" className="text-[14px] font-semibold text-danger">
              {presentation.heading}
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="tb-chip tb-chip-warn">stopped</span>
            <span className="tb-chip">AI not called</span>
          </div>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          <p className="text-[13px] leading-relaxed text-text-secondary">
            {presentation.explanation}
            {!/AI was not called/i.test(presentation.explanation) ? " AI was not called." : null}
          </p>
          {sourceLabel ? (
            <p className="text-[12px] text-text-quiet">
              Source: <span className="font-medium text-text-primary">{sourceLabel}</span>
            </p>
          ) : null}
          {kind === "safety_failed" ? (
            <p className="rounded-md border border-border-subtle bg-surface-inset/70 px-3 py-2 text-[12px] leading-relaxed text-text-secondary">
              Passing Safety Screening is not malware certification. It only means supported risk
              signals were not detected before analysis.
            </p>
          ) : null}
          {kind === "not_ready" ? (
            <p className="rounded-md border border-border-subtle bg-surface-inset/70 px-3 py-2 text-[12px] leading-relaxed text-text-secondary">
              Ranking below is technical evidence only — not business priority and not permission to
              authorize AI.
            </p>
          ) : null}
          <div className="rounded-md border border-border-subtle px-3 py-2">
            <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">next step</p>
            <p className="mt-1 text-[13px] text-text-secondary">{meta.nextStep}</p>
          </div>
          {confirmingEnd ? (
            <div
              className="space-y-3 rounded-md border border-border-strong bg-surface-inset/50 p-3"
              role="group"
              aria-label="Confirm end run"
            >
              <p className="text-[13px] text-text-secondary">
                End this stopped run and return to repository start? In-memory evidence for this run
                will be released.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onConfirmingEndChange(false);
                    onEndRun();
                  }}
                  className="tb-btn tb-btn-primary"
                >
                  Confirm end run
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onConfirmingEndChange(false)}
                  className="tb-btn tb-btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => onConfirmingEndChange(true)}
              className="tb-btn tb-btn-secondary"
            >
              End run / Start over
            </button>
          )}
        </div>
      </section>

      {rejections.length > 0 ? (
        <section className="tb-terminal min-w-0 overflow-hidden" aria-label="Gate failure evidence">
          <div className="flex items-center justify-between gap-3 border-b border-terminal-border bg-surface-terminal-raised px-3 py-2">
            <div className="min-w-0">
              <p className="tb-mono text-[10px] uppercase tracking-wide text-terminal-fg-muted">
                deterministic evidence
              </p>
              <p className="truncate text-[12px] font-medium text-terminal-fg">
                {kind === "safety_failed"
                  ? "Safety Screening rejections"
                  : "Eligibility rejections"}
              </p>
            </div>
            <span className="tb-mono shrink-0 rounded border border-terminal-border px-1.5 py-0.5 text-[10px] text-terminal-fg-muted">
              {rejections.length} issue{rejections.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="divide-y divide-terminal-border">
            {rejections.map((rejection, index) => (
              <li key={`${rejection.code}-${index}`} className="space-y-2 p-3 sm:p-4">
                <p className="tb-mono text-[11px] text-diff-delete">{rejection.code}</p>
                <p className="text-[13px] text-terminal-fg">{rejection.message}</p>
                <TerminalEvidence
                  title={rejection.code}
                  items={rejection.evidence ?? []}
                  onInspect={onInspect}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {readinessFailures.length > 0 ? (
        <section
          className="tb-terminal min-w-0 overflow-hidden"
          aria-label="Transformation readiness evidence"
        >
          <div className="flex items-center justify-between gap-3 border-b border-terminal-border bg-surface-terminal-raised px-3 py-2">
            <div className="min-w-0">
              <p className="tb-mono text-[10px] uppercase tracking-wide text-terminal-fg-muted">
                readiness evidence
              </p>
              <p className="truncate text-[12px] font-medium text-terminal-fg">
                Failed Transformation Readiness rules
              </p>
            </div>
          </div>
          <ul className="divide-y divide-terminal-border">
            {readinessFailures.map((entry) => (
              <li key={entry.candidateName} className="space-y-2 p-3 sm:p-4">
                <p className="text-[13px] font-medium text-terminal-fg">{entry.candidateName}</p>
                <ul className="space-y-3">
                  {entry.failedRules.map((rule) => (
                    <li key={`${entry.candidateName}-${rule.ruleId}`}>
                      <p className="tb-mono text-[11px] text-diff-change">{rule.ruleId}</p>
                      <p className="mt-1 text-[12px] text-terminal-fg">{rule.summary}</p>
                      {rule.evidence && rule.evidence.length > 0 ? (
                        <div className="mt-2">
                          <TerminalEvidence
                            title={rule.ruleId}
                            items={rule.evidence}
                            onInspect={onInspect}
                          />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
