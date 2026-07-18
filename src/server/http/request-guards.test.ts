import { afterEach, describe, expect, it } from "vitest";
import {
  guardStateChangingRequest,
  requireJsonContentType,
  requireSameOrigin,
} from "./request-guards";

afterEach(() => {
  delete process.env.TOOLBOX_CSRF_STRICT;
});

describe("request guards", () => {
  it("requires application/json", () => {
    const bad = requireJsonContentType(
      new Request("http://localhost/api/runs", {
        method: "POST",
        headers: { "content-type": "text/plain" },
      }),
    );
    expect(bad?.status).toBe(415);

    const good = requireJsonContentType(
      new Request("http://localhost/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(good).toBeNull();
  });

  it("rejects cross-origin state changes", () => {
    const cross = requireSameOrigin(
      new Request("http://localhost/api/runs", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
          host: "localhost:3000",
        },
      }),
    );
    expect(cross?.status).toBe(403);
  });

  it("allows same-origin JSON posts", () => {
    const ok = guardStateChangingRequest(
      new Request("http://localhost:3000/api/runs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000",
          "sec-fetch-site": "same-origin",
        },
      }),
    );
    expect(ok).toBeNull();
  });

  it("requires Origin or fetch-site metadata when CSRF strict mode is on", () => {
    process.env.TOOLBOX_CSRF_STRICT = "1";
    const missing = requireSameOrigin(
      new Request("https://toolbox.example/api/runs", {
        method: "POST",
        headers: { host: "toolbox.example" },
      }),
    );
    expect(missing?.status).toBe(403);

    const withSite = requireSameOrigin(
      new Request("https://toolbox.example/api/runs", {
        method: "POST",
        headers: {
          host: "toolbox.example",
          "sec-fetch-site": "same-origin",
        },
      }),
    );
    expect(withSite).toBeNull();
  });
});
