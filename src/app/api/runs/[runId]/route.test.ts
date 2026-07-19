import { beforeEach, describe, expect, it } from "vitest";
import { globalRateLimiter } from "@/server/ai/rate-limit";
import { selectDomainCandidate } from "@/server/workflow/select";
import { authorizeAndGenerate } from "@/server/workflow/stage-runner";
import { clientKeyFromRequest } from "@/server/ai/client-key";
import { serializeSessionCookie } from "@/server/http/session";
import { globalRunStore } from "@/server/run-store";
import { startAssessment } from "@/server/workflow/assess";
import { POST } from "../route";
import { DELETE, GET } from "./route";

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

  it("recovers the bounded review payload while awaiting acceptance", async () => {
    const { cookie, run } = await createOwnerRun();
    if (run.phase !== "assessed") throw new Error("expected assessed run");
    const candidate = run.ranking.candidates.find(
      (item) => run.readinessByCandidateId.get(item.id)?.ready,
    );
    if (!candidate) throw new Error("expected ready candidate");
    const clientKeyHash = clientKeyFromRequest(new Headers({ cookie }), ownerSession);
    const selected = selectDomainCandidate({
      runId: run.runId,
      candidateId: candidate.id,
      clientKeyHash,
    });
    expect(selected.ok).toBe(true);
    const generated = await authorizeAndGenerate({
      runId: run.runId,
      clientKeyHash,
      forceDeterministic: true,
    });
    expect(generated.ok).toBe(true);
    if (!generated.ok || generated.run.phase !== "awaiting_acceptance") {
      throw new Error("expected awaiting acceptance");
    }
    const generatedRun = generated.run;

    const response = await GET(
      new Request(`http://localhost/api/runs/${run.runId}`, { headers: { cookie } }),
      {
        params: Promise.resolve({ runId: run.runId }),
      },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      run: { phase: string; reviewPayload?: { changeSetId: string; files: unknown[] } | null };
    };
    expect(body.ok).toBe(true);
    expect(body.run.phase).toBe("awaiting_acceptance");
    expect(body.run.reviewPayload).toMatchObject({
      changeSetId: generatedRun.changeSet.id,
    });
    expect(body.run.reviewPayload?.files.length).toBeGreaterThan(0);
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
