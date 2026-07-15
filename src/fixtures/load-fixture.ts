import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  createRepositoryFile,
  createSourceSnapshot,
  type RepositoryFile,
  type SourceSnapshot,
} from "@/core/repository";
import { assertNormalizedPath, type NormalizedPath } from "@/core/paths";
import type { FileOperation } from "@/core/changes";

const FIXTURES_ROOT = path.join(process.cwd(), "fixtures");

const SKIP_DIR_NAMES = new Set(["node_modules", "coverage", ".git", "dist", "build", ".next"]);

const SKIP_FILE_NAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "npm-shrinkwrap.json",
]);

export type FixtureId =
  | "controlled-example"
  | "unsupported-esm"
  | "missing-mongoose"
  | "path-risk"
  | "no-ready-candidate";

function walkFiles(dir: string, base: string): RepositoryFile[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: RepositoryFile[] = [];

  for (const entry of entries) {
    if (SKIP_DIR_NAMES.has(entry.name)) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(full, base));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (SKIP_FILE_NAMES.has(entry.name)) {
      continue;
    }
    const relative = path.relative(base, full).split(path.sep).join("/");
    const content = readFileSync(full, "utf8");
    const normalized = assertNormalizedPath(relative);
    files.push(createRepositoryFile(normalized, content));
  }

  return files;
}

function hashFiles(files: readonly RepositoryFile[]): string {
  const hash = createHash("sha256");
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const file of sorted) {
    hash.update(file.path);
    hash.update("\0");
    hash.update(file.content);
    hash.update("\0");
  }
  return hash.digest("hex");
}

/**
 * Load a fixture directory into the same SourceSnapshot shape used for GitHub archives.
 */
export function loadFixtureSnapshot(fixtureId: FixtureId): SourceSnapshot {
  const dir = path.join(FIXTURES_ROOT, fixtureId);
  if (!existsSync(dir)) {
    throw new Error(`Unknown fixture: ${fixtureId}`);
  }
  const files = walkFiles(dir, dir);
  return createSourceSnapshot({
    snapshotId: `fixture:${fixtureId}`,
    sourceLabel: `fixture://${fixtureId}`,
    files,
    contentHash: hashFiles(files),
    entryPath: files.some((f) => f.path === "app.js")
      ? assertNormalizedPath("app.js")
      : files.some((f) => f.path === "index.js")
        ? assertNormalizedPath("index.js")
        : undefined,
  });
}

export type PathRiskManifestEntry = {
  path: string;
  content: string;
  symlink?: boolean;
  expectedRejection: string;
};

export type PathRiskManifest = {
  description: string;
  entries: PathRiskManifestEntry[];
};

export function loadPathRiskManifest(): PathRiskManifest {
  const file = path.join(FIXTURES_ROOT, "path-risk", "manifest.json");
  return JSON.parse(readFileSync(file, "utf8")) as PathRiskManifest;
}

export type DoubleFailureFixture = {
  description: string;
  stageKind: string;
  attempts: Array<{
    attempt: 1 | 2;
    operations: FileOperation[];
    expectedValidationFailures: string[];
  }>;
};

export function loadDoubleFailureAiFixture(): DoubleFailureFixture {
  const file = path.join(FIXTURES_ROOT, "ai-responses", "double-failure-stage.json");
  const raw = JSON.parse(readFileSync(file, "utf8")) as {
    description: string;
    stageKind: string;
    attempts: Array<{
      attempt: 1 | 2;
      operations: Array<Record<string, string>>;
      expectedValidationFailures: string[];
    }>;
  };

  return {
    description: raw.description,
    stageKind: raw.stageKind,
    attempts: raw.attempts.map((attempt) => ({
      attempt: attempt.attempt,
      expectedValidationFailures: attempt.expectedValidationFailures,
      operations: attempt.operations.map((op) => {
        if (op.type === "delete") {
          return {
            type: "delete" as const,
            path: op.path as NormalizedPath,
          };
        }
        return {
          type: op.type as "create" | "update",
          path: op.path as NormalizedPath,
          content: op.content ?? "",
        };
      }),
    })),
  };
}

export function fixtureRoot(): string {
  return FIXTURES_ROOT;
}

export function controlledExampleRoot(): string {
  return path.join(FIXTURES_ROOT, "controlled-example");
}

/** True when a directory looks like an installed npm project (for example tests). */
export function fixtureHasNodeModules(fixtureId: FixtureId): boolean {
  return existsSync(path.join(FIXTURES_ROOT, fixtureId, "node_modules"));
}

export function readFixturePackageJson(fixtureId: FixtureId): Record<string, unknown> {
  const file = path.join(FIXTURES_ROOT, fixtureId, "package.json");
  return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
}

export function listFixtureIdsOnDisk(): string[] {
  return readdirSync(FIXTURES_ROOT).filter((name) => {
    const full = path.join(FIXTURES_ROOT, name);
    return statSync(full).isDirectory() && name !== "ai-responses";
  });
}
