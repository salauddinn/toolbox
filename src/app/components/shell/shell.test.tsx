// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsoleShell } from "./console-shell";
import { ProductShell } from "./product-shell";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

const pathnameMock = vi.fn(() => "/");

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
    className?: string;
    "aria-current"?: "page";
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  pathnameMock.mockReturnValue("/");
});

describe("route shells", () => {
  it("bounds product prose with a main landmark", () => {
    render(
      <ProductShell>
        <p>Product copy</p>
      </ProductShell>,
    );

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main.className).toContain("tb-shell-product");
    expect(within(main).getByText("Product copy")).toBeInTheDocument();
  });

  it("gives the work console a wider shell with a main landmark", () => {
    render(
      <ConsoleShell>
        <p>Console work area</p>
      </ConsoleShell>,
    );

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main.className).toContain("tb-shell-console");
    expect(within(main).getByText("Console work area")).toBeInTheDocument();
  });

  it("marks the active primary nav item for product and console routes", () => {
    pathnameMock.mockReturnValue("/");
    const { rerender } = render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Product" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Work console" })).not.toHaveAttribute("aria-current");

    pathnameMock.mockReturnValue("/app");
    rerender(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Work console" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Product" })).not.toHaveAttribute("aria-current");
  });

  it("exposes console entry from the shared header and disclosure footer", () => {
    render(
      <>
        <SiteHeader />
        <SiteFooter />
      </>,
    );

    expect(screen.getByRole("link", { name: "Open console" })).toHaveAttribute("href", "/app");
    expect(screen.getByText(/Secrets stay server-side/i)).toBeInTheDocument();
  });

  it("places an accessible theme toggle in the shared header", () => {
    render(<SiteHeader />);

    const toggle = screen.getByTestId("theme-toggle");
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle).toHaveAttribute("type", "button");
    expect(toggle).toHaveAccessibleName(/dark mode|light mode/i);
    expect(toggle).toHaveAttribute("aria-pressed");
  });
});
