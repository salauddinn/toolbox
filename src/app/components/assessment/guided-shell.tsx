"use client";

import type { ReactNode } from "react";
import {
  GUIDED_STEPS,
  guidedStepEyebrow,
  guidedStepStatuses,
  guidedStepTitle,
  type GuidedStepId,
} from "./guided-flow";

export type GuidedShellProps = {
  currentStep: GuidedStepId;
  /** Optional override for the main heading */
  title?: string;
  /** Optional short helper under the title */
  subtitle?: string;
  /** Right-side header actions (end run, etc.) */
  actions?: ReactNode;
  children: ReactNode;
};

export function GuidedShell({ currentStep, title, subtitle, actions, children }: GuidedShellProps) {
  const statuses = guidedStepStatuses(currentStep);
  const heading = title ?? guidedStepTitle(currentStep);

  return (
    <div className="min-w-0 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
            ToolBox guided flow
          </p>
          <p className="text-[12px] text-muted">{guidedStepEyebrow(currentStep)}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside
          className="h-fit rounded-2xl border border-border bg-surface p-4 shadow-soft"
          aria-label="Guided steps"
        >
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Steps</p>
          <ol className="space-y-3">
            {GUIDED_STEPS.map((step) => {
              const status = statuses[step.id];
              const isCurrent = status === "current";
              const isComplete = status === "complete";
              return (
                <li key={step.id} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className={[
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                      isComplete
                        ? "bg-success text-white"
                        : isCurrent
                          ? "bg-accent text-accent-foreground"
                          : "border border-border-strong text-muted",
                    ].join(" ")}
                  >
                    {isComplete ? "✓" : step.id}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <div
                      className={[
                        "text-[13px] font-semibold",
                        isCurrent ? "text-accent" : isComplete ? "text-ink" : "text-muted",
                      ].join(" ")}
                    >
                      {step.label}
                    </div>
                    <div className="text-[11px] text-text-quiet">
                      {isComplete ? "Done" : isCurrent ? "Current" : "Up next"}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-muted">
            One step at a time. You authorize generation and accept changes separately.
          </p>
        </aside>

        <main className="min-w-0 rounded-2xl border border-border bg-surface p-5 shadow-soft sm:p-6">
          <div className="mb-5 border-b border-border pb-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-accent">
              {guidedStepEyebrow(currentStep)}
            </p>
            <h1
              id="assessment-workspace-heading"
              tabIndex={-1}
              className="mt-1 text-[1.5rem] font-semibold tracking-tight text-ink outline-none sm:text-[1.65rem]"
            >
              {heading}
            </h1>
            {subtitle ? (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p>
            ) : null}
          </div>
          <div className="min-w-0 space-y-4">{children}</div>
        </main>
      </div>
    </div>
  );
}
