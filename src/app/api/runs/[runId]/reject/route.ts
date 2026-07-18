import { NextResponse } from "next/server";
import type { RunId } from "@/core/run-state";
import { bindClientFromRequest } from "@/server/http/bound-client";
import { guardStateChangingRequest } from "@/server/http/request-guards";
import { withSessionCookie } from "@/server/http/session";
import { toPublicRunView } from "@/server/workflow/public-view";
import { rejectCurrentChangeSet } from "@/server/workflow/stage-runner";

type Params = { params: Promise<{ runId: string }> };

/**
 * POST /api/runs/:runId/reject — keep current snapshot and stop the sequence.
 */
export async function POST(request: Request, { params }: Params) {
  const guard = guardStateChangingRequest(request);
  if (guard) return guard;

  try {
    await request.json().catch(() => ({}));
  } catch {
    // empty ok
  }

  const { runId } = await params;
  const bound = bindClientFromRequest(request);
  const respond = (response: NextResponse) => withSessionCookie(response, bound.setCookie);

  const result = rejectCurrentChangeSet({
    runId: runId as RunId,
    clientKeyHash: bound.clientKeyHash,
  });

  if (!result.ok) {
    return respond(
      NextResponse.json(
        {
          ok: false,
          code: result.code,
          message: result.message,
          run: result.run ? toPublicRunView(result.run) : undefined,
        },
        { status: result.status },
      ),
    );
  }

  return respond(NextResponse.json({ ok: true, run: toPublicRunView(result.run) }));
}
