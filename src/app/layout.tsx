import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "./components/shell/site-footer";
import { SiteHeader } from "./components/shell/site-header";
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
        <a href="#main-content" className="tb-skip-link">
          Skip to main content
        </a>
        <div className="flex min-h-screen flex-col bg-canvas-paper text-text-primary">
          <SiteHeader />
          {children}
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
