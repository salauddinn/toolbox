"use client";

import type { ReactNode } from "react";
import {
  GUIDED_STEPS,
  guidedStepEyebrow,
  guidedStepStatusLabel,
  guidedStepStatuses,
  guidedStepTitle,
  type GuidedOutcome,
  type GuidedStepId,
} from "./guided-flow";

export type GuidedShellProps = {
  currentStep: GuidedStepId;
  outcome?: GuidedOutcome;
  /** Optional override for the main heading */
  title?: string;
  /** Optional short helper under the title */
  subtitle?: string;
  /** Right-side header actions (end run, etc.) */
  actions?: ReactNode;
  /** Sticky primary footer actions (e.g. End run on terminal outcomes) */
  footer?: ReactNode;
  children: ReactNode;
};

export function GuidedShell({
  currentStep,
  outcome = "none",
  title,
  subtitle,
  actions,
  footer,
  children,
}: GuidedShellProps) {
  const statuses = guidedStepStatuses(currentStep, outcome);
  const heading = title ?? guidedStepTitle(currentStep, outcome);

  return (
    <div className="guided-shell min-w-0 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
            ToolBox guided flow
          </p>
          <p className="text-[12px] text-muted">{guidedStepEyebrow(currentStep, outcome)}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside
          className="h-fit rounded-2xl border border-border bg-surface p-4 shadow-soft lg:sticky lg:top-20"
          aria-label="Guided steps"
        >
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Steps</p>
          <ol className="space-y-3">
            {GUIDED_STEPS.map((step) => {
              const status = statuses[step.id];
              const isCurrent =
                status === "current" || status === "stopped" || status === "rolled_back";
              const isComplete = status === "complete";
              const isBad = status === "stopped" || status === "rolled_back";
              const stepLabel =
                step.id === 4 && status === "stopped"
                  ? "Stopped"
                  : step.id === 4 && status === "rolled_back"
                    ? "Rolled back"
                    : step.label;
              return (
                <li key={step.id} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className={[
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                      isComplete
                        ? "bg-success text-white"
                        : isBad
                          ? "bg-danger text-white"
                          : isCurrent
                            ? "bg-accent text-accent-foreground"
                            : "border border-border-strong text-muted",
                    ].join(" ")}
                  >
                    {isComplete ? "✓" : isBad ? "!" : step.id}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <div
                      className={[
                        "text-[13px] font-semibold",
                        isBad
                          ? "text-danger"
                          : isCurrent
                            ? "text-accent"
                            : isComplete
                              ? "text-ink"
                              : "text-muted",
                      ].join(" ")}
                    >
                      {stepLabel}
                    </div>
                    <div
                      className={[
                        "text-[11px]",
                        isBad ? "font-medium text-danger" : "text-text-quiet",
                      ].join(" ")}
                    >
                      {guidedStepStatusLabel(status)}
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

        <main className="guided-main min-w-0 rounded-2xl border border-border bg-surface shadow-soft">
          <div className="border-b border-border px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-accent">
              {guidedStepEyebrow(currentStep, outcome)}
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
          <div className="guided-main-body min-w-0 space-y-4 px-5 py-5 sm:px-6">{children}</div>
          {footer ? (
            <div
              className="guided-main-footer sticky bottom-0 z-10 border-t border-border bg-surface/95 px-5 py-4 backdrop-blur sm:px-6"
              data-testid="guided-sticky-footer"
            >
              {footer}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
