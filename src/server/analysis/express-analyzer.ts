import type { AnalysisResult } from "@/core/analysis";
import type { CodebaseAnalyzer } from "@/core/analyzer";
import type { EligibilityResult } from "@/core/eligibility";
import { assertNormalizedPath, type NormalizedPath } from "@/core/paths";
import type { RepositoryFile } from "@/core/repository";
import { evaluateEligibility } from "@/server/eligibility/evaluate";
import { createSourceSnapshot } from "@/core/repository";
import { hashRepositoryFiles } from "@/server/snapshot/hash";
import { buildDependencyGraph, resolveRelativeRequire } from "./graph";
import { detectFindings, collectEvidence } from "./findings";
import { applyMountPrefixes, collectNamedRequires, extractRoutes } from "./routes";
import { extractModels } from "./models";

function hasJestSupertest(files: readonly RepositoryFile[]): boolean {
  const pkgFile = files.find((f) => f.path === "package.json");
  if (!pkgFile) return false;
  try {
    const pkg = JSON.parse(pkgFile.content) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const hasJest = Boolean(deps.jest);
    const hasSupertest = Boolean(deps.supertest);
    const testScript = pkg.scripts?.test ?? "";
    const realTest =
      testScript.length > 0 &&
      !/no test harness/i.test(testScript) &&
      !/^echo\b/i.test(testScript.trim());
    return hasJest && hasSupertest && realTest;
  } catch {
    return false;
  }
}

function runtimeFromPackage(files: readonly RepositoryFile[]): AnalysisResult["runtime"] {
  const pkgFile = files.find((f) => f.path === "package.json");
  if (!pkgFile) return {};
  try {
    const pkg = JSON.parse(pkgFile.content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      engines?: { node?: string };
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return {
      nodeRange: pkg.engines?.node,
      expressVersion: deps.express,
      mongooseVersion: deps.mongoose,
    };
  } catch {
    return {};
  }
}

/**
 * Sole MVP CodebaseAnalyzer implementation.
 */
export class ExpressAnalyzer implements CodebaseAnalyzer {
  readonly id = "express-mongoose-commonjs";

  supports(files: readonly RepositoryFile[]): EligibilityResult {
    const snapshot = createSourceSnapshot({
      snapshotId: "supports-check",
      sourceLabel: "supports-check",
      files,
      contentHash: hashRepositoryFiles(files),
    });
    return evaluateEligibility(snapshot);
  }

  async analyze(files: readonly RepositoryFile[]): Promise<AnalysisResult> {
    const eligibility = this.supports(files);
    if (!eligibility.eligible) {
      throw new Error(
        `Cannot analyze ineligible repository: ${eligibility.rejections.map((r) => r.code).join(", ")}`,
      );
    }

    const entryPath = assertNormalizedPath(eligibility.entryPath);
    const jsFiles = files.filter((f) => f.path.endsWith(".js") || f.path === "package.json");
    const fileSet = new Set(files.filter((f) => f.path.endsWith(".js")).map((f) => f.path));

    const graph = buildDependencyGraph(files, entryPath);
    const routeExtraction = extractRoutes(files);
    const modelExtraction = extractModels(files);

    const entryFile = files.find((f) => f.path === entryPath);
    const requireMap = entryFile
      ? collectNamedRequires(entryFile, (from, request) =>
          resolveRelativeRequire(from, request, fileSet),
        )
      : new Map<string, string>();

    const routes = applyMountPrefixes(routeExtraction.routes, routeExtraction.mounts, requireMap);
    const unsupportedSyntax = [
      ...routeExtraction.unsupported.map(({ routerBinding, ...syntax }) => {
        const related = routerBinding ? requireMap.get(routerBinding) : undefined;
        return related ? { ...syntax, relatedFiles: [assertNormalizedPath(related)] } : syntax;
      }),
      ...modelExtraction.unsupported,
    ].sort(
      (a, b) =>
        a.file.localeCompare(b.file) ||
        a.line - b.line ||
        a.kind.localeCompare(b.kind) ||
        a.reason.localeCompare(b.reason),
    );

    const findings = detectFindings({
      files,
      routes,
      modelAccess: modelExtraction.access,
      graph,
      hasJestSupertest: hasJestSupertest(files),
    });

    const result: AnalysisResult = {
      runtime: runtimeFromPackage(files),
      entryPath,
      routes,
      models: modelExtraction.models,
      modelAccess: modelExtraction.access,
      unsupportedSyntax,
      graph,
      findings,
      contentHash: hashRepositoryFiles(jsFiles),
      evidence: [],
    };
    result.evidence = collectEvidence(result);
    return result;
  }
}

/** Re-export factory for callers that want a fresh instance. */
export function createExpressAnalyzer(): ExpressAnalyzer {
  return new ExpressAnalyzer();
}

export type { NormalizedPath };
