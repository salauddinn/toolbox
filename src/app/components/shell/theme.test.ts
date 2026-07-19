// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  THEME_BOOT_SCRIPT,
  THEME_STORAGE_KEY,
  applyTheme,
  isTheme,
  readStoredTheme,
  resolveDocumentTheme,
  writeStoredTheme,
} from "./theme";

describe("theme helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
  });

  it("accepts only explicit light/dark values", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("system")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });

  it("persists and reads the user theme from localStorage", () => {
    expect(readStoredTheme()).toBeNull();
    writeStoredTheme("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(readStoredTheme()).toBe("dark");
  });

  it("applies data-theme and color-scheme without reading prefers-color-scheme", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(readStoredTheme()).toBe("dark");

    applyTheme("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("prefers stored explicit theme over the server document attribute", () => {
    expect(resolveDocumentTheme()).toBe("light");
    writeStoredTheme("dark");
    expect(resolveDocumentTheme()).toBe("dark");
    document.documentElement.setAttribute("data-theme", "light");
    expect(resolveDocumentTheme()).toBe("dark");
  });

  it("boot script only restores explicit stored light/dark values", () => {
    expect(THEME_BOOT_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(THEME_BOOT_SCRIPT).toContain('t==="dark"||t==="light"');
    expect(THEME_BOOT_SCRIPT).not.toContain("prefers-color-scheme");
    expect(THEME_BOOT_SCRIPT).not.toContain("matchMedia");
  });
});
