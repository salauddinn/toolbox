"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";
import type { EvidenceInspectorState, EvidenceRecord } from "./evidence-types";

export type EvidenceInspectorProps = {
  state: EvidenceInspectorState | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
  /** Element that opened the inspector; focus returns here when still mounted. */
  triggerRef?: RefObject<HTMLElement | null>;
  /**
   * When the trigger is gone after a state transition, restore focus to this
   * stable screen heading (id selector without #, or element).
   */
  fallbackFocusId?: string;
};

function focusableElements(root: HTMLElement): HTMLElement[] {
  const nodes = root.querySelectorAll<HTMLElement>(
    [
      "a[href]",
      "button:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled]):not([type='hidden'])",
      "select:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(","),
  );
  return [...nodes].filter((el) => {
    if (el.getAttribute("aria-hidden") === "true") return false;
    const style = window.getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  });
}

function EvidenceFields({ item }: { item: EvidenceRecord }) {
  return (
    <div className="space-y-3 text-[13px]">
      <div>
        <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">Location</p>
        <p className="mt-1 break-all tb-mono text-[12px] text-text-primary">
          {item.file}
          {item.line > 0 ? `:${item.line}` : ""}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">Rule</p>
          <p className="mt-1 break-all tb-mono text-[12px] text-text-primary">{item.ruleId}</p>
        </div>
        <div>
          <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">Severity</p>
          <p className="mt-1">
            <span className="tb-chip tb-chip-warn">{item.severity}</span>
          </p>
        </div>
      </div>
      <div>
        <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">Message</p>
        <p className="mt-1 leading-relaxed text-text-secondary">{item.message}</p>
      </div>
      <div>
        <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">Snippet</p>
        <div className="mt-1">
          {item.snippet ? (
            <pre className="overflow-x-auto rounded-md border border-border-subtle bg-surface-inset/70 p-2.5 tb-mono text-[11px] leading-relaxed text-text-secondary">
              {item.snippet}
            </pre>
          ) : (
            <p className="text-[12px] text-text-quiet">No snippet attached.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function FileContextFields({
  file,
  line,
  origin,
}: {
  file: string;
  line?: number;
  origin?: string;
}) {
  return (
    <div className="space-y-3 text-[13px]">
      <p className="text-[12px] leading-relaxed text-text-secondary">
        File context only. Graph and path selections do not invent a rule, severity, message, or
        snippet.
      </p>
      <div className="space-y-3">
        <div>
          <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">File</p>
          <p className="mt-1 break-all tb-mono text-[12px] text-text-primary">{file}</p>
        </div>
        <div>
          <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">Line</p>
          <p className="mt-1 tb-mono text-[12px] text-text-primary">
            {line != null && line > 0 ? line : "Not available for this selection"}
          </p>
        </div>
        {origin ? (
          <div>
            <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">Source</p>
            <p className="mt-1 text-[12px] text-text-secondary">
              {origin === "graph"
                ? "Dependency graph"
                : origin === "route"
                  ? "Candidate route"
                  : origin === "model"
                    ? "Primary model"
                    : "Path reference"}
            </p>
          </div>
        ) : null}
      </div>
      <div
        className="rounded-md border border-dashed border-border-subtle bg-surface-inset/40 px-3 py-2"
        data-testid="file-context-no-evidence-fields"
      >
        <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
          Evidence fields
        </p>
        <p className="mt-1 text-[12px] text-text-quiet">
          Rule, severity, message, and snippet are unavailable for this selection.
        </p>
      </div>
    </div>
  );
}

export function EvidenceInspector({
  state,
  onClose,
  onNavigate,
  triggerRef,
  fallbackFocusId = "assessment-workspace-heading",
}: EvidenceInspectorProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const open = state !== null;

  const restoreFocus = useCallback(() => {
    const trigger = triggerRef?.current;
    if (trigger && document.contains(trigger)) {
      trigger.focus();
      return;
    }
    if (fallbackFocusId) {
      const fallback = document.getElementById(fallbackFocusId);
      if (fallback) {
        if (!fallback.hasAttribute("tabindex")) {
          fallback.setAttribute("tabindex", "-1");
        }
        fallback.focus();
        return;
      }
    }
  }, [fallbackFocusId, triggerRef]);

  const wasOpenRef = useRef(false);

  useLayoutEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
  }, [open, state?.mode]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      return;
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      restoreFocus();
    }
  }, [open, restoreFocus]);

  useEffect(() => {
    if (!open) return;

    function onDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", onDocumentKeyDown);
    return () => document.removeEventListener("keydown", onDocumentKeyDown);
  }, [open, onClose]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleBackdropMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  };

  const handlePanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusables = focusableElements(panelRef.current);
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey) {
      if (active === first || !panelRef.current.contains(active)) {
        event.preventDefault();
        last.focus();
      }
      return;
    }

    if (active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!state) return null;

  const evidenceItem =
    state.mode === "evidence" && state.items.length > 0
      ? state.items[Math.min(Math.max(0, state.index), state.items.length - 1)]
      : null;
  const evidenceCount = state.mode === "evidence" ? state.items.length : 0;
  const evidenceIndex =
    state.mode === "evidence"
      ? Math.min(Math.max(0, state.index), Math.max(0, evidenceCount - 1))
      : 0;
  const canPrev = state.mode === "evidence" && evidenceIndex > 0;
  const canNext = state.mode === "evidence" && evidenceIndex < evidenceCount - 1;

  const title = state.mode === "evidence" ? "Evidence inspector" : "Dependency file context";
  const description =
    state.mode === "evidence"
      ? "Full evidence detail for the current collection."
      : "Path and line context from an available selection only.";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
      data-testid="evidence-inspector-backdrop"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="tb-panel flex max-h-[min(92vh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-t-xl border border-border-strong bg-surface-paper shadow-lift sm:rounded-xl"
        onKeyDown={handlePanelKeyDown}
        data-testid="evidence-inspector"
      >
        <div className="tb-panel-head shrink-0">
          <div className="min-w-0">
            <p className="tb-mono text-[10px] uppercase tracking-wide text-muted">
              {state.mode === "evidence" ? "evidence" : "file context"}
            </p>
            <h2 id={titleId} className="truncate text-[14px] font-semibold text-ink">
              {title}
            </h2>
            <p id={descriptionId} className="sr-only">
              {description}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="tb-btn tb-btn-ghost h-8 px-2.5 text-[12px]"
            onClick={handleClose}
            data-testid="evidence-inspector-close"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {state.mode === "evidence" ? (
            evidenceItem ? (
              <EvidenceFields item={evidenceItem} />
            ) : (
              <p className="text-[13px] text-text-secondary">No evidence in this collection.</p>
            )
          ) : (
            <FileContextFields file={state.file} line={state.line} origin={state.origin} />
          )}
        </div>

        {state.mode === "evidence" && evidenceCount > 0 ? (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-4 py-3 sm:px-5">
            <p className="tb-mono text-[11px] text-text-quiet" aria-live="polite">
              {evidenceIndex + 1} of {evidenceCount}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="tb-btn tb-btn-secondary h-8 px-2.5 text-[12px]"
                disabled={!canPrev}
                onClick={() => onNavigate(evidenceIndex - 1)}
                data-testid="evidence-inspector-prev"
              >
                Previous
              </button>
              <button
                type="button"
                className="tb-btn tb-btn-secondary h-8 px-2.5 text-[12px]"
                disabled={!canNext}
                onClick={() => onNavigate(evidenceIndex + 1)}
                data-testid="evidence-inspector-next"
              >
                Next
              </button>
            </div>
          </div>
        ) : (
          <div className="shrink-0 border-t border-border-subtle px-4 py-3 sm:px-5">
            <p className="tb-mono text-[11px] text-text-quiet">
              {state.mode === "file-context"
                ? "No previous/next collection — path context only."
                : "Empty evidence collection."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
