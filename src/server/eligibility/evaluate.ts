import type { EligibilityRejection, EligibilityResult } from "@/core/eligibility";
import type { Evidence } from "@/core/evidence";
import { assertNormalizedPath, type NormalizedPath } from "@/core/paths";
import type { RepositoryFile, SourceSnapshot } from "@/core/repository";
import { DEFAULT_SNAPSHOT_LIMITS } from "@/core/repository";
import { isAnalyzableSourcePath } from "@/server/github/ignore";

const ENTRY_CANDIDATES = ["app.js", "server.js", "index.js"] as const;

type PackageJson = {
  name?: string;
  type?: string;
  main?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  workspaces?: unknown;
  scripts?: Record<string, string>;
};

function evidence(
  ruleId: string,
  message: string,
  file: NormalizedPath,
  line: number,
  snippet: string,
  severity: Evidence["severity"] = "critical",
): Evidence {
  return { ruleId, message, severity, file, line, snippet };
}

function reject(
  code: EligibilityRejection["code"],
  message: string,
  evidenceList: Evidence[] = [],
): EligibilityRejection {
  return { code, message, evidence: evidenceList };
}

function parsePackageJson(content: string): PackageJson | null {
  try {
    return JSON.parse(content) as PackageJson;
  } catch {
    return null;
  }
}

function hasDep(pkg: PackageJson, name: string): boolean {
  return Boolean(
    pkg.dependencies?.[name] || pkg.devDependencies?.[name] || pkg.peerDependencies?.[name],
  );
}

function fileMap(files: readonly RepositoryFile[]): Map<string, RepositoryFile> {
  return new Map(files.map((f) => [f.path, f]));
}

/**
 * Lightweight route/model presence checks for eligibility.
 * Full extraction lives in ExpressAnalyzer; eligibility only needs evidence of existence.
 */
function hasRouteEvidence(files: readonly RepositoryFile[]): boolean {
  const routeSignal =
    /\b(?:app|router)\.(?:get|post|put|patch|delete|use)\s*\(\s*['"`]|express\.Router\s*\(/;
  return files.some((f) => f.path.endsWith(".js") && routeSignal.test(f.content));
}

function hasModelEvidence(files: readonly RepositoryFile[]): boolean {
  const modelSignal = /mongoose\.model\s*\(|new\s+mongoose\.Schema\s*\(/;
  return files.some((f) => f.path.endsWith(".js") && modelSignal.test(f.content));
}

function hasTypeScriptSource(files: readonly RepositoryFile[]): boolean {
  return files.some(
    (f) =>
      f.path.endsWith(".ts") ||
      f.path.endsWith(".tsx") ||
      f.path.endsWith(".mts") ||
      f.path.endsWith(".cts"),
  );
}

function detectMonorepo(pkg: PackageJson, files: readonly RepositoryFile[]): boolean {
  if (pkg.workspaces !== undefined) {
    return true;
  }
  const packageJsonCount = files.filter(
    (f) => f.path === "package.json" || f.path.endsWith("/package.json"),
  ).length;
  if (packageJsonCount > 1) {
    return true;
  }
  // Nested package.json under packages/ or apps/ is a multi-root signal.
  return files.some(
    (f) =>
      /^packages\/[^/]+\/package\.json$/.test(f.path) ||
      /^apps\/[^/]+\/package\.json$/.test(f.path),
  );
}

function resolveEntryPath(
  pkg: PackageJson,
  files: Map<string, RepositoryFile>,
): NormalizedPath | null {
  const candidates: string[] = [];
  if (typeof pkg.main === "string" && pkg.main.endsWith(".js")) {
    candidates.push(pkg.main.replace(/^\.\//, ""));
  }
  for (const name of ENTRY_CANDIDATES) {
    candidates.push(name);
  }
  for (const candidate of candidates) {
    const normalized = candidate.replace(/^\.\//, "");
    if (files.has(normalized)) {
      return assertNormalizedPath(normalized);
    }
  }
  return null;
}

function hasLockfileConflict(files: readonly RepositoryFile[]): boolean {
  const names = new Set<string>(files.map((f) => f.path as string));
  // We ignore lockfiles during extract; detect monorepo package managers via package fields only.
  // Presence of yarn/pnpm config files still signals non-npm primary workflows.
  return (
    names.has("yarn.lock") ||
    names.has("pnpm-lock.yaml") ||
    names.has("pnpm-workspace.yaml") ||
    files.some((f) => f.path === ".yarnrc.yml" || f.path === "bun.lockb")
  );
}

/**
 * Deterministic repository eligibility (separate from Transformation Readiness).
 */
export function evaluateEligibility(snapshot: SourceSnapshot): EligibilityResult {
  const files = [...snapshot.files.values()];
  const byPath = fileMap(files);
  const rejections: EligibilityRejection[] = [];

  const pkgFile = byPath.get("package.json");
  if (!pkgFile) {
    rejections.push(
      reject(
        "ELIGIBILITY_MISSING_PACKAGE_JSON",
        "Root package.json is required for a single-root npm application",
      ),
    );
    return { eligible: false, rejections };
  }

  const pkg = parsePackageJson(pkgFile.content);
  if (!pkg) {
    rejections.push(
      reject("ELIGIBILITY_MISSING_PACKAGE_JSON", "Root package.json is not valid JSON", [
        evidence(
          "ELIGIBILITY_MISSING_PACKAGE_JSON",
          "Invalid JSON",
          assertNormalizedPath("package.json"),
          1,
          pkgFile.content.slice(0, 120),
        ),
      ]),
    );
    return { eligible: false, rejections };
  }

  if (pkg.type === "module") {
    rejections.push(
      reject(
        "ELIGIBILITY_ESM_MODULE",
        'package.json sets "type": "module"; only CommonJS is supported',
        [
          evidence(
            "ELIGIBILITY_ESM_MODULE",
            "Unsupported ESM module system",
            assertNormalizedPath("package.json"),
            1,
            '"type": "module"',
          ),
        ],
      ),
    );
  }

  if (hasLockfileConflict(files) || detectMonorepo(pkg, files)) {
    rejections.push(
      reject(
        detectMonorepo(pkg, files)
          ? "ELIGIBILITY_MONOREPO_OR_MULTI_ROOT"
          : "ELIGIBILITY_UNSUPPORTED_PACKAGE_MANAGER",
        detectMonorepo(pkg, files)
          ? "Monorepos and multiple application roots are not supported"
          : "Only single-root npm projects are supported",
        [
          evidence(
            "ELIGIBILITY_UNSUPPORTED_PACKAGE_MANAGER",
            "Unsupported package layout",
            assertNormalizedPath("package.json"),
            1,
            pkgFile.content.slice(0, 160),
          ),
        ],
      ),
    );
  }

  if (!hasDep(pkg, "express")) {
    rejections.push(
      reject("ELIGIBILITY_MISSING_EXPRESS", "package.json must declare express", [
        evidence(
          "ELIGIBILITY_MISSING_EXPRESS",
          "express dependency missing",
          assertNormalizedPath("package.json"),
          1,
          JSON.stringify(pkg.dependencies ?? {}),
        ),
      ]),
    );
  }

  if (!hasDep(pkg, "mongoose")) {
    rejections.push(
      reject("ELIGIBILITY_MISSING_MONGOOSE", "package.json must declare mongoose", [
        evidence(
          "ELIGIBILITY_MISSING_MONGOOSE",
          "mongoose dependency missing",
          assertNormalizedPath("package.json"),
          1,
          JSON.stringify(pkg.dependencies ?? {}),
        ),
      ]),
    );
  }

  if (hasTypeScriptSource(files)) {
    const tsFile = files.find((f) => f.path.endsWith(".ts") || f.path.endsWith(".tsx"));
    rejections.push(
      reject(
        "ELIGIBILITY_TYPESCRIPT_SOURCE",
        "TypeScript source is not supported in the MVP",
        tsFile
          ? [
              evidence(
                "ELIGIBILITY_TYPESCRIPT_SOURCE",
                "TypeScript file present",
                assertNormalizedPath(tsFile.path),
                1,
                tsFile.content.slice(0, 80),
              ),
            ]
          : [],
      ),
    );
  }

  const analyzable = files.filter((f) => isAnalyzableSourcePath(f.path));
  const jsFiles = analyzable.filter((f) => f.path.endsWith(".js"));
  const sourceBytes = jsFiles.reduce((sum, f) => sum + f.sizeBytes, 0);

  if (jsFiles.length > DEFAULT_SNAPSHOT_LIMITS.maxAnalyzedFiles) {
    rejections.push(
      reject(
        "ELIGIBILITY_TOO_MANY_FILES",
        `Analyzed source exceeds ${DEFAULT_SNAPSHOT_LIMITS.maxAnalyzedFiles} files`,
      ),
    );
  }
  if (sourceBytes > DEFAULT_SNAPSHOT_LIMITS.maxAnalyzedSourceBytes) {
    rejections.push(
      reject(
        "ELIGIBILITY_SOURCE_TOO_LARGE",
        `Analyzed source exceeds ${DEFAULT_SNAPSHOT_LIMITS.maxAnalyzedSourceBytes} bytes`,
      ),
    );
  }

  const entryPath = resolveEntryPath(pkg, byPath);
  if (!entryPath) {
    rejections.push(
      reject(
        "ELIGIBILITY_MISSING_ENTRY",
        "No recognizable Express entry point (app.js, server.js, index.js, or package.json main)",
        [
          evidence(
            "ELIGIBILITY_MISSING_ENTRY",
            "Entry not found",
            assertNormalizedPath("package.json"),
            1,
            String(pkg.main ?? ""),
          ),
        ],
      ),
    );
  }

  if (!hasRouteEvidence(jsFiles)) {
    rejections.push(
      reject(
        "ELIGIBILITY_MISSING_ROUTE_EVIDENCE",
        "No Express route registration evidence was found",
      ),
    );
  }

  if (!hasModelEvidence(jsFiles)) {
    rejections.push(
      reject("ELIGIBILITY_MISSING_MODEL_EVIDENCE", "No Mongoose model/schema evidence was found"),
    );
  }

  if (rejections.length > 0) {
    return { eligible: false, rejections };
  }

  return {
    eligible: true,
    packageManager: "npm",
    moduleSystem: "commonjs",
    framework: "express",
    persistence: "mongoose",
    entryPath: entryPath!,
  };
}
