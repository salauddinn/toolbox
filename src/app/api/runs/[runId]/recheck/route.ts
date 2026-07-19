import { NextResponse } from "next/server";
import type { RunId } from "@/core/run-state";
import { bindClientFromRequest } from "@/server/http/bound-client";
import { guardStateChangingRequest } from "@/server/http/request-guards";
import { withSessionCookie } from "@/server/http/session";
import { toPublicRunView } from "@/server/workflow/public-view";
import { recheckRolledBackConditionalStage } from "@/server/workflow/stage-runner";

type Params = { params: Promise<{ runId: string }> };

/** POST /api/runs/:runId/recheck — deterministic re-check of a failed conditional stage. */
export async function POST(request: Request, { params }: Params) {
  const guard = guardStateChangingRequest(request);
  if (guard) return guard;
  const { runId } = await params;
  const bound = bindClientFromRequest(request);
  const result = recheckRolledBackConditionalStage({
    runId: runId as RunId,
    clientKeyHash: bound.clientKeyHash,
  });
  const response = result.ok
    ? NextResponse.json({ ok: true, run: toPublicRunView(result.run) })
    : NextResponse.json(
        {
          ok: false,
          code: result.code,
          message: result.message,
          run: result.run ? toPublicRunView(result.run) : undefined,
        },
        { status: result.status },
      );
  return withSessionCookie(response, bound.setCookie);
}
