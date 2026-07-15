import { createHash } from "node:crypto";

/**
 * Derive a coarse client key from the deployment's trusted source-IP signal.
 * Falls back to a shared global bucket when the signal is unavailable.
 */
export function clientKeyFromRequest(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return hashClientKey(first);
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return hashClientKey(realIp);
  return hashClientKey("global-fallback");
}

export function hashClientKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}
