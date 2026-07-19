import type { PublicRunView } from "@/server/workflow/public-view";

export type StartAssessmentBody =
  { source: "fixture"; fixtureId: string; demo?: boolean } | { source: "github"; url: string };

export type SelectCandidateBody = {
  candidateId: string;
  modernizationIntent?: string;
};

export type ApiFailure = {
  ok: false;
  status: number;
  code?: string;
  message?: string;
  activeRunId?: string;
  run?: PublicRunView;
};

export type ApiSuccess<T extends object = object> = { ok: true; status: number } & T;
export type ApiResult<T extends object = object> = ApiSuccess<T> | ApiFailure;

type RunResponse = { run: PublicRunView };
type AuthorizeResponse = RunResponse;

async function requestJson<T extends object>(
  url: string,
  method: "GET" | "POST" | "DELETE",
  body?: unknown,
): Promise<ApiResult<T>> {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data: unknown = await response.json().catch(() => ({}));

  // Endpoint responses are server-owned and typed at their route boundaries.
  // Keep the client transport boundary explicit rather than spreading untyped JSON through UI state.
  if (
    typeof data === "object" &&
    data !== null &&
    "ok" in data &&
    data.ok === true &&
    response.ok
  ) {
    return { ...(data as T), ok: true, status: response.status };
  }

  const failure =
    typeof data === "object" && data !== null ? (data as Omit<ApiFailure, "ok" | "status">) : {};
  return { ...failure, ok: false, status: response.status };
}

export function startAssessment(body: StartAssessmentBody): Promise<ApiResult<RunResponse>> {
  return requestJson<RunResponse>("/api/runs", "POST", body);
}

export function getRun(runId: string): Promise<ApiResult<RunResponse>> {
  return requestJson<RunResponse>(`/api/runs/${runId}`, "GET");
}

export function deleteRun(runId: string): Promise<ApiResult> {
  return requestJson(`/api/runs/${runId}`, "DELETE", {});
}

export function selectCandidate(
  runId: string,
  body: SelectCandidateBody,
): Promise<ApiResult<RunResponse>> {
  return requestJson<RunResponse>(`/api/runs/${runId}/select`, "POST", body);
}

export function authorizeStage(runId: string): Promise<ApiResult<AuthorizeResponse>> {
  return requestJson<AuthorizeResponse>(`/api/runs/${runId}/authorize`, "POST", {});
}

export function retryRolledBackStage(runId: string): Promise<ApiResult<AuthorizeResponse>> {
  return requestJson<AuthorizeResponse>(`/api/runs/${runId}/retry`, "POST", {});
}

export function recheckRolledBackStage(runId: string): Promise<ApiResult<RunResponse>> {
  return requestJson<RunResponse>(`/api/runs/${runId}/recheck`, "POST", {});
}

export function continueWithKnownBlocker(runId: string): Promise<ApiResult<RunResponse>> {
  return requestJson<RunResponse>(`/api/runs/${runId}/continue`, "POST", {});
}

export function acceptChangeSet(runId: string): Promise<ApiResult<RunResponse>> {
  return requestJson<RunResponse>(`/api/runs/${runId}/accept`, "POST", {});
}

export function rejectChangeSet(runId: string): Promise<ApiResult<RunResponse>> {
  return requestJson<RunResponse>(`/api/runs/${runId}/reject`, "POST", {});
}
