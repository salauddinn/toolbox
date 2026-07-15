import { NextResponse } from "next/server";

/**
 * Liveness for the long-lived single-process host.
 * Process restarts discard active in-memory runs (ADR-0015).
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "toolbox",
    timestamp: new Date().toISOString(),
  });
}
