import type { FileOperation } from "@/core/changes";
import type { PathEnvelope } from "@/core/stages";
import { normalizeRepositoryPath } from "@/core/paths";

/**
 * Minimal glob: `**` matches any path segments, `*` matches within a segment.
 */
export function matchPathPattern(pattern: string, filePath: string): boolean {
  if (pattern === filePath) return true;
  if (pattern === "**" || pattern === "**/*") return true;

  const escapeRegex = (s: string) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  let regexSource = "";
  for (let i = 0; i < pattern.length;) {
    if (pattern.startsWith("**/", i)) {
      regexSource += "(?:.*/)?";
      i += 3;
    } else if (pattern.startsWith("**", i)) {
      regexSource += ".*";
      i += 2;
    } else if (pattern[i] === "*") {
      regexSource += "[^/]*";
      i += 1;
    } else {
      regexSource += escapeRegex(pattern[i]!);
      i += 1;
    }
  }
  return new RegExp(`^${regexSource}$`).test(filePath);
}

export function pathAllowedInEnvelope(
  op: FileOperation,
  envelope: PathEnvelope,
): { ok: true } | { ok: false; reason: string } {
  const normalized = normalizeRepositoryPath(op.path);
  if (!normalized.ok) {
    return { ok: false, reason: `path_outside_repository_root:${op.path}` };
  }
  const path = normalized.path;
  const patterns =
    op.type === "create"
      ? envelope.create
      : op.type === "update"
        ? envelope.update
        : envelope.delete;

  if (patterns.length === 0) {
    return {
      ok: false,
      reason: `disallowed_${op.type}_outside_envelope:${path}`,
    };
  }

  const allowed = patterns.some((p) => matchPathPattern(p, path));
  if (!allowed) {
    return {
      ok: false,
      reason: `disallowed_${op.type}_outside_envelope:${path}`,
    };
  }
  return { ok: true };
}

const FORBIDDEN_EXACT = new Set([
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "npm-shrinkwrap.json",
  "LICENSE",
  "LICENSE.md",
  "COPYING",
]);

const FORBIDDEN_PREFIXES = [".github/", ".env"];

export function isForbiddenProtectedPath(path: string): string | null {
  if (FORBIDDEN_EXACT.has(path)) {
    if (path === "package.json") return "disallowed_manifest_change";
    if (
      path === "package-lock.json" ||
      path === "yarn.lock" ||
      path === "pnpm-lock.yaml" ||
      path === "npm-shrinkwrap.json"
    ) {
      return "disallowed_lockfile_change";
    }
    return "disallowed_license_change";
  }
  if (path.startsWith(".github/")) return "disallowed_github_workflow_change";
  if (path === ".env" || path.startsWith(".env.") || path.endsWith(".env")) {
    return "disallowed_env_change";
  }
  for (const prefix of FORBIDDEN_PREFIXES) {
    if (path.startsWith(prefix) && prefix !== ".env") {
      return "disallowed_protected_path";
    }
  }
  return null;
}
