import Script from "next/script";
import { THEME_BOOT_SCRIPT } from "./theme";

/**
 * Restores data-theme before hydration. Root-layout beforeInteractive only.
 * Explicit storage values — never prefers-color-scheme.
 */
export function ThemeBootScript() {
  return (
    <Script id="toolbox-theme-boot" strategy="beforeInteractive">
      {THEME_BOOT_SCRIPT}
    </Script>
  );
}
