import { NextResponse } from "next/server";
import { guardStateChangingRequest } from "@/server/http/request-guards";
import { bindClientFromRequest } from "@/server/http/bound-client";
import { withSessionCookie } from "@/server/http/session";
import { startAssessment } from "@/server/workflow/assess";
import { toPublicRunView } from "@/server/workflow/public-view";
import type { FixtureId } from "@/fixtures/load-fixture";

const FIXTURE_IDS = new Set<FixtureId>([
  "controlled-example",
  "unsupported-esm",
  "missing-mongoose",
  "path-risk",
  "no-ready-candidate",
  "unsupported-syntax",
  "unsupported-package-manager",
  "ambiguous-package-manager",
]);

type StartBody =
  { source: "fixture"; fixtureId: string; demo?: boolean } | { source: "github"; url: string };

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

  const bound = bindClientFromRequest(request);
  const respond = (response: NextResponse) => withSessionCookie(response, bound.setCookie);

  if (body.source === "fixture") {
    if (!FIXTURE_IDS.has(body.fixtureId as FixtureId)) {
      return respond(
        NextResponse.json(
          { ok: false, code: "UNKNOWN_FIXTURE", message: "Unknown fixture id" },
          { status: 400 },
        ),
      );
    }
    if (body.demo === true && body.fixtureId !== "controlled-example") {
      return respond(
        NextResponse.json(
          {
            ok: false,
            code: "INVALID_DEMO_FIXTURE",
            message: "Demo mode is available only for the controlled example",
          },
          { status: 400 },
        ),
      );
    }
    const result = await startAssessment({
      clientKeyHash: bound.clientKeyHash,
      source: {
        type: "fixture",
        fixtureId: body.fixtureId as FixtureId,
        demo: body.demo === true,
      },
    });
    if (!result.ok) {
      return respond(
        NextResponse.json(
          {
            ok: false,
            code: result.code,
            message: result.message,
            activeRunId: result.activeRunId,
          },
          { status: result.status },
        ),
      );
    }
    return respond(NextResponse.json({ ok: true, run: toPublicRunView(result.run) }));
  }

  if (body.source === "github") {
    if (typeof body.url !== "string" || body.url.trim().length === 0) {
      return respond(
        NextResponse.json(
          { ok: false, code: "INVALID_URL", message: "url is required" },
          { status: 400 },
        ),
      );
    }
    const result = await startAssessment({
      clientKeyHash: bound.clientKeyHash,
      source: { type: "github", url: body.url.trim() },
    });
    if (!result.ok) {
      return respond(
        NextResponse.json(
          {
            ok: false,
            code: result.code,
            message: result.message,
            activeRunId: result.activeRunId,
          },
          { status: result.status },
        ),
      );
    }
    return respond(NextResponse.json({ ok: true, run: toPublicRunView(result.run) }));
  }

  return respond(
    NextResponse.json(
      {
        ok: false,
        code: "INVALID_SOURCE",
        message: 'source must be "fixture" or "github"',
      },
      { status: 400 },
    ),
  );
}
