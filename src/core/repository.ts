import type { NormalizedPath } from "./paths";

/** Single file retained in an in-memory repository snapshot. */
export type RepositoryFile = {
  path: NormalizedPath;
  content: string;
  /** Byte length of UTF-8 content at capture time. */
  sizeBytes: number;
};

/**
 * Immutable captured repository state for one run.
 * All analysis, generation, validation, and downloads use this snapshot
 * plus accepted Change Sets (hackathon immutability assumption).
 */
export type SourceSnapshot = {
  /** Unguessable server-issued run id when bound to a run; optional for fixtures. */
  snapshotId: string;
  /** Original public GitHub URL or the synthetic example identifier. */
  sourceLabel: string;
  /** ISO timestamp when the archive was captured. */
  capturedAt: string;
  /** Content-addressable hash of analyzed file paths + contents. */
  contentHash: string;
  files: ReadonlyMap<NormalizedPath, RepositoryFile>;
  /** Recognized application entry when known; set after eligibility. */
  entryPath?: NormalizedPath;
};

export type SnapshotLimits = {
  maxCompressedBytes: number;
  maxExtractedEntries: number;
  maxExtractedBytes: number;
  maxAnalyzedFiles: number;
  maxAnalyzedSourceBytes: number;
};

export const DEFAULT_SNAPSHOT_LIMITS: Readonly<SnapshotLimits> = {
  maxCompressedBytes: 10 * 1024 * 1024,
  maxExtractedEntries: 1_000,
  maxExtractedBytes: 25 * 1024 * 1024,
  maxAnalyzedFiles: 150,
  maxAnalyzedSourceBytes: 2 * 1024 * 1024,
};

export function createRepositoryFile(path: NormalizedPath, content: string): RepositoryFile {
  return {
    path,
    content,
    sizeBytes: Buffer.byteLength(content, "utf8"),
  };
}

export function createSourceSnapshot(input: {
  snapshotId: string;
  sourceLabel: string;
  files: Iterable<RepositoryFile>;
  capturedAt?: string;
  contentHash?: string;
  entryPath?: NormalizedPath;
}): SourceSnapshot {
  const map = new Map<NormalizedPath, RepositoryFile>();
  for (const file of input.files) {
    map.set(file.path, file);
  }
  return {
    snapshotId: input.snapshotId,
    sourceLabel: input.sourceLabel,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    contentHash: input.contentHash ?? "",
    files: map,
    entryPath: input.entryPath,
  };
}

export function listSnapshotPaths(snapshot: SourceSnapshot): NormalizedPath[] {
  return [...snapshot.files.keys()].sort();
}

export function getSnapshotFile(
  snapshot: SourceSnapshot,
  path: NormalizedPath,
): RepositoryFile | undefined {
  return snapshot.files.get(path);
}
