import { NextResponse } from "next/server";
import type { RunId } from "@/core/run-state";
import { bindClientFromRequest } from "@/server/http/bound-client";
import { guardStateChangingRequest } from "@/server/http/request-guards";
import { withSessionCookie } from "@/server/http/session";
import { toPublicRunView } from "@/server/workflow/public-view";
import { authorizeAndGenerate } from "@/server/workflow/stage-runner";

type Params = { params: Promise<{ runId: string }> };

/**
 * POST /api/runs/:runId/authorize — authorize generation for the current Stage Plan.
 */
export async function POST(request: Request, { params }: Params) {
  const guard = guardStateChangingRequest(request);
  if (guard) return guard;

  // Body optional
  try {
    await request.json().catch(() => ({}));
  } catch {
    // empty body ok
  }

  const { runId } = await params;
  const bound = bindClientFromRequest(request);
  const respond = (response: NextResponse) => withSessionCookie(response, bound.setCookie);

  const result = await authorizeAndGenerate({
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

  // Do not return full file bodies — paths + byte sizes + short previews only.
  return respond(
    NextResponse.json({
      ok: true,
      run: toPublicRunView(result.run),
      diff: result.diff
        ? {
            created: result.diff.created,
            updated: result.diff.updated,
            deleted: result.diff.deleted,
            files: result.diff.files.map((f) => ({
              path: f.path,
              kind: f.kind,
              beforePreview: f.before?.slice(0, 400),
              afterPreview: f.after?.slice(0, 400),
            })),
          }
        : undefined,
      operations: result.operations
        ? {
            creates: result.operations.creates,
            updates: result.operations.updates,
            deletes: result.operations.deletes,
          }
        : undefined,
      validationReport: result.validationReport,
    }),
  );
}
