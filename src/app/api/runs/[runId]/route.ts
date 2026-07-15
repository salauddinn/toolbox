import { NextResponse } from "next/server";
import type { RunId } from "@/core/run-state";
import { clientKeyFromRequest } from "@/server/ai/client-key";
import { globalRunStore } from "@/server/run-store";
import { toPublicRunView } from "@/server/workflow/public-view";

type Params = { params: Promise<{ runId: string }> };

/**
 * GET /api/runs/:runId — public run projection bound to client key.
 */
export async function GET(request: Request, { params }: Params) {
  const { runId } = await params;
  const clientKeyHash = clientKeyFromRequest(request.headers);
  const run = globalRunStore.get(runId as RunId);
  if (!run) {
    return NextResponse.json(
      { ok: false, code: "RUN_NOT_FOUND", message: "Run not found or expired" },
      { status: 404 },
    );
  }
  if (run.clientKeyHash !== clientKeyHash) {
    return NextResponse.json(
      { ok: false, code: "RUN_FORBIDDEN", message: "Run is bound to another client" },
      { status: 403 },
    );
  }
  return NextResponse.json({ ok: true, run: toPublicRunView(run) });
}
