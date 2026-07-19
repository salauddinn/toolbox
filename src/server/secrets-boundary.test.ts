import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SECRET_ENV_KEYS } from "./env";
import { materializeEntries } from "./github/extract";

const SRC_ROOT = path.join(__dirname, "..");

function walkTsFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walkTsFiles(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      files.push(full);
    }
  }
  return files;
}

describe("client secret boundary", () => {
  it("does not import server env from client or shared app modules", () => {
    const appDir = path.join(SRC_ROOT, "app");
    const appFiles = walkTsFiles(appDir).filter(
      (file) => !file.includes(`${path.sep}api${path.sep}`),
    );

    for (const file of appFiles) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/from\s+["']@\/server\/env["']/);
      expect(source, file).not.toMatch(/from\s+["']\.\.\/server\/env["']/);
      for (const key of SECRET_ENV_KEYS) {
        expect(source, `${file} must not hard-code ${key}`).not.toContain(key);
      }
    }
  });

  it("never exposes secrets through NEXT_PUBLIC_ prefixes in source", () => {
    const files = walkTsFiles(SRC_ROOT);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/NEXT_PUBLIC_AI_/);
      expect(source, file).not.toMatch(/NEXT_PUBLIC_GITHUB_/);
    }
  });

  it("retains package-manager names without retaining untrusted lockfile content", () => {
    const secret = "registry-token=not-for-analysis-or-prompts";
    const result = materializeEntries([
      {
        headerPath: "owner-repo/package-lock.json",
        type: "file",
        size: Buffer.byteLength(secret),
        content: Buffer.from(secret),
      },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.packageManagerEvidence).toEqual([
        { path: "package-lock.json", manager: "npm" },
      ]);
      expect(JSON.stringify(result)).not.toContain(secret);
    }
  });
});
