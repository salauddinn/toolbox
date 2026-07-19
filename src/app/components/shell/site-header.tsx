"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/", label: "Product", match: (path: string) => path === "/" },
  { href: "/app", label: "Work console", match: (path: string) => path.startsWith("/app") },
  { href: "/#how-it-works", label: "How it works", match: () => false },
  { href: "/#contract", label: "Contract", match: () => false },
] as const;

export function SiteHeader() {
  const pathname = usePathname() || "/";

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface-paper/95 backdrop-blur">
      <div className="tb-shell-console flex min-h-12 items-center justify-between gap-3 px-4 py-1.5 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          <Link href="/" className="tb-header-brand flex shrink-0 items-center gap-2.5 rounded-sm">
            <span className="tb-mono flex h-6 w-6 items-center justify-center rounded border border-border-strong bg-surface-inset text-[10px] font-semibold text-accent-action">
              TB
            </span>
            <span className="text-[13px] font-semibold tracking-tight text-text-primary">
              ToolBox
            </span>
          </Link>
          <nav
            aria-label="Primary"
            className="tb-header-nav hidden items-center gap-1 text-[12px] text-text-secondary md:flex"
          >
            {NAV.map((item) => {
              const current = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded px-2 py-1 hover:bg-surface-inset hover:text-text-primary"
                  {...(current ? { "aria-current": "page" as const } : {})}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <span className="tb-chip hidden sm:inline-flex">public github only</span>
          <ThemeToggle />
          <Link href="/app" className="tb-btn tb-btn-primary h-8 px-3 text-[12px]">
            Open console
          </Link>
        </div>
      </div>
    </header>
  );
}
