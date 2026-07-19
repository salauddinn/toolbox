import { createHash } from "node:crypto";

/**
 * Derive a client key from session (preferred) plus trusted source-IP.
 * Session binding prevents same-NAT cross-user run access when cookies work.
 * IP remains a secondary signal for rate limiting and legacy fallbacks.
 */
export function clientKeyFromRequest(headers: Headers, sessionId?: string): string {
  const ip = trustedClientIp(headers) ?? "global-fallback";
  if (sessionId) {
    return hashClientKey(`session:${sessionId}|ip:${ip}`);
  }
  return hashClientKey(`ip:${ip}`);
}

/**
 * Prefer the first X-Forwarded-For hop (set by the trusted edge/proxy),
 * then X-Real-IP. Do not use later XFF entries — those can be client-spoofed
 * when the proxy appends rather than replaces.
 */
export function trustedClientIp(headers: Headers): string | undefined {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first && isPlausibleIp(first)) return first;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp && isPlausibleIp(realIp)) return realIp;
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf && isPlausibleIp(cf)) return cf;
  return undefined;
}

function isPlausibleIp(value: string): boolean {
  // Basic shape check; rejects empty / header-injection style values.
  if (value.length === 0 || value.length > 128) return false;
  if (/[\s\r\n]/.test(value)) return false;
  return true;
}

export function hashClientKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}
