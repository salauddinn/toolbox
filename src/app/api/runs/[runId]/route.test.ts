import { beforeEach, describe, expect, it } from "vitest";
import { globalRateLimiter } from "@/server/ai/rate-limit";
import { clientKeyFromRequest } from "@/server/ai/client-key";
import { serializeSessionCookie } from "@/server/http/session";
import { globalRunStore } from "@/server/run-store";
import { startAssessment } from "@/server/workflow/assess";
import { POST } from "../route";
import { DELETE } from "./route";

const ownerSession = "owner-session-1234567890";
const otherSession = "other-session-1234567890";

function cookieFor(sessionId: string): string {
  return serializeSessionCookie(sessionId, false).split(";")[0]!;
}

function stateChangingRequest(url: string, method: "POST" | "DELETE", cookie: string) {
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
      host: "localhost",
      cookie,
    },
    body:
      method === "POST"
        ? JSON.stringify({ source: "fixture", fixtureId: "controlled-example" })
        : "{}",
  });
}

async function createOwnerRun() {
  const cookie = cookieFor(ownerSession);
  const clientKeyHash = clientKeyFromRequest(new Headers({ cookie }), ownerSession);
  const result = await startAssessment({
    clientKeyHash,
    source: { type: "fixture", fixtureId: "controlled-example" },
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.message);
  return { cookie, run: result.run };
}

describe("/api/runs/:runId", () => {
  beforeEach(() => {
    globalRunStore.clear();
    globalRateLimiter.reset();
  });

  it("rejects cross-origin run deletion", async () => {
    const request = new Request("http://localhost/api/runs/run-id", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
        host: "localhost",
      },
      body: "{}",
    });

    const response = await DELETE(request, { params: Promise.resolve({ runId: "run-id" }) });
    expect(response.status).toBe(403);
  });

  it("lets the bound client delete its run", async () => {
    const { cookie, run } = await createOwnerRun();
    const request = stateChangingRequest(
      `http://localhost/api/runs/${run.runId}`,
      "DELETE",
      cookie,
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ runId: run.runId }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(globalRunStore.get(run.runId)).toBeUndefined();
  });

  it("does not let another client delete the run", async () => {
    const { run } = await createOwnerRun();
    const request = stateChangingRequest(
      `http://localhost/api/runs/${run.runId}`,
      "DELETE",
      cookieFor(otherSession),
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ runId: run.runId }),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ ok: false, code: "RUN_FORBIDDEN" });
    expect(globalRunStore.get(run.runId)).toBeDefined();
  });

  it("returns the replaceable run id with the active-client response", async () => {
    const cookie = cookieFor(ownerSession);
    const first = await POST(stateChangingRequest("http://localhost/api/runs", "POST", cookie));
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { run: { runId: string } };

    const second = await POST(stateChangingRequest("http://localhost/api/runs", "POST", cookie));
    expect(second.status).toBe(429);
    expect(await second.json()).toMatchObject({
      ok: false,
      code: "RATE_LIMIT_ACTIVE_CLIENT",
      activeRunId: firstBody.run.runId,
    });
  });
});
