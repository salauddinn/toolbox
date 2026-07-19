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

  it("retains root lockfile names as content-free package-manager evidence", () => {
    const result = materializeEntries([
      {
        headerPath: "owner-repo/package-lock.json",
        type: "file",
        size: 41,
        content: Buffer.from('{"private":"untrusted-lockfile-content"}'),
      },
      {
        headerPath: "owner-repo/app.js",
        type: "file",
        size: 20,
        content: Buffer.from("module.exports = {}"),
      },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.files.map((file) => file.path)).toEqual(["app.js"]);
      expect(result.packageManagerEvidence).toEqual([
        { path: "package-lock.json", manager: "npm" },
      ]);
      expect(JSON.stringify(result)).not.toContain("untrusted-lockfile-content");
      expect(result.skippedIgnored).toBe(1);
    }
  });

  it("retains the current Bun lockfile as content-free root evidence", () => {
    const secret = "bun-lock-content-must-not-survive";
    const result = materializeEntries([
      {
        headerPath: "owner-repo/BUN.LOCK",
        type: "file",
        size: Buffer.byteLength(secret),
        content: Buffer.from(secret),
      },
      {
        headerPath: "owner-repo/packages/api/bun.lock",
        type: "file",
        size: 1,
        content: Buffer.from("x"),
      },
      {
        headerPath: "owner-repo/./BUN.LOCK",
        type: "file",
        size: Buffer.byteLength(secret),
        content: Buffer.from(secret),
      },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.files).toEqual([]);
      expect(result.packageManagerEvidence).toEqual([{ path: "BUN.LOCK", manager: "bun" }]);
      expect(result.skippedIgnored).toBe(3);
      expect(JSON.stringify(result)).not.toContain(secret);
    }
  });

  it("rejects differing normalized duplicates before ignored lockfile filtering", () => {
    const firstSecret = "first-lock-content-must-not-survive";
    const secondSecret = "second-lock-content-must-not-survive";
    const result = materializeEntries([
      {
        headerPath: "owner-repo/package-lock.json",
        type: "file",
        size: Buffer.byteLength(firstSecret),
        content: Buffer.from(firstSecret),
      },
      {
        headerPath: "owner-repo/./package-lock.json",
        type: "file",
        size: Buffer.byteLength(secondSecret),
        content: Buffer.from(secondSecret),
      },
    ]);

    expect(result).toEqual({
      ok: false,
      rejection: {
        code: "SAFETY_NORMALIZED_PATH_COLLISION",
        message: "Normalized path collision with differing content",
        path: "package-lock.json",
      },
    });
    expect(JSON.stringify(result)).not.toContain(firstSecret);
    expect(JSON.stringify(result)).not.toContain(secondSecret);
  });

  it("keeps package-manager config content out of source snapshots", () => {
    const secret = "yarn-registry-token-must-not-survive";
    const result = materializeEntries([
      {
        headerPath: "owner-repo/.yarnrc.yml",
        type: "file",
        size: Buffer.byteLength(secret),
        content: Buffer.from(secret),
      },
    ]);

    expect(result).toEqual({
      ok: true,
      files: [],
      packageManagerEvidence: [{ path: ".yarnrc.yml", manager: "yarn" }],
      skippedIgnored: 1,
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("keeps lockfile paths subject to archive path safety", () => {
    const result = materializeEntries([
      {
        headerPath: "owner-repo/../../package-lock.json",
        type: "file",
        size: 1,
        content: Buffer.from("x"),
      },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejection.code).toBe("SAFETY_PATH_TRAVERSAL");
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
