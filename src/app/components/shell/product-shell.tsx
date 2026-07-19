import type { ReactNode } from "react";

/**
 * Marketing / product prose shell — comfortably bounded reading width.
 */
export function ProductShell({ children }: { children: ReactNode }) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="tb-shell-product flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8"
    >
      {children}
    </main>
  );
}
