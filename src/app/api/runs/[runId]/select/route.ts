import { NextResponse } from "next/server";
import type { RunId } from "@/core/run-state";
import { bindClientFromRequest } from "@/server/http/bound-client";
import { guardStateChangingRequest } from "@/server/http/request-guards";
import { withSessionCookie } from "@/server/http/session";
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

  const bound = bindClientFromRequest(request);
  const respond = (response: NextResponse) => withSessionCookie(response, bound.setCookie);

  // Intent is untrusted developer context only — never stage instructions.
  const intent =
    typeof body.modernizationIntent === "string"
      ? body.modernizationIntent
          .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
          .slice(0, 500)
      : undefined;

  const result = selectDomainCandidate({
    runId: runId as RunId,
    candidateId: body.candidateId,
    modernizationIntent: intent,
    clientKeyHash: bound.clientKeyHash,
  });

  if (!result.ok) {
    return respond(
      NextResponse.json(
        { ok: false, code: result.code, message: result.message },
        { status: result.status },
      ),
    );
  }

  return respond(NextResponse.json({ ok: true, run: toPublicRunView(result.run) }));
}
