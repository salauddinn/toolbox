/**
 * Accept only root public GitHub repository URLs.
 * Archive/API hosts are constructed server-side — never from user-supplied hosts.
 */

export type GitHubRepoRef = {
  owner: string;
  repo: string;
  /** Canonical https://github.com/<owner>/<repo> without .git or trailing slash. */
  canonicalUrl: string;
};

export type GitHubUrlErrorCode = "ELIGIBILITY_INVALID_URL" | "ELIGIBILITY_NOT_PUBLIC_GITHUB";

export type GitHubUrlResult =
  { ok: true; ref: GitHubRepoRef } | { ok: false; code: GitHubUrlErrorCode; message: string };

const OWNER_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
const REPO_RE = /^[a-zA-Z0-9._-]+$/;

/**
 * Normalize and validate a user-supplied repository URL.
 * Rejects non-GitHub hosts, nested paths, query strings used as branches, and SSH forms.
 */
export function parseGitHubRepoUrl(raw: string): GitHubUrlResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, code: "ELIGIBILITY_INVALID_URL", message: "Repository URL is empty" };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return {
      ok: false,
      code: "ELIGIBILITY_INVALID_URL",
      message: "Repository URL is not a valid absolute URL",
    };
  }

  if (url.protocol !== "https:") {
    return {
      ok: false,
      code: "ELIGIBILITY_NOT_PUBLIC_GITHUB",
      message: "Only https://github.com/<owner>/<repo> URLs are accepted",
    };
  }

  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    return {
      ok: false,
      code: "ELIGIBILITY_NOT_PUBLIC_GITHUB",
      message: "Only github.com repository roots are accepted",
    };
  }

  if (url.username || url.password) {
    return {
      ok: false,
      code: "ELIGIBILITY_INVALID_URL",
      message: "Repository URL must not include credentials",
    };
  }

  if (url.search || url.hash) {
    return {
      ok: false,
      code: "ELIGIBILITY_INVALID_URL",
      message: "Repository URL must be a root path without query or fragment",
    };
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 2) {
    return {
      ok: false,
      code: "ELIGIBILITY_INVALID_URL",
      message: "Use a root repository URL: https://github.com/<owner>/<repo>",
    };
  }

  const owner = segments[0]!;
  let repo = segments[1]!;
  if (repo.endsWith(".git")) {
    repo = repo.slice(0, -4);
  }

  if (!OWNER_RE.test(owner) || !REPO_RE.test(repo) || repo === "." || repo === "..") {
    return {
      ok: false,
      code: "ELIGIBILITY_INVALID_URL",
      message: "Owner or repository name is invalid",
    };
  }

  return {
    ok: true,
    ref: {
      owner,
      repo,
      canonicalUrl: `https://github.com/${owner}/${repo}`,
    },
  };
}

/** Documented hosts that archive redirects may target. */
export const ALLOWED_GITHUB_ARCHIVE_HOSTS = new Set([
  "github.com",
  "www.github.com",
  "api.github.com",
  "codeload.github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
]);

export function isAllowedGitHubHost(hostname: string): boolean {
  return ALLOWED_GITHUB_ARCHIVE_HOSTS.has(hostname.toLowerCase());
}

export function githubApiRepoUrl(ref: GitHubRepoRef): string {
  return `https://api.github.com/repos/${ref.owner}/${ref.repo}`;
}

export function githubTarballUrl(ref: GitHubRepoRef, refName = "HEAD"): string {
  return `https://api.github.com/repos/${ref.owner}/${ref.repo}/tarball/${encodeURIComponent(refName)}`;
}
