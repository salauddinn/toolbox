import type { AnalysisResult } from "@/core/analysis";
import type { DomainCandidate } from "@/core/candidates";
import type { Evidence } from "@/core/evidence";
import {
  buildTransformationReadiness,
  type ReadinessRuleId,
  type ReadinessRuleResult,
  type TransformationReadiness,
} from "@/core/readiness";
import type { RepositoryFile } from "@/core/repository";
import { assertNormalizedPath } from "@/core/paths";

function rule(
  ruleId: ReadinessRuleId,
  passed: boolean,
  summary: string,
  evidence: Evidence[] = [],
): ReadinessRuleResult {
  return { ruleId, passed, summary, evidence };
}

function ev(
  ruleId: string,
  message: string,
  file: string,
  line: number,
  snippet: string,
  severity: Evidence["severity"] = "critical",
): Evidence {
  return {
    ruleId,
    message,
    severity,
    file: assertNormalizedPath(file),
    line,
    snippet: snippet.slice(0, 200),
  };
}

function hasJestSupertestHarness(files: readonly RepositoryFile[]): {
  ok: boolean;
  evidence: Evidence[];
} {
  const pkgFile = files.find((f) => f.path === "package.json");
  if (!pkgFile) {
    return {
      ok: false,
      evidence: [
        ev("READINESS_EXISTING_TEST_HARNESS", "package.json missing", "package.json", 1, ""),
      ],
    };
  }
  try {
    const pkg = JSON.parse(pkgFile.content) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const testScript = pkg.scripts?.test ?? "";
    const hasJest = Boolean(deps.jest);
    const hasSupertest = Boolean(deps.supertest);
    const realTest =
      testScript.length > 0 &&
      !/no test harness/i.test(testScript) &&
      !/^echo\b/i.test(testScript.trim());
    const ok = hasJest && hasSupertest && realTest;
    return {
      ok,
      evidence: ok
        ? [
            ev(
              "READINESS_EXISTING_TEST_HARNESS",
              "Jest and Supertest available via npm test",
              "package.json",
              1,
              testScript,
              "info",
            ),
          ]
        : [
            ev(
              "READINESS_EXISTING_TEST_HARNESS",
              "CommonJS Jest/Supertest harness with real npm test is required",
              "package.json",
              1,
              JSON.stringify({ test: testScript, jest: deps.jest, supertest: deps.supertest }),
            ),
          ],
    };
  } catch {
    return {
      ok: false,
      evidence: [
        ev("READINESS_EXISTING_TEST_HARNESS", "Invalid package.json", "package.json", 1, ""),
      ],
    };
  }
}

/**
 * Evaluate every deterministic Transformation Readiness rule for a candidate.
 * AI cannot waive failures (ADR-0010).
 */
export function evaluateCandidateReadiness(
  candidate: DomainCandidate,
  analysis: AnalysisResult,
  files: readonly RepositoryFile[],
): TransformationReadiness {
  const candidateFiles = new Set(candidate.files);
  const rules: ReadinessRuleResult[] = [];

  // Stable route group with path prefix
  const routes = candidate.routes;
  const hasStableRoutes =
    routes.length > 0 && routes.every((r) => typeof r.path === "string" && r.path.length > 0);
  const prefixes = new Set(
    routes.map((r) => r.mountPrefix ?? r.path.split("/").filter(Boolean)[0] ?? r.path),
  );
  rules.push(
    rule(
      "READINESS_STABLE_ROUTE_GROUP",
      hasStableRoutes && prefixes.size >= 1,
      hasStableRoutes
        ? `Stable route group with ${routes.length} route(s)`
        : "No stable Express route group with path prefix",
      routes
        .slice(0, 3)
        .map((r) =>
          ev(
            "READINESS_STABLE_ROUTE_GROUP",
            `${r.method.toUpperCase()} ${r.path}`,
            r.file,
            r.line,
            r.path,
            "info",
          ),
        ),
    ),
  );

  // Exactly one writable primary model
  const writeModels = new Set(
    analysis.modelAccess
      .filter((a) => a.kind === "write" && candidateFiles.has(a.file))
      .map((a) => a.modelName),
  );
  // Prefer models declared in candidate files
  const candidateModelNames = new Set(
    analysis.models.filter((m) => candidateFiles.has(m.file)).map((m) => m.modelName),
  );
  for (const name of candidateModelNames) {
    if (
      analysis.modelAccess.some(
        (a) => a.kind === "write" && a.modelName === name && candidateFiles.has(a.file),
      )
    ) {
      writeModels.add(name);
    }
  }

  const writable = [...writeModels];
  const singlePrimary = writable.length === 1;
  const primaryModel = singlePrimary ? writable[0]! : candidate.primaryModel?.modelName;
  rules.push(
    rule(
      "READINESS_SINGLE_WRITABLE_PRIMARY_MODEL",
      singlePrimary,
      singlePrimary
        ? `Primary writable model: ${primaryModel}`
        : `Expected exactly one writable primary model, found ${writable.length}`,
      writable.slice(0, 3).map((name) => {
        const access = analysis.modelAccess.find((a) => a.modelName === name && a.kind === "write");
        return ev(
          "READINESS_SINGLE_WRITABLE_PRIMARY_MODEL",
          `Writable model ${name}`,
          access?.file ?? candidate.files[0] ?? "package.json",
          access?.line ?? 1,
          name,
          singlePrimary ? "info" : "critical",
        );
      }),
    ),
  );

  // Exclusive write ownership
  let exclusive = true;
  const exclusiveEvidence: Evidence[] = [];
  if (primaryModel) {
    const writers = analysis.modelAccess.filter(
      (a) => a.kind === "write" && a.modelName === primaryModel,
    );
    for (const w of writers) {
      if (!candidateFiles.has(w.file)) {
        exclusive = false;
        exclusiveEvidence.push(
          ev(
            "READINESS_EXCLUSIVE_WRITE_OWNERSHIP",
            `Competing write to ${primaryModel}`,
            w.file,
            w.line,
            `${primaryModel}.${w.methodName}`,
          ),
        );
      }
    }
  } else {
    exclusive = false;
  }
  rules.push(
    rule(
      "READINESS_EXCLUSIVE_WRITE_OWNERSHIP",
      exclusive && singlePrimary,
      exclusive && singlePrimary
        ? "Candidate has exclusive Write Ownership of its primary model"
        : "Competing writes or missing primary model prevent exclusive ownership",
      exclusiveEvidence,
    ),
  );

  // No direct access to another domain's model
  const foreignAccess = analysis.modelAccess.filter((a) => {
    if (!candidateFiles.has(a.file)) return false;
    if (!primaryModel) return false;
    return a.modelName !== primaryModel && !candidateModelNames.has(a.modelName);
  });
  // Also: candidate files accessing models not owned by this candidate
  const ownedModels = new Set(writable);
  if (primaryModel) ownedModels.add(primaryModel);
  for (const name of candidateModelNames) ownedModels.add(name);

  const foreign = analysis.modelAccess.filter(
    (a) => candidateFiles.has(a.file) && !ownedModels.has(a.modelName),
  );
  rules.push(
    rule(
      "READINESS_NO_FOREIGN_MODEL_ACCESS",
      foreign.length === 0,
      foreign.length === 0
        ? "Candidate does not access foreign Mongoose models"
        : "Candidate directly accesses another domain's Mongoose model",
      foreign
        .slice(0, 5)
        .map((a) =>
          ev(
            "READINESS_NO_FOREIGN_MODEL_ACCESS",
            `${a.kind} access to foreign model ${a.modelName}`,
            a.file,
            a.line,
            `${a.modelName}.${a.methodName}`,
          ),
        ),
    ),
  );

  // Existing test harness
  const harness = hasJestSupertestHarness(files);
  rules.push(
    rule(
      "READINESS_EXISTING_TEST_HARNESS",
      harness.ok,
      harness.ok
        ? "CommonJS Jest/Supertest harness available through npm test"
        : "Missing CommonJS Jest/Supertest harness available through npm test",
      harness.evidence,
    ),
  );

  // Static routes
  const staticRoutes = routes.every((r) => !r.path.includes("${") && r.path.startsWith("/"));
  rules.push(
    rule(
      "READINESS_STATIC_ROUTES",
      routes.length > 0 && staticRoutes,
      staticRoutes && routes.length > 0
        ? "Route paths and methods are statically extractable"
        : "Route paths are not statically extractable",
      routes
        .slice(0, 2)
        .map((r) =>
          ev("READINESS_STATIC_ROUTES", `${r.method} ${r.path}`, r.file, r.line, r.path, "info"),
        ),
    ),
  );

  // No dynamic loading in candidate files
  let dynamicOk = true;
  const dynamicEvidence: Evidence[] = [];
  for (const file of files) {
    if (!candidateFiles.has(file.path)) continue;
    if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(file.content)) {
      dynamicOk = false;
      dynamicEvidence.push(
        ev("READINESS_NO_DYNAMIC_LOADING", "eval/Function detected", file.path, 1, "eval/Function"),
      );
    }
    if (/require\s*\(\s*[^'"`)]/.test(file.content)) {
      // crude: flag non-literal require
      const match = /require\s*\(\s*([^)]+)\)/.exec(file.content);
      if (match && match[1] && !/^['"`]/.test(match[1].trim())) {
        dynamicOk = false;
        dynamicEvidence.push(
          ev("READINESS_NO_DYNAMIC_LOADING", "Dynamic require detected", file.path, 1, match[0]),
        );
      }
    }
  }
  rules.push(
    rule(
      "READINESS_NO_DYNAMIC_LOADING",
      dynamicOk,
      dynamicOk
        ? "No dynamic require/eval in candidate files"
        : "Dynamic loading detected inside the candidate",
      dynamicEvidence,
    ),
  );

  // No unsupported global writes
  let globalOk = true;
  const globalEvidence: Evidence[] = [];
  for (const file of files) {
    if (!candidateFiles.has(file.path)) continue;
    if (/\bglobal\.\w+\s*=|\bglobalThis\.\w+\s*=/.test(file.content)) {
      globalOk = false;
      globalEvidence.push(
        ev("READINESS_NO_UNSUPPORTED_GLOBAL_WRITES", "Global mutation", file.path, 1, "global"),
      );
    }
  }
  rules.push(
    rule(
      "READINESS_NO_UNSUPPORTED_GLOBAL_WRITES",
      globalOk,
      globalOk
        ? "No unsupported global mutable state writes"
        : "Unsupported global mutable state writes present",
      globalEvidence,
    ),
  );

  // Generation limits
  let sourceBytes = 0;
  for (const file of files) {
    if (candidateFiles.has(file.path)) sourceBytes += file.sizeBytes;
  }
  const withinLimits = candidate.files.length <= 40 && sourceBytes <= 200_000;
  rules.push(
    rule(
      "READINESS_WITHIN_GENERATION_LIMITS",
      withinLimits,
      withinLimits
        ? "Candidate source slice fits generation limits"
        : "Candidate source slice exceeds generation limits",
      [
        ev(
          "READINESS_WITHIN_GENERATION_LIMITS",
          `${candidate.files.length} files, ${sourceBytes} bytes`,
          candidate.files[0] ?? "package.json",
          1,
          `${candidate.files.length}:${sourceBytes}`,
          withinLimits ? "info" : "critical",
        ),
      ],
    ),
  );

  // Supported cycles only (file-level CommonJS cycles are supported)
  const unsupportedCycle = false;
  rules.push(
    rule(
      "READINESS_SUPPORTED_CYCLES_ONLY",
      !unsupportedCycle,
      "Detected cycles are supported CommonJS file-dependency cycles",
      analysis.graph.cycles
        .filter((c) => c.files.some((f) => candidateFiles.has(f)))
        .flatMap((c) =>
          c.edges
            .slice(0, 2)
            .map((e) =>
              ev(
                "READINESS_SUPPORTED_CYCLES_ONLY",
                "Supported cycle edge",
                e.from,
                e.line,
                `${e.from} -> ${e.to}`,
                "info",
              ),
            ),
        ),
    ),
  );

  // No unsupported blocker that prevents standard Domain Module shape
  // Shared-model write ownership on primary is already covered; foreign access covered.
  // Unsupported if candidate has zero models
  const hasModel = Boolean(primaryModel) || candidateModelNames.size > 0;
  rules.push(
    rule(
      "READINESS_NO_UNSUPPORTED_BLOCKER",
      hasModel && singlePrimary && exclusive && foreign.length === 0,
      hasModel && singlePrimary && exclusive && foreign.length === 0
        ? "No unsupported Blocker prevents the standard Domain Module shape"
        : "An unsupported Blocker prevents the standard Domain Module shape",
      foreignAccess
        .slice(0, 2)
        .map((a) =>
          ev("READINESS_NO_UNSUPPORTED_BLOCKER", "Blocker evidence", a.file, a.line, a.modelName),
        ),
    ),
  );

  return buildTransformationReadiness(candidate.id, rules);
}

export function evaluateAllCandidateReadiness(
  candidates: readonly DomainCandidate[],
  analysis: AnalysisResult,
  files: readonly RepositoryFile[],
): Map<string, TransformationReadiness> {
  const map = new Map<string, TransformationReadiness>();
  for (const candidate of candidates) {
    map.set(candidate.id, evaluateCandidateReadiness(candidate, analysis, files));
  }
  return map;
}

/** Assessment-only when no candidate is ready — no generation path. */
export function isAssessmentOnly(
  readinessByCandidateId: ReadonlyMap<string, TransformationReadiness>,
): boolean {
  return ![...readinessByCandidateId.values()].some((r) => r.ready);
}
