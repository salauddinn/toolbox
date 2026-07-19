"use client";

import { useCallback, useEffect, useState } from "react";
import { applyTheme, resolveDocumentTheme, type Theme } from "./theme";

/**
 * Explicit appearance control. Default is light paper; dark is user-opted only.
 * Hydration-safe: stable control chrome until client reads the document attribute
 * set by the blocking boot script (no system scheme auto-inversion).
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const resolved = resolveDocumentTheme();
    setTheme(resolved);
    // Ensure attribute + color-scheme match resolved value after mount.
    applyTheme(resolved);
    setReady(true);
  }, []);

  const onToggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }, []);

  const dark = theme === "dark";
  const actionLabel = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      className="tb-theme-toggle tb-btn tb-btn-ghost h-8 min-w-8 px-2.5 text-[12px]"
      onClick={onToggle}
      aria-label={actionLabel}
      aria-pressed={dark}
      title={actionLabel}
      data-testid="theme-toggle"
      data-theme-ready={ready ? "true" : "false"}
      data-theme-state={theme}
    >
      <span className="tb-mono text-[11px] font-medium tracking-wide" aria-hidden="true">
        {dark ? "Light" : "Dark"}
      </span>
    </button>
  );
}
