import type { EligibilityRejection, EligibilityResult } from "@/core/eligibility";
import type { Evidence } from "@/core/evidence";
import { assertNormalizedPath, type NormalizedPath } from "@/core/paths";
import type { PackageManagerEvidence, RepositoryFile, SourceSnapshot } from "@/core/repository";
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
  packageManager?: string;
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

type DetectedPackageManager = PackageManagerEvidence["manager"] | "unknown";

function declaredPackageManager(pkg: PackageJson): DetectedPackageManager | null {
  if (typeof pkg.packageManager !== "string" || pkg.packageManager.trim() === "") {
    return null;
  }
  const name = pkg.packageManager.trim().split("@", 1)[0]?.toLowerCase();
  if (name === "npm" || name === "yarn" || name === "pnpm" || name === "bun") {
    return name;
  }
  return "unknown";
}

function packageManagerEvidenceForLockfile(lockfile: PackageManagerEvidence): Evidence {
  return evidence(
    `ELIGIBILITY_PACKAGE_MANAGER_${lockfile.manager.toUpperCase()}_LOCKFILE`,
    `${lockfile.manager} package-manager evidence: ${lockfile.path}`,
    lockfile.path,
    1,
    "[lockfile content omitted]",
    "info",
  );
}

function packageManagerEvidenceForDeclaration(
  pkgFile: RepositoryFile,
  manager: DetectedPackageManager,
): Evidence {
  return evidence(
    "ELIGIBILITY_PACKAGE_MANAGER_DECLARATION",
    `Declared package manager: ${manager}`,
    assertNormalizedPath("package.json"),
    1,
    `packageManager: ${String(parsePackageJson(pkgFile.content)?.packageManager ?? "")}`,
    "info",
  );
}

function evaluatePackageManager(
  pkg: PackageJson,
  pkgFile: RepositoryFile,
  lockfiles: readonly PackageManagerEvidence[],
): { ok: true; evidence: Evidence[] } | { ok: false; message: string; evidence: Evidence[] } {
  const declaration = declaredPackageManager(pkg);
  const detected = new Set<DetectedPackageManager>(lockfiles.map((lockfile) => lockfile.manager));
  if (declaration) {
    detected.add(declaration);
  }

  const lockfileEvidence = lockfiles.map(packageManagerEvidenceForLockfile);
  const declarationEvidence = declaration
    ? [packageManagerEvidenceForDeclaration(pkgFile, declaration)]
    : [];
  const managerEvidence = [...lockfileEvidence, ...declarationEvidence];

  if (detected.size === 0) {
    return {
      ok: true,
      evidence: [
        evidence(
          "ELIGIBILITY_PACKAGE_MANAGER_NPM_DEFAULT",
          "No package-manager lockfile or declaration; applying the npm-only repository contract",
          assertNormalizedPath("package.json"),
          1,
          "[no package-manager lockfile]",
          "info",
        ),
      ],
    };
  }

  if (detected.size === 1 && detected.has("npm")) {
    return { ok: true, evidence: managerEvidence };
  }

  const managers = [...detected].sort();
  if (managers.length > 1) {
    return {
      ok: false,
      message: `Ambiguous package-manager evidence: ${managers.join(", ")}`,
      evidence: managerEvidence,
    };
  }

  return {
    ok: false,
    message: `Only single-root npm projects are supported; detected ${managers[0]}`,
    evidence: managerEvidence,
  };
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

  const packageManager = evaluatePackageManager(pkg, pkgFile, snapshot.packageManagerEvidence);
  if (detectMonorepo(pkg, files)) {
    rejections.push(
      reject(
        "ELIGIBILITY_MONOREPO_OR_MULTI_ROOT",
        "Monorepos and multiple application roots are not supported",
        [
          evidence(
            "ELIGIBILITY_MONOREPO_OR_MULTI_ROOT",
            "Unsupported package layout",
            assertNormalizedPath("package.json"),
            1,
            pkgFile.content.slice(0, 160),
          ),
        ],
      ),
    );
  } else if (!packageManager.ok) {
    rejections.push(
      reject(
        "ELIGIBILITY_UNSUPPORTED_PACKAGE_MANAGER",
        packageManager.message,
        packageManager.evidence,
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
    packageManagerEvidence: packageManager.evidence,
    moduleSystem: "commonjs",
    framework: "express",
    persistence: "mongoose",
    entryPath: entryPath!,
  };
}
