/**
 * Allowlist AI provider base URLs so a misconfigured AI_BASE_URL cannot
 * become an SSRF path to internal metadata services.
 */

const BLOCKED_HOST_SUFFIXES = [
  ".internal",
  ".local",
  ".localhost",
  ".localdomain",
];

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "0.0.0.0",
]);

function isPrivateOrSpecialIp(hostname: string): boolean {
  // IPv4
  const v4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const parts = v4.slice(1).map((p) => Number(p));
    if (parts.some((n) => n > 255)) return true;
    const [a, b] = parts as [number, number, number, number];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }

  // IPv6 compressed forms commonly used for loopback / link-local
  const lower = hostname.toLowerCase();
  if (lower === "::1" || lower === "::" || lower.startsWith("fe80:")) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
  return false;
}

export type AiBaseUrlResult =
  | { ok: true; baseUrl: string }
  | { ok: false; message: string };

/**
 * Validate AI_BASE_URL before server-side fetch.
 * Allows only https (http only for localhost in non-production).
 */
export function validateAiBaseUrl(
  raw: string,
  options: { allowHttpLocalhost?: boolean } = {},
): AiBaseUrlResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, message: "AI_BASE_URL is not a valid URL" };
  }

  const host = url.hostname.toLowerCase();
  const allowHttpLocal =
    options.allowHttpLocalhost ?? process.env.NODE_ENV !== "production";

  if (url.protocol === "http:") {
    if (!(allowHttpLocal && (host === "localhost" || host === "127.0.0.1"))) {
      return { ok: false, message: "AI_BASE_URL must use https" };
    }
  } else if (url.protocol !== "https:") {
    return { ok: false, message: "AI_BASE_URL must use https" };
  }

  if (url.username || url.password) {
    return { ok: false, message: "AI_BASE_URL must not include credentials" };
  }

  if (BLOCKED_HOSTS.has(host) && url.protocol === "https:") {
    // localhost https still blocked in production paths via private check below
  }

  if (BLOCKED_HOSTS.has(host) && host !== "localhost") {
    return { ok: false, message: `AI_BASE_URL host is not allowed: ${host}` };
  }

  for (const suffix of BLOCKED_HOST_SUFFIXES) {
    if (host.endsWith(suffix) || host === suffix.slice(1)) {
      return { ok: false, message: `AI_BASE_URL host is not allowed: ${host}` };
    }
  }

  if (isPrivateOrSpecialIp(host)) {
    // Allow explicit local dev override only for loopback http already handled.
    if (!(allowHttpLocal && (host === "127.0.0.1" || host === "localhost"))) {
      return { ok: false, message: `AI_BASE_URL must not target private/link-local addresses` };
    }
  }

  // Normalize: strip trailing slash for join safety
  const normalized = url.toString().replace(/\/$/, "");
  return { ok: true, baseUrl: normalized };
}
