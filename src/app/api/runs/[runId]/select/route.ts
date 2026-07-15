import { NextResponse } from "next/server";
import type { RunId } from "@/core/run-state";
import { clientKeyFromRequest } from "@/server/ai/client-key";
import { guardStateChangingRequest } from "@/server/http/request-guards";
import { selectDomainCandidate } from "@/server/workflow/select";
import { toPublicRunView } from "@/server/workflow/public-view";

type Params = { params: Promise<{ runId: string }> };

/**
 * POST /api/runs/:runId/select — confirm Domain Candidate and plan sequence.
 */
export async function POST(request: Request, { params }: Params) {
  const guard = guardStateChangingRequest(request);
  if (guard) return guard;

  const { runId } = await params;
  let body: { candidateId?: string; modernizationIntent?: string };
  try {
    body = (await request.json()) as { candidateId?: string; modernizationIntent?: string };
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_JSON", message: "Request body must be JSON" },
      { status: 400 },
    );
  }

  if (typeof body.candidateId !== "string" || body.candidateId.length === 0) {
    return NextResponse.json(
      { ok: false, code: "INVALID_CANDIDATE", message: "candidateId is required" },
      { status: 400 },
    );
  }

  const clientKeyHash = clientKeyFromRequest(request.headers);
  const result = selectDomainCandidate({
    runId: runId as RunId,
    candidateId: body.candidateId,
    modernizationIntent:
      typeof body.modernizationIntent === "string" ? body.modernizationIntent : undefined,
    clientKeyHash,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, run: toPublicRunView(result.run) });
}
