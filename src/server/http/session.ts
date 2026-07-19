import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/** HttpOnly session cookie that binds runs more tightly than IP alone. */
export const SESSION_COOKIE_NAME = "tb_sid";

const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours
const SESSION_ID_BYTES = 24;

function sessionSecret(): string {
  return (
    process.env.TOOLBOX_SESSION_SECRET || process.env.AI_API_KEY || "toolbox-dev-session-secret"
  );
}

function sign(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function mintSessionId(): string {
  return randomBytes(SESSION_ID_BYTES).toString("base64url");
}

export function serializeSessionCookie(sessionId: string, secure: boolean): string {
  const signature = sign(sessionId);
  const token = `${sessionId}.${signature}`;
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Parse and verify the session cookie. Returns undefined when missing/invalid.
 */
export function readSessionId(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (!part.startsWith(`${SESSION_COOKIE_NAME}=`)) continue;
    const raw = part.slice(SESSION_COOKIE_NAME.length + 1);
    const dot = raw.lastIndexOf(".");
    if (dot <= 0) return undefined;
    const sessionId = raw.slice(0, dot);
    const signature = raw.slice(dot + 1);
    if (!sessionId || !signature) return undefined;
    if (!safeEqual(sign(sessionId), signature)) return undefined;
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(sessionId)) return undefined;
    return sessionId;
  }
  return undefined;
}

export function ensureSessionId(request: Request): {
  sessionId: string;
  setCookie?: string;
} {
  const existing = readSessionId(request.headers.get("cookie"));
  if (existing) return { sessionId: existing };

  const sessionId = mintSessionId();
  const url = new URL(request.url);
  const secure = url.protocol === "https:" || process.env.NODE_ENV === "production";
  return {
    sessionId,
    setCookie: serializeSessionCookie(sessionId, secure),
  };
}

/** Attach Set-Cookie when a new session was minted. */
export function withSessionCookie(
  response: NextResponse,
  setCookie: string | undefined,
): NextResponse {
  if (setCookie) {
    response.headers.append("Set-Cookie", setCookie);
  }
  return response;
}
