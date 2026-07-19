import { describe, expect, it } from "vitest";
import { loadFixtureSnapshot, readFixturePackageJson } from "@/fixtures/load-fixture";
import { assertNormalizedPath } from "@/core/paths";
import {
  createRepositoryFile,
  createSourceSnapshot,
  type PackageManagerEvidence,
} from "@/core/repository";
import { evaluateEligibility } from "./evaluate";

function supportedSnapshotWithPackageManager(
  declaration?: string,
  packageManagerEvidence: readonly PackageManagerEvidence[] = [],
) {
  const base = loadFixtureSnapshot("controlled-example");
  const pkg = {
    ...readFixturePackageJson("controlled-example"),
    ...(declaration === undefined ? {} : { packageManager: declaration }),
  };
  const files = [...base.files.values()].map((file) =>
    file.path === "package.json"
      ? createRepositoryFile(assertNormalizedPath("package.json"), JSON.stringify(pkg))
      : file,
  );
  return createSourceSnapshot({
    snapshotId: "package-manager-contract",
    sourceLabel: base.sourceLabel,
    files,
    packageManagerEvidence,
    entryPath: base.entryPath,
  });
}

describe("evaluateEligibility", () => {
  it("accepts the controlled example", () => {
    const snapshot = loadFixtureSnapshot("controlled-example");
    const result = evaluateEligibility(snapshot);
    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.entryPath).toBe("app.js");
      expect(result.framework).toBe("express");
      expect(result.persistence).toBe("mongoose");
    }
  });

  it("rejects ESM with a stable reason code", () => {
    const snapshot = loadFixtureSnapshot("unsupported-esm");
    const result = evaluateEligibility(snapshot);
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.rejections.map((r) => r.code)).toContain("ELIGIBILITY_ESM_MODULE");
    }
  });

  it("rejects missing mongoose", () => {
    const snapshot = loadFixtureSnapshot("missing-mongoose");
    const result = evaluateEligibility(snapshot);
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.rejections.map((r) => r.code)).toContain("ELIGIBILITY_MISSING_MONGOOSE");
    }
  });

  it("defaults to npm when no package-manager evidence is present", () => {
    const result = evaluateEligibility(supportedSnapshotWithPackageManager());

    expect(result).toMatchObject({
      eligible: true,
      packageManager: "npm",
      packageManagerEvidence: [
        expect.objectContaining({ ruleId: "ELIGIBILITY_PACKAGE_MANAGER_NPM_DEFAULT" }),
      ],
    });
  });

  it.each([
    ["pnpm@9.0.0", "pnpm"],
    ["bun@1.2.0", "bun"],
    ["composer@2.8.0", "unknown"],
    ["custom-manager@1.0.0", "unknown"],
  ])("rejects %s declarations deterministically", (declaration, detected) => {
    const result = evaluateEligibility(supportedSnapshotWithPackageManager(declaration));

    expect(result).toMatchObject({
      eligible: false,
      rejections: [
        expect.objectContaining({
          code: "ELIGIBILITY_UNSUPPORTED_PACKAGE_MANAGER",
          message: `Only single-root npm projects are supported; detected ${detected}`,
        }),
      ],
    });
  });

  it("rejects declaration and lockfile conflicts as ambiguous", () => {
    const result = evaluateEligibility(
      supportedSnapshotWithPackageManager("npm@10.0.0", [
        { path: assertNormalizedPath("bun.lock"), manager: "bun" },
      ]),
    );

    expect(result).toMatchObject({
      eligible: false,
      rejections: [
        expect.objectContaining({
          code: "ELIGIBILITY_UNSUPPORTED_PACKAGE_MANAGER",
          message: "Ambiguous package-manager evidence: bun, npm",
        }),
      ],
    });
  });

  it("accepts npm lockfile evidence without retaining lockfile source", () => {
    const snapshot = loadFixtureSnapshot("controlled-example");
    expect(snapshot.files.has("package-lock.json" as never)).toBe(false);
    expect(snapshot.packageManagerEvidence).toEqual([
      { path: "package-lock.json", manager: "npm" },
    ]);

    const result = evaluateEligibility(snapshot);
    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.packageManager).toBe("npm");
      expect(result.packageManagerEvidence).toEqual([
        expect.objectContaining({
          ruleId: "ELIGIBILITY_PACKAGE_MANAGER_NPM_LOCKFILE",
          file: "package-lock.json",
          snippet: "[lockfile content omitted]",
        }),
      ]);
    }
  });

  it("rejects a supported fixture with unsupported yarn evidence", () => {
    const snapshot = loadFixtureSnapshot("unsupported-package-manager");
    const result = evaluateEligibility(snapshot);

    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.rejections).toContainEqual(
        expect.objectContaining({
          code: "ELIGIBILITY_UNSUPPORTED_PACKAGE_MANAGER",
          message: expect.stringContaining("detected yarn"),
          evidence: [
            expect.objectContaining({
              ruleId: "ELIGIBILITY_PACKAGE_MANAGER_YARN_LOCKFILE",
              file: "yarn.lock",
              snippet: "[lockfile content omitted]",
            }),
          ],
        }),
      );
    }
  });

  it("rejects ambiguous npm and yarn lockfile evidence deterministically", () => {
    const snapshot = loadFixtureSnapshot("ambiguous-package-manager");
    const result = evaluateEligibility(snapshot);

    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.rejections).toContainEqual(
        expect.objectContaining({
          code: "ELIGIBILITY_UNSUPPORTED_PACKAGE_MANAGER",
          message: "Ambiguous package-manager evidence: npm, yarn",
          evidence: [
            expect.objectContaining({
              ruleId: "ELIGIBILITY_PACKAGE_MANAGER_NPM_LOCKFILE",
              file: "package-lock.json",
            }),
            expect.objectContaining({
              ruleId: "ELIGIBILITY_PACKAGE_MANAGER_YARN_LOCKFILE",
              file: "yarn.lock",
            }),
          ],
        }),
      );
    }
  });

  it("accepts no-ready-candidate for eligibility (readiness is separate)", () => {
    const snapshot = loadFixtureSnapshot("no-ready-candidate");
    const result = evaluateEligibility(snapshot);
    expect(result.eligible).toBe(true);
  });
});
