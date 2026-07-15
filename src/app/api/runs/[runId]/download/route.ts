import type { RunId } from "@/core/run-state";
import { clientKeyFromRequest } from "@/server/ai/client-key";
import { buildDownloadArtifact } from "@/server/workflow/download";

type Params = { params: Promise<{ runId: string }> };

/**
 * GET /api/runs/:runId/download — result ZIP (completed runs only).
 * Bound to client key; does not require JSON body (safe GET of completed artifact).
 */
export async function GET(request: Request, { params }: Params) {
  const { runId } = await params;
  const result = buildDownloadArtifact({
    runId: runId as RunId,
    clientKeyHash: clientKeyFromRequest(request.headers),
  });

  if (!result.ok) {
    return Response.json(
      { ok: false, code: result.code, message: result.message },
      { status: result.status },
    );
  }

  const { zip, filename } = result.artifact;
  return new Response(new Uint8Array(zip), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(zip.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
