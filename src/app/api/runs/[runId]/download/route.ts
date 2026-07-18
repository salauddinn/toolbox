import type { RunId } from "@/core/run-state";
import { bindClientFromRequest } from "@/server/http/bound-client";
import { buildDownloadArtifact } from "@/server/workflow/download";

type Params = { params: Promise<{ runId: string }> };

/**
 * GET /api/runs/:runId/download — result ZIP (completed runs only).
 * Bound to client session+IP key; does not require JSON body.
 */
export async function GET(request: Request, { params }: Params) {
  const { runId } = await params;
  const bound = bindClientFromRequest(request);
  const result = buildDownloadArtifact({
    runId: runId as RunId,
    clientKeyHash: bound.clientKeyHash,
  });

  if (!result.ok) {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (bound.setCookie) headers.append("Set-Cookie", bound.setCookie);
    return new Response(JSON.stringify({ ok: false, code: result.code, message: result.message }), {
      status: result.status,
      headers,
    });
  }

  const { zip, filename } = result.artifact;
  // filename is already sanitized in buildResultArtifact
  const headers = new Headers({
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": String(zip.byteLength),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (bound.setCookie) headers.append("Set-Cookie", bound.setCookie);

  return new Response(new Uint8Array(zip), {
    status: 200,
    headers,
  });
}
