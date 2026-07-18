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

function isStrictCsrf(): boolean {
  // Production always strict. Tests can set TOOLBOX_CSRF_STRICT=1 without
  // mutating read-only NODE_ENV.
  return (
    process.env.NODE_ENV === "production" || process.env.TOOLBOX_CSRF_STRICT === "1"
  );
}

/**
 * Same-origin check for browser state-changing requests.
 *
 * Production: require a matching Origin (or Sec-Fetch-Site same-origin/none).
 * Development/test: still reject explicit cross-origin; allow missing Origin
 * for local tooling when Sec-Fetch-Site is absent or same-origin/none.
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
      return null;
    } catch {
      return NextResponse.json(
        { ok: false, code: "CSRF_ORIGIN_MISMATCH", message: "Invalid Origin header" },
        { status: 403 },
      );
    }
  }

  if (secFetchSite === "same-origin" || secFetchSite === "none") {
    return null;
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

  // No Origin and no usable Sec-Fetch-Site.
  if (isStrictCsrf()) {
    return NextResponse.json(
      {
        ok: false,
        code: "CSRF_ORIGIN_REQUIRED",
        message: "Origin or same-origin fetch metadata is required",
      },
      { status: 403 },
    );
  }

  return null;
}

export function guardStateChangingRequest(request: Request): NextResponse | null {
  return requireSameOrigin(request) ?? requireJsonContentType(request);
}
