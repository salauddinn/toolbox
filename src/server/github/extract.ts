import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import tar from "tar-stream";
import {
  createRepositoryFile,
  type RepositoryFile,
  type SnapshotLimits,
  DEFAULT_SNAPSHOT_LIMITS,
} from "@/core/repository";
import { normalizeRepositoryPath, type NormalizedPath } from "@/core/paths";
import type { SafetyReasonCode } from "@/core/safety";
import { isIgnoredPath } from "./ignore";

export type ArchiveEntryMeta = {
  path: string;
  type: "file" | "directory" | "symlink" | "other";
  size: number;
  linkname?: string;
};

export type ExtractRejection = {
  code: SafetyReasonCode | "PATH_BACKSLASH" | "PATH_NUL" | "PATH_ABSOLUTE" | "PATH_TRAVERSAL";
  message: string;
  path?: string;
};

export type ExtractResult =
  | { ok: true; files: RepositoryFile[]; skippedIgnored: number }
  | { ok: false; rejection: ExtractRejection };

export type RawArchiveEntry = {
  headerPath: string;
  type: string;
  size: number;
  linkname?: string;
  content: Buffer;
};

/**
 * Strip the single top-level directory GitHub tarballs include (owner-repo-sha/).
 */
export function stripGitHubRootPrefix(entryPath: string): string {
  const normalized = entryPath.replace(/^\.\//, "");
  const slash = normalized.indexOf("/");
  if (slash === -1) {
    return "";
  }
  return normalized.slice(slash + 1);
}

function looksBinary(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 8000));
  if (sample.includes(0)) {
    return true;
  }
  let nonText = 0;
  for (const byte of sample) {
    if (byte < 7 || (byte > 14 && byte < 32 && byte !== 27)) {
      nonText += 1;
    }
  }
  return sample.length > 0 && nonText / sample.length > 0.3;
}

/**
 * Extract a gzip-compressed tar archive entirely in memory.
 * Never writes archive entries to the host filesystem.
 */
export async function extractTarGzInMemory(
  compressed: Buffer,
  limits: SnapshotLimits = DEFAULT_SNAPSHOT_LIMITS,
): Promise<ExtractResult> {
  if (compressed.byteLength > limits.maxCompressedBytes) {
    return {
      ok: false,
      rejection: {
        code: "SAFETY_ARCHIVE_LIMIT",
        message: `Compressed archive exceeds ${limits.maxCompressedBytes} bytes`,
      },
    };
  }

  const extract = tar.extract();
  const rawEntries: RawArchiveEntry[] = [];
  let entryCount = 0;
  let totalBytes = 0;
  let failed: ExtractRejection | undefined;

  extract.on("entry", (header, stream, next) => {
    if (failed) {
      stream.resume();
      next();
      return;
    }

    entryCount += 1;
    if (entryCount > limits.maxExtractedEntries) {
      failed = {
        code: "SAFETY_ARCHIVE_LIMIT",
        message: `Archive exceeds ${limits.maxExtractedEntries} entries`,
        path: header.name,
      };
      stream.resume();
      next();
      return;
    }

    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => {
      totalBytes += chunk.byteLength;
      if (totalBytes > limits.maxExtractedBytes) {
        failed = {
          code: "SAFETY_ARCHIVE_LIMIT",
          message: `Extracted content exceeds ${limits.maxExtractedBytes} bytes`,
          path: header.name,
        };
        return;
      }
      chunks.push(chunk);
    });
    stream.on("end", () => {
      rawEntries.push({
        headerPath: header.name,
        type: header.type ?? "file",
        size: header.size ?? 0,
        linkname: header.linkname ?? undefined,
        content: Buffer.concat(chunks),
      });
      next();
    });
    stream.on("error", (err) => {
      failed = {
        code: "SAFETY_ARCHIVE_LIMIT",
        message: `Archive stream error: ${err.message}`,
        path: header.name,
      };
      next();
    });
  });

  try {
    await pipeline(
      Readable.from(compressed),
      createGunzip({ maxOutputLength: limits.maxExtractedBytes }),
      extract,
    );
  } catch (err) {
    return {
      ok: false,
      rejection: {
        code: "SAFETY_ARCHIVE_LIMIT",
        message: `Failed to extract archive: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }

  if (failed) {
    return { ok: false, rejection: failed };
  }

  return materializeEntries(rawEntries, limits);
}

/**
 * Materialize pre-parsed archive entries (used by fixtures and tests).
 */
export function materializeEntries(
  rawEntries: readonly RawArchiveEntry[],
  limits: SnapshotLimits = DEFAULT_SNAPSHOT_LIMITS,
): ExtractResult {
  const files: RepositoryFile[] = [];
  const seen = new Map<NormalizedPath, string>();
  let skippedIgnored = 0;
  let analyzedBytes = 0;
  let analyzedFiles = 0;

  for (const entry of rawEntries) {
    if (entry.type === "directory") {
      continue;
    }

    const stripped = stripGitHubRootPrefix(entry.headerPath);
    if (!stripped) {
      continue;
    }

    if (entry.type === "symlink" || entry.type === "link") {
      return {
        ok: false,
        rejection: {
          code: "SAFETY_SYMLINK",
          message: "Symbolic links are not allowed in repository archives",
          path: stripped,
        },
      };
    }

    if (entry.type !== "file" && entry.type !== "") {
      return {
        ok: false,
        rejection: {
          code: "SAFETY_BINARY_OR_EXECUTABLE",
          message: `Unsupported archive entry type: ${entry.type}`,
          path: stripped,
        },
      };
    }

    const normalized = normalizeRepositoryPath(stripped);
    if (!normalized.ok) {
      return {
        ok: false,
        rejection: {
          code: mapPathCode(normalized.code),
          message: normalized.message,
          path: stripped,
        },
      };
    }

    if (isIgnoredPath(normalized.path)) {
      skippedIgnored += 1;
      continue;
    }

    if (looksBinary(entry.content)) {
      return {
        ok: false,
        rejection: {
          code: "SAFETY_BINARY_OR_EXECUTABLE",
          message: "Binary or executable content is not allowed in analyzed source",
          path: normalized.path,
        },
      };
    }

    const content = entry.content.toString("utf8");
    const prior = seen.get(normalized.path);
    if (prior !== undefined && prior !== content) {
      return {
        ok: false,
        rejection: {
          code: "SAFETY_NORMALIZED_PATH_COLLISION",
          message: "Normalized path collision with differing content",
          path: normalized.path,
        },
      };
    }
    if (prior !== undefined) {
      continue;
    }
    seen.set(normalized.path, content);

    const file = createRepositoryFile(normalized.path, content);
    files.push(file);

    if (normalized.path.endsWith(".js") || normalized.path === "package.json") {
      analyzedFiles += 1;
      analyzedBytes += file.sizeBytes;
    }
  }

  if (analyzedFiles > limits.maxAnalyzedFiles) {
    return {
      ok: false,
      rejection: {
        code: "SAFETY_ARCHIVE_LIMIT",
        message: `Analyzed source exceeds ${limits.maxAnalyzedFiles} files`,
      },
    };
  }
  if (analyzedBytes > limits.maxAnalyzedSourceBytes) {
    return {
      ok: false,
      rejection: {
        code: "SAFETY_ARCHIVE_LIMIT",
        message: `Analyzed source exceeds ${limits.maxAnalyzedSourceBytes} bytes`,
      },
    };
  }

  return { ok: true, files, skippedIgnored };
}

function mapPathCode(code: string): ExtractRejection["code"] {
  if (code === "PATH_TRAVERSAL") return "SAFETY_PATH_TRAVERSAL";
  if (code === "PATH_ABSOLUTE") return "PATH_ABSOLUTE";
  if (code === "PATH_BACKSLASH") return "PATH_BACKSLASH";
  if (code === "PATH_NUL") return "PATH_NUL";
  return "SAFETY_PATH_TRAVERSAL";
}
