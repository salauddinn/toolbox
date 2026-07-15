import { describe, expect, it } from "vitest";
import { materializeEntries, stripGitHubRootPrefix } from "./extract";

describe("stripGitHubRootPrefix", () => {
  it("removes the GitHub tarball top-level directory", () => {
    expect(stripGitHubRootPrefix("owner-repo-sha/app.js")).toBe("app.js");
    expect(stripGitHubRootPrefix("owner-repo-sha/routes/orders.js")).toBe("routes/orders.js");
  });
});

describe("materializeEntries", () => {
  it("accepts normal files and skips ignored paths", () => {
    const result = materializeEntries([
      {
        headerPath: "owner-repo/app.js",
        type: "file",
        size: 10,
        content: Buffer.from("module.exports = {}"),
      },
      {
        headerPath: "owner-repo/node_modules/x/index.js",
        type: "file",
        size: 10,
        content: Buffer.from("ignored"),
      },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.files.map((f) => f.path)).toEqual(["app.js"]);
      expect(result.skippedIgnored).toBe(1);
    }
  });

  it("rejects traversal, symlinks, and path collisions", () => {
    expect(
      materializeEntries([
        {
          headerPath: "owner-repo/../escape.js",
          type: "file",
          size: 1,
          content: Buffer.from("x"),
        },
      ]).ok,
    ).toBe(false);

    expect(
      materializeEntries([
        {
          headerPath: "owner-repo/link.js",
          type: "symlink",
          size: 0,
          linkname: "app.js",
          content: Buffer.alloc(0),
        },
      ]).ok,
    ).toBe(false);

    const collision = materializeEntries([
      {
        headerPath: "owner-repo/a.js",
        type: "file",
        size: 1,
        content: Buffer.from("one"),
      },
      {
        headerPath: "owner-repo/./a.js",
        type: "file",
        size: 1,
        content: Buffer.from("two"),
      },
    ]);
    expect(collision.ok).toBe(false);
    if (!collision.ok) {
      expect(collision.rejection.code).toBe("SAFETY_NORMALIZED_PATH_COLLISION");
    }
  });
});
