import { describe, expect, it } from "vitest";
import { normalizeRepositoryPath } from "@/core/paths";
import {
  loadDoubleFailureAiFixture,
  loadFixtureSnapshot,
  loadPathRiskManifest,
  readFixturePackageJson,
} from "./load-fixture";

describe("fixture loaders", () => {
  it("loads the controlled example into a SourceSnapshot", () => {
    const snapshot = loadFixtureSnapshot("controlled-example");
    expect(snapshot.sourceLabel).toBe("fixture://controlled-example");
    expect(snapshot.files.has("package.json" as never) || snapshot.files.size > 0).toBe(true);
    expect(snapshot.files.get("app.js" as never)?.content).toContain("express");
    expect(snapshot.files.get("routes/orders.js" as never)?.content).toContain(
      'require("./payments")',
    );
    expect(snapshot.files.get("routes/payments.js" as never)?.content).toContain(
      'require("./orders")',
    );
    expect(snapshot.files.get("models/Order.js" as never)?.content).toContain("mongoose");
    expect(snapshot.contentHash.length).toBeGreaterThan(10);
  });

  it("uses shared ignore and evidence predicates for uppercase lockfile names", () => {
    const snapshot = loadFixtureSnapshot("unsupported-syntax");

    expect(snapshot.files.has("BUN.LOCK" as never)).toBe(false);
    expect(snapshot.packageManagerEvidence).toContainEqual({ path: "BUN.LOCK", manager: "bun" });
    expect(JSON.stringify(snapshot)).not.toContain("untrusted-upper-case-bun-lock-content");
  });

  it("loads unsupported ESM fixture with type module", () => {
    const pkg = readFixturePackageJson("unsupported-esm");
    expect(pkg.type).toBe("module");
    const snapshot = loadFixtureSnapshot("unsupported-esm");
    expect(snapshot.files.get("index.js" as never)?.content).toContain("import express");
  });

  it("loads missing-mongoose without mongoose dependency", () => {
    const pkg = readFixturePackageJson("missing-mongoose");
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps.express).toBeDefined();
    expect(deps.mongoose).toBeUndefined();
  });

  it("exposes path-risk entries for Safety Screening", () => {
    const manifest = loadPathRiskManifest();
    expect(manifest.entries.length).toBeGreaterThanOrEqual(3);
    for (const entry of manifest.entries) {
      if (entry.path.includes("..") || entry.path.startsWith("/")) {
        expect(normalizeRepositoryPath(entry.path).ok).toBe(false);
      }
    }
    expect(manifest.entries.some((e) => e.expectedRejection === "SAFETY_SENSITIVE_FILE")).toBe(
      true,
    );
  });

  it("loads no-ready-candidate without a real test harness", () => {
    const pkg = readFixturePackageJson("no-ready-candidate");
    const scripts = pkg.scripts as Record<string, string>;
    expect(scripts.test).toMatch(/no test harness/i);
    const deps = {
      ...(pkg.dependencies as object),
      ...(pkg.devDependencies as object),
    } as Record<string, string>;
    expect(deps.jest).toBeUndefined();
    expect(deps.supertest).toBeUndefined();
  });

  it("loads double-failure AI fixture with two invalid attempts", () => {
    const fixture = loadDoubleFailureAiFixture();
    expect(fixture.attempts).toHaveLength(2);
    expect(fixture.attempts[0]?.attempt).toBe(1);
    expect(fixture.attempts[1]?.attempt).toBe(2);
    expect(fixture.attempts[0]?.operations.some((op) => op.path.includes("package.json"))).toBe(
      true,
    );
    expect(fixture.attempts[1]?.operations.some((op) => op.type === "delete")).toBe(true);
    for (const attempt of fixture.attempts) {
      expect(attempt.expectedValidationFailures.length).toBeGreaterThan(0);
    }
  });
});
