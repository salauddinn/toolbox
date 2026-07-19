import { describe, expect, it } from "vitest";
import { assertNormalizedPath } from "@/core/paths";
import { createRepositoryFile, createSourceSnapshot } from "@/core/repository";
import { applyOperationsToSnapshot } from "./apply";

describe("applyOperationsToSnapshot", () => {
  it.each(
    ["BUN.LOCK", "packages/api/bun.lock"].flatMap((path) => [
      { path, operation: { type: "create" as const, content: "untrusted" } },
      { path, operation: { type: "update" as const, content: "untrusted" } },
      { path, operation: { type: "delete" as const } },
    ]),
  )("rejects $operation.type operations on ignored path $path", ({ path, operation }) => {
    const normalized = assertNormalizedPath(path);
    const result = applyOperationsToSnapshot(
      createSourceSnapshot({
        snapshotId: "base",
        sourceLabel: "fixture://base",
        files: [
          createRepositoryFile(assertNormalizedPath("app.js"), "module.exports = 1;\n"),
          ...(operation.type === "create"
            ? []
            : [createRepositoryFile(normalized, "existing ignored content")]),
        ],
      }),
      [{ ...operation, path: normalized }],
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "IGNORED_PATH_PROTECTED",
        message: `Ignored paths cannot be modified: ${path}`,
        path,
      },
    });
  });

  it("preserves content-free package-manager evidence on candidate snapshots", () => {
    const appPath = assertNormalizedPath("app.js");
    const snapshot = createSourceSnapshot({
      snapshotId: "base",
      sourceLabel: "fixture://base",
      files: [createRepositoryFile(appPath, "module.exports = 1;\n")],
      packageManagerEvidence: [{ path: assertNormalizedPath("package-lock.json"), manager: "npm" }],
    });

    const result = applyOperationsToSnapshot(snapshot, [
      { type: "update", path: appPath, content: "module.exports = 2;\n" },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.packageManagerEvidence).toEqual([
        { path: "package-lock.json", manager: "npm" },
      ]);
      expect(result.snapshot.files.has("package-lock.json" as never)).toBe(false);
    }
  });
});
