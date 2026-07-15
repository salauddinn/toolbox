import type { NormalizedPath } from "./paths";
import type { StageKind } from "./stages";

/**
 * Structured file operations returned by the AI provider.
 * Validated before application to a candidate snapshot.
 */
export type FileOperation =
  | { type: "create"; path: NormalizedPath; content: string }
  | { type: "update"; path: NormalizedPath; content: string }
  | { type: "delete"; path: NormalizedPath };

export type ChangeSetStatus =
  | "generated"
  | "validation_failed"
  | "repair_failed"
  | "validated"
  | "accepted"
  | "rejected"
  | "rolled_back";

/**
 * Bounded group of proposed changes for one stage.
 * Only Change Acceptance promotes it onto the current snapshot.
 */
export type ChangeSet = {
  id: string;
  stageId: string;
  stageKind: StageKind;
  operations: readonly FileOperation[];
  status: ChangeSetStatus;
  attempt: 1 | 2;
  createdAt: string;
};

export function isFileOperation(value: unknown): value is FileOperation {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const op = value as Record<string, unknown>;
  if (op.type === "delete") {
    return typeof op.path === "string";
  }
  if (op.type === "create" || op.type === "update") {
    return typeof op.path === "string" && typeof op.content === "string";
  }
  return false;
}

export function parseFileOperations(value: unknown): FileOperation[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const ops: FileOperation[] = [];
  for (const item of value) {
    if (!isFileOperation(item)) {
      return null;
    }
    ops.push(item);
  }
  return ops;
}
