export const THEME_STORAGE_KEY = "toolbox-theme";

export type Theme = "light" | "dark";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/** Read a persisted theme. Returns null when missing, invalid, or storage is unavailable. */
export function readStoredTheme(): Theme | null {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Persist theme choice. Swallows quota/security errors so UI still updates. */
export function writeStoredTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode / blocked storage — in-memory document attribute still applies.
  }
}

/** Apply theme to the document root. Does not read system prefers-color-scheme. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  writeStoredTheme(theme);
}

export function resolveDocumentTheme(): Theme {
  // The server always emits a deterministic light attribute. A persisted
  // explicit preference must take precedence after hydration.
  return (
    readStoredTheme() ??
    (isTheme(document.documentElement.getAttribute("data-theme"))
      ? (document.documentElement.getAttribute("data-theme") as Theme)
      : "light")
  );
}

/**
 * Inline boot script: restore user theme before paint.
 * Explicit storage only — never follows prefers-color-scheme.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(
  THEME_STORAGE_KEY,
)};var t=localStorage.getItem(k);if(t==="dark"||t==="light"){var r=document.documentElement;r.setAttribute("data-theme",t);r.style.colorScheme=t;}}catch(e){}})();`;
