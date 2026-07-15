import {
  beginLoading,
  markAssessed,
  markEligibilityFailed,
  markSafetyFailed,
  type RunId,
  type RunState,
} from "@/core/run-state";
import { createExpressAnalyzer } from "@/server/analysis/express-analyzer";
import { evaluateEligibility } from "@/server/eligibility/evaluate";
import { loadFixtureSnapshot, type FixtureId } from "@/fixtures/load-fixture";
import { loadGitHubRepository } from "@/server/github/fetch";
import { validateServerEnv } from "@/server/env";
import { rankDomainCandidates } from "@/server/ranking/candidates";
import { evaluateAllCandidateReadiness } from "@/server/ranking/readiness";
import { globalRateLimiter } from "@/server/ai/rate-limit";
import { globalRunStore, type RunStore } from "@/server/run-store";
import { screenRepositorySafety } from "@/server/safety/screen";

export type AssessSource =
  { type: "fixture"; fixtureId: FixtureId } | { type: "github"; url: string };

export type AssessError = {
  ok: false;
  code: string;
  message: string;
  status: number;
  run?: RunState;
};

export type AssessSuccess = {
  ok: true;
  run: RunState;
};

export type AssessResult = AssessSuccess | AssessError;

/** Free the active rate-limit slot for terminal or assessment-only outcomes. */
export function releaseRunCapacity(clientKeyHash: string): void {
  globalRateLimiter.release(clientKeyHash);
}

function releaseIfTerminal(clientKeyHash: string, phase: RunState["phase"]): void {
  // assessment-only and hard failures free capacity immediately (no sequence).
  // assessed keeps the slot until sequence completes/stops so concurrent runs stay capped.
  if (
    phase === "eligibility_failed" ||
    phase === "safety_failed" ||
    phase === "not_ready" ||
    phase === "expired"
  ) {
    releaseRunCapacity(clientKeyHash);
  }
}

/**
 * Load → eligibility → safety → analysis → ranking → readiness.
 * No AI calls on any path in this function.
 */
export async function startAssessment(input: {
  clientKeyHash: string;
  source: AssessSource;
  store?: RunStore;
  githubToken?: string;
}): Promise<AssessResult> {
  const store = input.store ?? globalRunStore;

  const limit = globalRateLimiter.tryStart(input.clientKeyHash);
  if (!limit.ok) {
    return { ok: false, code: limit.code, message: limit.message, status: 429 };
  }

  let run: RunState;
  try {
    run = store.create(input.clientKeyHash);
  } catch (err) {
    globalRateLimiter.release(input.clientKeyHash);
    return {
      ok: false,
      code: "RUN_CAPACITY",
      message: err instanceof Error ? err.message : "Run capacity exceeded",
      status: 503,
    };
  }

  const sourceLabel =
    input.source.type === "fixture" ? `fixture:${input.source.fixtureId}` : input.source.url;

  const loading = beginLoading(run, sourceLabel);
  if (!loading.ok) {
    globalRateLimiter.release(input.clientKeyHash);
    store.delete(run.runId);
    return {
      ok: false,
      code: loading.error.code,
      message: loading.error.message,
      status: 500,
    };
  }
  run = loading.state;
  store.set(run);

  try {
    let snapshot;
    if (input.source.type === "fixture") {
      snapshot = loadFixtureSnapshot(input.source.fixtureId);
    } else {
      const env = validateServerEnv();
      const token = input.githubToken ?? (env.ok ? env.env.GITHUB_TOKEN : undefined);
      const fetched = await loadGitHubRepository(input.source.url, {
        githubToken: token,
        snapshotId: `run:${run.runId}`,
      });
      if (!fetched.ok) {
        // Map private/invalid URL into eligibility-style failure when possible
        if (
          fetched.code === "ELIGIBILITY_PRIVATE_REPOSITORY" ||
          fetched.code === "ELIGIBILITY_INVALID_URL" ||
          fetched.code === "ELIGIBILITY_NOT_PUBLIC_GITHUB"
        ) {
          const failed = markEligibilityFailed(run, {
            eligible: false,
            rejections: [
              {
                code: fetched.code,
                message: fetched.message,
                evidence: [],
              },
            ],
          });
          if (failed.ok) {
            run = failed.state;
            store.set(run);
            releaseIfTerminal(input.clientKeyHash, run.phase);
            return { ok: true, run };
          }
        }
        globalRateLimiter.release(input.clientKeyHash);
        store.delete(run.runId as RunId);
        return {
          ok: false,
          code: fetched.code,
          message: fetched.message,
          status: fetched.code === "GITHUB_TIMEOUT" ? 504 : 400,
        };
      }
      snapshot = fetched.snapshot;
    }

    const eligibility = evaluateEligibility(snapshot);
    if (!eligibility.eligible) {
      const failed = markEligibilityFailed(run, eligibility);
      if (!failed.ok) {
        globalRateLimiter.release(input.clientKeyHash);
        return {
          ok: false,
          code: failed.error.code,
          message: failed.error.message,
          status: 500,
        };
      }
      run = failed.state;
      store.set(run);
      releaseIfTerminal(input.clientKeyHash, run.phase);
      return { ok: true, run };
    }

    const safety = screenRepositorySafety(snapshot);
    if (!safety.passed) {
      const failed = markSafetyFailed(run, safety);
      if (!failed.ok) {
        globalRateLimiter.release(input.clientKeyHash);
        return {
          ok: false,
          code: failed.error.code,
          message: failed.error.message,
          status: 500,
        };
      }
      run = failed.state;
      store.set(run);
      releaseIfTerminal(input.clientKeyHash, run.phase);
      return { ok: true, run };
    }

    const analyzer = createExpressAnalyzer();
    const files = [...snapshot.files.values()];
    const analysis = await analyzer.analyze(files);
    const ranking = rankDomainCandidates(analysis);
    const readinessByCandidateId = evaluateAllCandidateReadiness(
      ranking.candidates,
      analysis,
      files,
    );

    const assessed = markAssessed(run, {
      snapshot: {
        ...snapshot,
        entryPath: analysis.entryPath,
      },
      analysis,
      ranking,
      readinessByCandidateId,
    });
    if (!assessed.ok) {
      globalRateLimiter.release(input.clientKeyHash);
      return {
        ok: false,
        code: assessed.error.code,
        message: assessed.error.message,
        status: 500,
      };
    }
    run = assessed.state;
    store.set(run);
    return { ok: true, run };
  } catch (err) {
    globalRateLimiter.release(input.clientKeyHash);
    store.delete(run.runId);
    return {
      ok: false,
      code: "ASSESS_INTERNAL",
      message: err instanceof Error ? err.message : String(err),
      status: 500,
    };
  }
}
