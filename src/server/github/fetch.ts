import {
  createSourceSnapshot,
  DEFAULT_SNAPSHOT_LIMITS,
  type SnapshotLimits,
  type SourceSnapshot,
} from "@/core/repository";
import { hashRepositoryFiles } from "@/server/snapshot/hash";
import { extractTarGzInMemory, type ExtractRejection } from "./extract";
import {
  githubApiRepoUrl,
  githubTarballUrl,
  isAllowedGitHubHost,
  parseGitHubRepoUrl,
  type GitHubRepoRef,
} from "./url";

export type GitHubFetchErrorCode =
  | "ELIGIBILITY_INVALID_URL"
  | "ELIGIBILITY_NOT_PUBLIC_GITHUB"
  | "ELIGIBILITY_PRIVATE_REPOSITORY"
  | "GITHUB_NOT_FOUND"
  | "GITHUB_RATE_LIMITED"
  | "GITHUB_NETWORK_ERROR"
  | "GITHUB_TIMEOUT"
  | "GITHUB_REDIRECT_BLOCKED"
  | "GITHUB_ARCHIVE_REJECTED";

export type GitHubFetchResult =
  | { ok: true; snapshot: SourceSnapshot; ref: GitHubRepoRef }
  | {
      ok: false;
      code: GitHubFetchErrorCode;
      message: string;
      extractRejection?: ExtractRejection;
    };

export type GitHubFetchOptions = {
  githubToken?: string;
  limits?: SnapshotLimits;
  timeoutMs?: number;
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
  snapshotId?: string;
};

const DEFAULT_TIMEOUT_MS = 30_000;

function authHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ToolBox-MVP",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal, redirect: "manual" });
  } finally {
    clearTimeout(timer);
  }
}

async function followGitHubRedirects(
  startUrl: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  maxRedirects = 5,
): Promise<Response | { error: GitHubFetchResult & { ok: false } }> {
  let url = startUrl;
  for (let i = 0; i <= maxRedirects; i += 1) {
    let response: Response;
    try {
      response = await fetchWithTimeout(url, init, timeoutMs, fetchImpl);
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      return {
        error: {
          ok: false,
          code: aborted ? "GITHUB_TIMEOUT" : "GITHUB_NETWORK_ERROR",
          message: aborted
            ? `GitHub request timed out after ${timeoutMs}ms`
            : `GitHub network error: ${err instanceof Error ? err.message : String(err)}`,
        },
      };
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        return {
          error: {
            ok: false,
            code: "GITHUB_REDIRECT_BLOCKED",
            message: "GitHub redirect missing Location header",
          },
        };
      }
      let next: URL;
      try {
        next = new URL(location, url);
      } catch {
        return {
          error: {
            ok: false,
            code: "GITHUB_REDIRECT_BLOCKED",
            message: "GitHub redirect target is not a valid URL",
          },
        };
      }
      if (!isAllowedGitHubHost(next.hostname)) {
        return {
          error: {
            ok: false,
            code: "GITHUB_REDIRECT_BLOCKED",
            message: `Redirect host not allowed: ${next.hostname}`,
          },
        };
      }
      url = next.toString();
      continue;
    }

    return response;
  }

  return {
    error: {
      ok: false,
      code: "GITHUB_REDIRECT_BLOCKED",
      message: "Too many redirects while fetching GitHub archive",
    },
  };
}

/**
 * Load one public GitHub repository into an in-memory SourceSnapshot.
 * Verifies private:false before archive download even when GITHUB_TOKEN is set.
 */
export async function loadGitHubRepository(
  rawUrl: string,
  options: GitHubFetchOptions = {},
): Promise<GitHubFetchResult> {
  const parsed = parseGitHubRepoUrl(rawUrl);
  if (!parsed.ok) {
    return { ok: false, code: parsed.code, message: parsed.message };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const limits = options.limits ?? DEFAULT_SNAPSHOT_LIMITS;
  const headers = authHeaders(options.githubToken);

  let metaResponse: Response;
  try {
    metaResponse = await fetchWithTimeout(
      githubApiRepoUrl(parsed.ref),
      { method: "GET", headers },
      timeoutMs,
      fetchImpl,
    );
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      code: aborted ? "GITHUB_TIMEOUT" : "GITHUB_NETWORK_ERROR",
      message: aborted
        ? `GitHub metadata request timed out after ${timeoutMs}ms`
        : `GitHub network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (metaResponse.status === 404) {
    return {
      ok: false,
      code: "GITHUB_NOT_FOUND",
      message: "GitHub repository was not found or is not accessible",
    };
  }
  if (metaResponse.status === 403 || metaResponse.status === 429) {
    const remaining = metaResponse.headers.get("x-ratelimit-remaining");
    return {
      ok: false,
      code: "GITHUB_RATE_LIMITED",
      message:
        remaining === "0" || metaResponse.status === 429
          ? "GitHub API rate limit exceeded"
          : "GitHub API denied access to repository metadata",
    };
  }
  if (!metaResponse.ok) {
    return {
      ok: false,
      code: "GITHUB_NETWORK_ERROR",
      message: `GitHub metadata request failed with HTTP ${metaResponse.status}`,
    };
  }

  const meta = (await metaResponse.json()) as { private?: boolean; full_name?: string };
  if (meta.private === true) {
    return {
      ok: false,
      code: "ELIGIBILITY_PRIVATE_REPOSITORY",
      message: "Only public GitHub repositories are accepted",
    };
  }
  if (meta.private !== false) {
    return {
      ok: false,
      code: "ELIGIBILITY_NOT_PUBLIC_GITHUB",
      message: "Could not confirm repository is public",
    };
  }

  // Tarball download: do not force application/octet-stream (GitHub returns 415).
  // Keep auth + User-Agent; Accept */* so redirects to codeload succeed.
  const archiveHeaders: Record<string, string> = {
    Accept: "*/*",
    "User-Agent": "ToolBox-MVP",
  };
  if (options.githubToken) {
    archiveHeaders.Authorization = `Bearer ${options.githubToken}`;
  }

  const archive = await followGitHubRedirects(
    githubTarballUrl(parsed.ref),
    {
      method: "GET",
      headers: archiveHeaders,
    },
    timeoutMs,
    fetchImpl,
  );

  if ("error" in archive) {
    return archive.error;
  }

  if (archive.status === 404) {
    return {
      ok: false,
      code: "GITHUB_NOT_FOUND",
      message: "GitHub archive was not found",
    };
  }
  if (archive.status === 403 || archive.status === 429) {
    return {
      ok: false,
      code: "GITHUB_RATE_LIMITED",
      message: "GitHub archive request was rate limited or denied",
    };
  }
  if (!archive.ok) {
    return {
      ok: false,
      code: "GITHUB_NETWORK_ERROR",
      message: `GitHub archive request failed with HTTP ${archive.status}`,
    };
  }

  const buffer = Buffer.from(await archive.arrayBuffer());
  if (buffer.byteLength > limits.maxCompressedBytes) {
    return {
      ok: false,
      code: "GITHUB_ARCHIVE_REJECTED",
      message: `Compressed archive exceeds ${limits.maxCompressedBytes} bytes`,
    };
  }

  const extracted = await extractTarGzInMemory(buffer, limits);
  if (!extracted.ok) {
    return {
      ok: false,
      code: "GITHUB_ARCHIVE_REJECTED",
      message: extracted.rejection.message,
      extractRejection: extracted.rejection,
    };
  }

  const contentHash = hashRepositoryFiles(extracted.files);
  const snapshot = createSourceSnapshot({
    snapshotId:
      options.snapshotId ?? `gh:${parsed.ref.owner}/${parsed.ref.repo}:${contentHash.slice(0, 12)}`,
    sourceLabel: parsed.ref.canonicalUrl,
    files: extracted.files,
    contentHash,
    packageManagerEvidence: extracted.packageManagerEvidence,
  });

  return { ok: true, snapshot, ref: parsed.ref };
}
