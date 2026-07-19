"use client";

import { useState, type FormEvent } from "react";
import type { BlockedStart } from "./use-assessment-run";

export const SUPPORTED_CONTRACT = [
  "Public GitHub repository that passes Safety Screening",
  "Single-root npm project with package.json",
  "JavaScript CommonJS (no type: module)",
  "Express.js and Mongoose declared dependencies",
  "Recognizable entry (app.js, server.js, or index.js)",
  "At least one route and one Mongoose model",
  "Existing CommonJS Jest/Supertest harness via npm test for transformation",
  "At most 150 analyzed source files and 2 MB analyzed source",
] as const;

const CONCISE_CONSTRAINTS = [
  "Public GitHub root repository only",
  "Single-package CommonJS Express.js + Mongoose",
  "Deterministic Safety Screening and eligibility before any AI call",
  "≤150 analyzed source files and ≤2 MB analyzed source",
] as const;

type RepositoryStartProps = {
  url: string;
  onUrlChange: (url: string) => void;
  busy: boolean;
  error: string | null;
  blockedStart: BlockedStart | null;
  confirmingReplace: boolean;
  onConfirmingReplaceChange: (value: boolean) => void;
  onStartFixture: () => void;
  onStartGithub: (url: string) => void;
  onReplacePreviousRun: () => void;
  onDismissConflict: () => void;
};

export function RepositoryStart({
  url,
  onUrlChange,
  busy,
  error,
  blockedStart,
  confirmingReplace,
  onConfirmingReplaceChange,
  onStartFixture,
  onStartGithub,
  onReplacePreviousRun,
  onDismissConflict,
}: RepositoryStartProps) {
  const trimmedUrl = url.trim();
  const urlInvalid = trimmedUrl.length === 0;
  const showConflict = blockedStart !== null;
  const conflict = blockedStart;
  const attemptedLabel = !conflict
    ? "requested assessment"
    : conflict.body.source === "fixture"
      ? "controlled example"
      : conflict.body.source === "github"
        ? conflict.body.url
        : "requested assessment";

  function handleGithubSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || urlInvalid) return;
    onConfirmingReplaceChange(false);
    onStartGithub(trimmedUrl);
  }

  return (
    <div className="min-w-0 space-y-4">
      <section className="tb-panel overflow-hidden" aria-labelledby="start-overview-heading">
        <div className="tb-panel-head">
          <div className="min-w-0">
            <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
              repository start
            </p>
            <h2 id="start-overview-heading" className="text-[13px] font-semibold text-text-primary">
              Choose how to begin
            </h2>
          </div>
          <span className="tb-chip">POST /api/runs</span>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          <p className="max-w-3xl text-[13px] leading-relaxed text-text-secondary">
            Deterministic Safety Screening and eligibility run before analysis. AI is not called at
            start. Active runs stay in memory on this host and expire after 30 minutes of inactivity
            — one active run per client.
          </p>
          <aside
            className="rounded-md border border-accent-action/25 bg-accent-action/5 px-3 py-2.5"
            aria-label="Recommended demo path"
          >
            <p className="tb-mono text-[10px] uppercase tracking-wide text-accent-action">
              recommended · first safe cut
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
              For the hackathon demo, start with{" "}
              <strong className="font-medium text-text-primary">Try controlled example</strong>
              (Path A). It includes Orders, Payments, Users, and a known cycle so ranking, evidence,
              authorize, accept, and ZIP download fit a short walkthrough.
            </p>
          </aside>
          <ul className="grid gap-2 sm:grid-cols-2">
            {CONCISE_CONSTRAINTS.map((item) => (
              <li
                key={item}
                className="rounded-md border border-border-subtle bg-surface-inset/60 px-3 py-2 text-[12px] text-text-secondary"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <section
          className="tb-panel flex min-w-0 flex-col overflow-hidden"
          aria-labelledby="controlled-example-heading"
        >
          <div className="tb-panel-head">
            <div className="min-w-0">
              <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
                path a · fixture
              </p>
              <h2
                id="controlled-example-heading"
                className="text-[13px] font-semibold text-text-primary"
              >
                Controlled example
              </h2>
            </div>
            <span className="tb-chip tb-chip-accent">no GitHub required</span>
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
            <p className="text-[13px] leading-relaxed text-text-secondary">
              Run the built-in supported sample—the reliable demo path. Learn the full workflow
              (assess → evidence → authorize → accept → ZIP) without providing a repository URL.
            </p>
            <div className="mt-auto">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onConfirmingReplaceChange(false);
                  onStartFixture();
                }}
                className="tb-btn tb-btn-primary w-full sm:w-auto"
              >
                {busy && !showConflict ? "Starting…" : "Try controlled example"}
              </button>
            </div>
          </div>
        </section>

        <section
          className="tb-panel flex min-w-0 flex-col overflow-hidden"
          aria-labelledby="github-path-heading"
        >
          <div className="tb-panel-head">
            <div className="min-w-0">
              <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
                path b · public source
              </p>
              <h2 id="github-path-heading" className="text-[13px] font-semibold text-text-primary">
                Public GitHub repository
              </h2>
            </div>
            <span className="tb-chip">URL entry</span>
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
            <p className="text-[13px] leading-relaxed text-text-secondary">
              Assess a public repository root that matches the supported contract. Private repos,
              monorepos, ESM, and TypeScript sources are rejected before analysis.
            </p>
            <form className="mt-auto space-y-3" onSubmit={handleGithubSubmit} noValidate>
              <div className="space-y-1.5">
                <label
                  htmlFor="github-url"
                  className="block text-[12px] font-medium text-text-primary"
                >
                  Public GitHub repository URL
                </label>
                <input
                  id="github-url"
                  name="github-url"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  value={url}
                  onChange={(event) => onUrlChange(event.target.value)}
                  disabled={busy}
                  placeholder="https://github.com/owner/repo"
                  aria-required="true"
                  aria-invalid={error && !showConflict ? true : undefined}
                  aria-describedby={
                    error && !showConflict ? "start-error github-url-hint" : "github-url-hint"
                  }
                  className="tb-input tb-mono min-w-0"
                />
                <p id="github-url-hint" className="text-[11px] text-text-quiet">
                  Example: https://github.com/owner/repo — root package only.
                </p>
              </div>
              <button
                type="submit"
                disabled={busy || urlInvalid}
                className="tb-btn tb-btn-secondary w-full sm:w-auto"
              >
                {busy && !showConflict ? "Starting…" : "Assess"}
              </button>
            </form>
          </div>
        </section>
      </div>

      {showConflict ? (
        <section
          className="tb-panel overflow-hidden"
          aria-labelledby="active-run-conflict-heading"
          data-tone="warning"
        >
          <div className="tb-panel-head">
            <div className="min-w-0">
              <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
                active-run conflict
              </p>
              <h2
                id="active-run-conflict-heading"
                className="text-[13px] font-semibold text-text-primary"
              >
                An active run must be ended first
              </h2>
            </div>
            <span className="tb-chip tb-chip-warn">recoverable</span>
          </div>
          <div className="space-y-3 p-4 sm:p-5">
            <p className="text-[13px] leading-relaxed text-text-secondary">
              This client already has an in-memory run. End that run to start the{" "}
              <span className="font-medium text-text-primary">{attemptedLabel}</span> request.
              Failure to replace keeps the previous run and this recovery option.
            </p>
            {error && conflict ? (
              <div className="tb-terminal overflow-hidden" role="alert">
                <div className="border-b border-terminal-border px-3 py-2">
                  <p className="tb-mono text-[10px] uppercase tracking-wide text-terminal-fg-muted">
                    technical detail
                  </p>
                </div>
                <pre className="overflow-x-auto p-3 tb-mono text-[11px] leading-relaxed text-terminal-fg">
                  {error}
                  {"\n"}
                  activeRunId: {conflict.activeRunId}
                </pre>
              </div>
            ) : (
              <p className="sr-only" role="alert">
                An active run already exists
              </p>
            )}
            {confirmingReplace && conflict ? (
              <div
                className="space-y-3 rounded-md border border-border-strong bg-surface-inset/50 p-3"
                role="group"
                aria-label="Confirm replace active run"
              >
                <p className="text-[13px] text-text-secondary">
                  Confirm ending run{" "}
                  <span className="tb-mono text-text-primary">
                    {conflict.activeRunId.slice(0, 12)}…
                  </span>{" "}
                  and starting the new assessment. This cannot be undone.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      onConfirmingReplaceChange(false);
                      onReplacePreviousRun();
                    }}
                    className="tb-btn tb-btn-primary"
                  >
                    Confirm end previous run and start new
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onConfirmingReplaceChange(false)}
                    className="tb-btn tb-btn-ghost"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onConfirmingReplaceChange(true)}
                  className="tb-btn tb-btn-secondary"
                >
                  End previous run and start new
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onConfirmingReplaceChange(false);
                    onDismissConflict();
                  }}
                  className="tb-btn tb-btn-ghost"
                >
                  Keep previous run
                </button>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {error && !showConflict ? (
        <div className="tb-panel overflow-hidden" role="alert">
          <div className="tb-panel-head">
            <p className="text-[13px] font-semibold text-danger">Start did not create a run</p>
            <span className="tb-chip">not started</span>
          </div>
          <div className="tb-terminal overflow-hidden border-0 border-t border-terminal-border">
            <pre
              id="start-error"
              className="overflow-x-auto p-3 tb-mono text-[11px] leading-relaxed text-terminal-fg"
            >
              {error}
            </pre>
          </div>
        </div>
      ) : null}

      {busy ? (
        <p className="tb-mono text-[11px] text-text-quiet" aria-live="polite">
          load → safety → eligibility → analyze → rank…
        </p>
      ) : null}

      <SupportedContractDetails defaultOpen />
    </div>
  );
}

export function SupportedContractDetails({ defaultOpen }: { defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="tb-panel overflow-hidden">
      <details
        className="group"
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary className="tb-panel-head cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
              supported contract
            </p>
            <p className="text-[13px] font-semibold text-text-primary">
              Full repository requirements
            </p>
          </div>
          <span className="tb-chip group-open:tb-chip-accent">
            <span className="group-open:hidden">show</span>
            <span className="hidden group-open:inline">hide</span>
          </span>
        </summary>
        <ul className="grid gap-0 sm:grid-cols-2">
          {SUPPORTED_CONTRACT.map((item, index) => (
            <li
              key={item}
              className="flex gap-2 border-b border-border-subtle px-3.5 py-2 text-[12px] text-text-secondary last:border-b-0 sm:odd:border-r"
            >
              <span className="tb-mono text-[10px] text-text-quiet">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
