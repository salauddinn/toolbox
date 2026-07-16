import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ToolBox — Evidence-backed domain modularization",
  description:
    "Analyze a supported Legacy Application, rank Domain Candidates from code evidence, and modularize one confirmed domain through bounded Change Sets you authorize.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
            <div className="mx-auto flex h-12 w-full max-w-[1120px] items-center justify-between gap-4 px-4 sm:px-6">
              <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center gap-2.5">
                  <span className="tb-mono flex h-6 w-6 items-center justify-center rounded border border-border-strong bg-surface-muted text-[10px] font-semibold text-accent">
                    TB
                  </span>
                  <span className="text-[13px] font-semibold tracking-tight text-ink">ToolBox</span>
                </Link>
                <nav className="hidden items-center gap-1 text-[12px] text-muted md:flex">
                  <Link
                    href="/"
                    className="rounded px-2 py-1 hover:bg-surface-muted hover:text-ink"
                  >
                    Product
                  </Link>
                  <Link
                    href="/app"
                    className="rounded px-2 py-1 hover:bg-surface-muted hover:text-ink"
                  >
                    Work console
                  </Link>
                  <Link
                    href="/#how-it-works"
                    className="rounded px-2 py-1 hover:bg-surface-muted hover:text-ink"
                  >
                    How it works
                  </Link>
                  <Link
                    href="/#contract"
                    className="rounded px-2 py-1 hover:bg-surface-muted hover:text-ink"
                  >
                    Contract
                  </Link>
                </nav>
              </div>
              <div className="flex items-center gap-2">
                <span className="tb-chip hidden sm:inline-flex">public github only</span>
                <Link href="/app" className="tb-btn tb-btn-primary h-8 px-3 text-[12px]">
                  Open console
                </Link>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
            {children}
          </main>

          <footer className="border-t border-border bg-surface">
            <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-1 px-4 py-4 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="tb-mono">toolbox · express domain modularization</p>
              <p>
                Selected source may be sent to the configured AI provider. Secrets stay server-side.
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
