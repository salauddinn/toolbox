import type { ReactNode } from "react";
import { ConsoleShell } from "../components/shell/console-shell";

export default function WorkConsoleLayout({ children }: { children: ReactNode }) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
