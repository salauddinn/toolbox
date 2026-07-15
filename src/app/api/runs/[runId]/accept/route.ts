import { NextResponse } from "next/server";
import type { RunId } from "@/core/run-state";
import { clientKeyFromRequest } from "@/server/ai/client-key";
import { guardStateChangingRequest } from "@/server/http/request-guards";
import { toPublicRunView } from "@/server/workflow/public-view";
import { acceptCurrentChangeSet } from "@/server/workflow/stage-runner";

type Params = { params: Promise<{ runId: string }> };

/**
 * POST /api/runs/:runId/accept — Change Acceptance promotes the candidate snapshot.
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
  const result = acceptCurrentChangeSet({
    runId: runId as RunId,
    clientKeyHash: clientKeyFromRequest(request.headers),
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: result.code,
        message: result.message,
        run: result.run ? toPublicRunView(result.run) : undefined,
      },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, run: toPublicRunView(result.run) });
}
