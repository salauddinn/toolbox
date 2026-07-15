/**
 * Normalized repository-relative POSIX paths.
 * Untrusted archive paths must pass through normalizeRepositoryPath before use.
 */

export type NormalizedPath = string & { readonly __brand: "NormalizedPath" };

export type PathNormalizationErrorCode =
  | "PATH_EMPTY"
  | "PATH_ABSOLUTE"
  | "PATH_NUL"
  | "PATH_BACKSLASH"
  | "PATH_TRAVERSAL"
  | "PATH_OUTSIDE_ROOT";

export type PathNormalizationResult =
  | { ok: true; path: NormalizedPath }
  | { ok: false; code: PathNormalizationErrorCode; message: string };

function fail(code: PathNormalizationErrorCode, message: string): PathNormalizationResult {
  return { ok: false, code, message };
}

/**
 * Normalize a raw path into a repository-relative POSIX path.
 * Rejects absolute paths, backslashes, NUL, and traversal outside the root.
 */
export function normalizeRepositoryPath(raw: string): PathNormalizationResult {
  if (raw.length === 0) {
    return fail("PATH_EMPTY", "Path is empty");
  }
  if (raw.includes("\0")) {
    return fail("PATH_NUL", "Path contains a NUL byte");
  }
  if (raw.includes("\\")) {
    return fail("PATH_BACKSLASH", "Path must use POSIX separators only");
  }
  if (raw.startsWith("/") || /^[a-zA-Z]:/.test(raw)) {
    return fail("PATH_ABSOLUTE", "Absolute paths are not allowed");
  }

  const segments = raw.split("/");
  const resolved: string[] = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (resolved.length === 0) {
        return fail("PATH_TRAVERSAL", "Path escapes the repository root");
      }
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }

  if (resolved.length === 0) {
    return fail("PATH_EMPTY", "Path resolves to the repository root");
  }

  return { ok: true, path: resolved.join("/") as NormalizedPath };
}

export function isNormalizedPath(value: string): value is NormalizedPath {
  return normalizeRepositoryPath(value).ok;
}

export function assertNormalizedPath(value: string): NormalizedPath {
  const result = normalizeRepositoryPath(value);
  if (!result.ok) {
    throw new Error(`${result.code}: ${result.message}`);
  }
  return result.path;
}
