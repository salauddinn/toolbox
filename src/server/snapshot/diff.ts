import type { FileOperation } from "@/core/changes";
import type { SourceSnapshot } from "@/core/repository";
import type { NormalizedPath } from "@/core/paths";

export type FileDiff = {
  path: NormalizedPath;
  kind: "create" | "update" | "delete";
  before?: string;
  after?: string;
};

export type SnapshotDiff = {
  files: readonly FileDiff[];
  created: number;
  updated: number;
  deleted: number;
};

export function diffSnapshots(before: SourceSnapshot, after: SourceSnapshot): SnapshotDiff {
  const paths = new Set<string>([...before.files.keys(), ...after.files.keys()]);
  const files: FileDiff[] = [];

  for (const path of [...paths].sort()) {
    const p = path as NormalizedPath;
    const b = before.files.get(p);
    const a = after.files.get(p);
    if (!b && a) {
      files.push({ path: p, kind: "create", after: a.content });
    } else if (b && !a) {
      files.push({ path: p, kind: "delete", before: b.content });
    } else if (b && a && b.content !== a.content) {
      files.push({ path: p, kind: "update", before: b.content, after: a.content });
    }
  }

  return {
    files,
    created: files.filter((f) => f.kind === "create").length,
    updated: files.filter((f) => f.kind === "update").length,
    deleted: files.filter((f) => f.kind === "delete").length,
  };
}

export function operationsSummary(operations: readonly FileOperation[]): {
  creates: string[];
  updates: string[];
  deletes: string[];
} {
  return {
    creates: operations.filter((o) => o.type === "create").map((o) => o.path),
    updates: operations.filter((o) => o.type === "update").map((o) => o.path),
    deletes: operations.filter((o) => o.type === "delete").map((o) => o.path),
  };
}

export function fileTree(snapshot: SourceSnapshot): string[] {
  return [...snapshot.files.keys()].sort();
}
