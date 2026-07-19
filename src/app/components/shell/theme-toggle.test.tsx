// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY } from "./theme";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "light";
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
  });

  it("exposes an accessible pressed state and toggles document theme", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const toggle = await screen.findByTestId("theme-toggle");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAccessibleName(/switch to dark mode/i);

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveAccessibleName(/switch to light mode/i);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("restores persisted dark mode on mount without following system scheme", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.style.colorScheme = "dark";

    render(<ThemeToggle />);

    const toggle = await screen.findByTestId("theme-toggle");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveAttribute("data-theme-state", "dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("is keyboard activatable", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const toggle = await screen.findByTestId("theme-toggle");
    toggle.focus();
    expect(toggle).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    await user.keyboard(" ");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
