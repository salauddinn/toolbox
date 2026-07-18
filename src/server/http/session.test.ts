import { describe, expect, it } from "vitest";
import {
  ensureSessionId,
  mintSessionId,
  readSessionId,
  serializeSessionCookie,
  SESSION_COOKIE_NAME,
} from "./session";

describe("session cookie", () => {
  it("mints and verifies a signed session id", () => {
    const sessionId = mintSessionId();
    const cookie = serializeSessionCookie(sessionId, false);
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(readSessionId(cookie)).toBe(sessionId);
  });

  it("rejects tampered signatures", () => {
    const sessionId = mintSessionId();
    const cookie = serializeSessionCookie(sessionId, false);
    const tampered = cookie.replace(sessionId, `${sessionId}x`);
    expect(readSessionId(tampered)).toBeUndefined();
  });

  it("reuses an existing valid cookie", () => {
    const sessionId = mintSessionId();
    const cookie = serializeSessionCookie(sessionId, true);
    const request = new Request("https://example.com/api/runs", {
      headers: { cookie: cookie.split(";")[0]! },
    });
    const ensured = ensureSessionId(request);
    expect(ensured.sessionId).toBe(sessionId);
    expect(ensured.setCookie).toBeUndefined();
  });

  it("issues a new cookie when none is present", () => {
    const request = new Request("https://example.com/api/runs");
    const ensured = ensureSessionId(request);
    expect(ensured.sessionId.length).toBeGreaterThan(16);
    expect(ensured.setCookie).toContain("Secure");
    expect(ensured.setCookie).toContain("HttpOnly");
  });
});
