import { NextResponse } from "next/server";
import { clientKeyFromRequest } from "@/server/ai/client-key";
import { guardStateChangingRequest } from "@/server/http/request-guards";
import { startAssessment } from "@/server/workflow/assess";
import { toPublicRunView } from "@/server/workflow/public-view";
import type { FixtureId } from "@/fixtures/load-fixture";

const FIXTURE_IDS = new Set<FixtureId>([
  "controlled-example",
  "unsupported-esm",
  "missing-mongoose",
  "path-risk",
  "no-ready-candidate",
]);

type StartBody = { source: "fixture"; fixtureId: string } | { source: "github"; url: string };

/**
 * POST /api/runs — start Modernization Assessment (no AI).
 */
export async function POST(request: Request) {
  const guard = guardStateChangingRequest(request);
  if (guard) return guard;

  let body: StartBody;
  try {
    body = (await request.json()) as StartBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_JSON", message: "Request body must be JSON" },
      { status: 400 },
    );
  }

  const clientKeyHash = clientKeyFromRequest(request.headers);

  if (body.source === "fixture") {
    if (!FIXTURE_IDS.has(body.fixtureId as FixtureId)) {
      return NextResponse.json(
        { ok: false, code: "UNKNOWN_FIXTURE", message: "Unknown fixture id" },
        { status: 400 },
      );
    }
    const result = await startAssessment({
      clientKeyHash,
      source: { type: "fixture", fixtureId: body.fixtureId as FixtureId },
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, code: result.code, message: result.message },
        { status: result.status },
      );
    }
    return NextResponse.json({ ok: true, run: toPublicRunView(result.run) });
  }

  if (body.source === "github") {
    if (typeof body.url !== "string" || body.url.trim().length === 0) {
      return NextResponse.json(
        { ok: false, code: "INVALID_URL", message: "url is required" },
        { status: 400 },
      );
    }
    const result = await startAssessment({
      clientKeyHash,
      source: { type: "github", url: body.url.trim() },
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, code: result.code, message: result.message },
        { status: result.status },
      );
    }
    return NextResponse.json({ ok: true, run: toPublicRunView(result.run) });
  }

  return NextResponse.json(
    {
      ok: false,
      code: "INVALID_SOURCE",
      message: 'source must be "fixture" or "github"',
    },
    { status: 400 },
  );
}
