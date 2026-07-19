import {
  createRepositoryFile,
  createSourceSnapshot,
  type RepositoryFile,
  type SourceSnapshot,
} from "@/core/repository";
import type { FileOperation } from "@/core/changes";
import { assertNormalizedPath, normalizeRepositoryPath, type NormalizedPath } from "@/core/paths";
import { isIgnoredPath } from "@/server/github/ignore";
import { hashRepositoryFiles } from "@/server/snapshot/hash";

export type ApplyError = {
  code:
    | "PATH_INVALID"
    | "IGNORED_PATH_PROTECTED"
    | "UPDATE_MISSING"
    | "CREATE_EXISTS"
    | "DELETE_MISSING";
  message: string;
  path?: string;
};

export type ApplyResult =
  | { ok: true; snapshot: SourceSnapshot; files: RepositoryFile[] }
  | { ok: false; error: ApplyError };

/**
 * Apply FileOperations only to a candidate snapshot (never mutates the current snapshot).
 */
export function applyOperationsToSnapshot(
  base: SourceSnapshot,
  operations: readonly FileOperation[],
): ApplyResult {
  const map = new Map<NormalizedPath, RepositoryFile>();
  for (const [path, file] of base.files) {
    map.set(path, file);
  }

  for (const op of operations) {
    const pathResult = normalizeRepositoryPath(op.path);
    if (!pathResult.ok) {
      return {
        ok: false,
        error: {
          code: "PATH_INVALID",
          message: pathResult.message,
          path: op.path,
        },
      };
    }
    const path = pathResult.path;
    if (isIgnoredPath(path)) {
      return {
        ok: false,
        error: {
          code: "IGNORED_PATH_PROTECTED",
          message: `Ignored paths cannot be modified: ${path}`,
          path,
        },
      };
    }

    if (op.type === "create") {
      if (map.has(path)) {
        return {
          ok: false,
          error: {
            code: "CREATE_EXISTS",
            message: `Cannot create existing path: ${path}`,
            path,
          },
        };
      }
      map.set(path, createRepositoryFile(path, op.content));
    } else if (op.type === "update") {
      if (!map.has(path)) {
        return {
          ok: false,
          error: {
            code: "UPDATE_MISSING",
            message: `Cannot update missing path: ${path}`,
            path,
          },
        };
      }
      map.set(path, createRepositoryFile(path, op.content));
    } else if (op.type === "delete") {
      if (!map.has(path)) {
        return {
          ok: false,
          error: {
            code: "DELETE_MISSING",
            message: `Cannot delete missing path: ${path}`,
            path,
          },
        };
      }
      map.delete(path);
    }
  }

  const files = [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
  const snapshot = createSourceSnapshot({
    snapshotId: `${base.snapshotId}:candidate`,
    sourceLabel: base.sourceLabel,
    files,
    contentHash: hashRepositoryFiles(files),
    packageManagerEvidence: base.packageManagerEvidence,
    entryPath: base.entryPath,
  });

  return { ok: true, snapshot, files };
}

export function snapshotFilesList(snapshot: SourceSnapshot): RepositoryFile[] {
  return [...snapshot.files.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function requirePath(path: string): NormalizedPath {
  return assertNormalizedPath(path);
}
