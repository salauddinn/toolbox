import { NextResponse } from "next/server";

/**
 * Enforce JSON Content-Type on state-changing requests.
 */
export function requireJsonContentType(request: Request): NextResponse | null {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json(
      {
        ok: false,
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "Content-Type must be application/json",
      },
      { status: 415 },
    );
  }
  return null;
}

/**
 * Same-origin check for browser state-changing requests.
 * Allows missing Origin (non-browser / same-process tests) when Sec-Fetch-Site is absent or same-origin.
 */
export function requireSameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const secFetchSite = request.headers.get("sec-fetch-site");

  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json(
          {
            ok: false,
            code: "CSRF_ORIGIN_MISMATCH",
            message: "Cross-origin state-changing requests are not allowed",
          },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        { ok: false, code: "CSRF_ORIGIN_MISMATCH", message: "Invalid Origin header" },
        { status: 403 },
      );
    }
  }

  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return NextResponse.json(
      {
        ok: false,
        code: "CSRF_FETCH_SITE",
        message: "Cross-site state-changing requests are not allowed",
      },
      { status: 403 },
    );
  }

  return null;
}

export function guardStateChangingRequest(request: Request): NextResponse | null {
  return requireSameOrigin(request) ?? requireJsonContentType(request);
}
