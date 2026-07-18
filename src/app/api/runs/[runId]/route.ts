import { NextResponse } from "next/server";
import type { RunId } from "@/core/run-state";
import { bindClientFromRequest } from "@/server/http/bound-client";
import { withSessionCookie } from "@/server/http/session";
import { globalRunStore } from "@/server/run-store";
import { toPublicRunView } from "@/server/workflow/public-view";

type Params = { params: Promise<{ runId: string }> };

/**
 * GET /api/runs/:runId — public run projection bound to client key.
 */
export async function GET(request: Request, { params }: Params) {
  const { runId } = await params;
  const bound = bindClientFromRequest(request);
  const respond = (response: NextResponse) => withSessionCookie(response, bound.setCookie);

  const existing = globalRunStore.get(runId as RunId);
  if (!existing) {
    return respond(
      NextResponse.json(
        { ok: false, code: "RUN_NOT_FOUND", message: "Run not found or expired" },
        { status: 404 },
      ),
    );
  }
  if (existing.clientKeyHash !== bound.clientKeyHash) {
    return respond(
      NextResponse.json(
        { ok: false, code: "RUN_FORBIDDEN", message: "Run is bound to another client" },
        { status: 403 },
      ),
    );
  }
  const run = globalRunStore.touch(runId as RunId) ?? existing;
  return respond(NextResponse.json({ ok: true, run: toPublicRunView(run) }));
}
