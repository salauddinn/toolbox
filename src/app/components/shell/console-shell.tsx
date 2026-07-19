import type { ReactNode } from "react";

/**
 * Work console shell — wider desktop work area for assessment UI.
 */
export function ConsoleShell({ children }: { children: ReactNode }) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="tb-shell-console flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8"
    >
      {children}
    </main>
  );
}
