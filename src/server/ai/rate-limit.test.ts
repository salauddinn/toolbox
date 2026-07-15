import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limit";
import { clientKeyFromRequest, hashClientKey } from "./client-key";

describe("rate limiter and client key", () => {
  it("hashes source-IP signals and falls back globally", () => {
    const withForwarded = clientKeyFromRequest(
      new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }),
    );
    expect(withForwarded).toBe(hashClientKey("1.2.3.4"));
    const fallback = clientKeyFromRequest(new Headers());
    expect(fallback).toBe(hashClientKey("global-fallback"));
  });

  it("enforces starts/hour, active client, and process caps", () => {
    let now = 1_000_000;
    const limiter = new RateLimiter(
      { maxStartsPerHour: 2, maxActiveRunsPerClient: 1, maxActiveRunsProcess: 2 },
      () => now,
    );

    expect(limiter.tryStart("a").ok).toBe(true);
    expect(limiter.tryStart("a").ok).toBe(false); // active client

    limiter.release("a");
    expect(limiter.tryStart("a").ok).toBe(true);
    limiter.release("a");
    expect(limiter.tryStart("a").ok).toBe(false); // starts/hour

    expect(limiter.tryStart("b").ok).toBe(true);
    expect(limiter.tryStart("c").ok).toBe(true); // processActive becomes 2
    expect(limiter.tryStart("d").ok).toBe(false); // process cap

    limiter.reset();
    expect(limiter.tryStart("a").ok).toBe(true);
    now += 3_600_001;
    limiter.release("a");
    expect(limiter.tryStart("a").ok).toBe(true);
  });
});
