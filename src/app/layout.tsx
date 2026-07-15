import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "ToolBox",
  description:
    "Analyze a supported Legacy Application, rank Domain Candidates, and modularize one confirmed domain through bounded Change Sets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-border bg-surface">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
              <div>
                <p className="text-lg font-semibold tracking-tight">ToolBox</p>
                <p className="text-sm text-muted">
                  Evidence-backed domain modularization for Express.js
                </p>
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</main>
          <footer className="border-t border-border py-4 text-center text-xs text-muted">
            Public GitHub repositories only. Selected source may be sent to the configured AI
            provider.
          </footer>
        </div>
      </body>
    </html>
  );
}
