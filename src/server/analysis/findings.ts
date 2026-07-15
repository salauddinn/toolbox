import type {
  AnalysisResult,
  DependencyGraph,
  ModelAccessEvidence,
  RouteEvidence,
} from "@/core/analysis";
import type { Evidence, ModernizationFinding } from "@/core/evidence";
import type { NormalizedPath } from "@/core/paths";
import type { RepositoryFile } from "@/core/repository";
import { snippetAround } from "./parse";

function evidence(
  ruleId: string,
  message: string,
  file: NormalizedPath,
  line: number,
  content: string,
  severity: Evidence["severity"] = "warning",
): Evidence {
  return {
    ruleId,
    message,
    severity,
    file,
    line,
    snippet: snippetAround(content, line),
  };
}

export function detectFindings(input: {
  files: readonly RepositoryFile[];
  routes: readonly RouteEvidence[];
  modelAccess: readonly ModelAccessEvidence[];
  graph: DependencyGraph;
  hasJestSupertest: boolean;
}): ModernizationFinding[] {
  const byPath = new Map(input.files.map((f) => [f.path, f]));
  const findings: ModernizationFinding[] = [];

  // Route/business/database coupling: model writes inside route files
  const routeFiles = new Set(input.routes.map((r) => r.file));
  const coupled = input.modelAccess.filter((a) => a.kind === "write" && routeFiles.has(a.file));
  if (coupled.length > 0) {
    const file = coupled[0]!;
    const content = byPath.get(file.file)?.content ?? "";
    findings.push({
      id: "route-db-coupling",
      title: "Route/business/database coupling",
      summary: "HTTP route handlers perform direct Mongoose writes",
      remediation: "automatable",
      evidence: coupled
        .slice(0, 8)
        .map((a) =>
          evidence(
            "route-db-coupling",
            `${a.modelName}.${a.methodName} called from route file`,
            a.file,
            a.line,
            byPath.get(a.file)?.content ?? content,
            "warning",
          ),
        ),
    });
  }

  // Circular CommonJS dependency
  for (const cycle of input.graph.cycles) {
    const edges = cycle.edges;
    const first = edges[0];
    if (!first) continue;
    findings.push({
      id: `cycle:${cycle.files.join("->")}`,
      title: "Circular CommonJS dependency",
      summary: `Entry-reachable cycle involving ${cycle.files.join(" → ")}`,
      remediation: "automatable",
      evidence: edges.map((e) =>
        evidence(
          "circular-dependency",
          `${e.from} requires ${e.to}`,
          e.from,
          e.line,
          byPath.get(e.from)?.content ?? "",
          "critical",
        ),
      ),
    });
  }

  // Large route handlers (file with routes and many lines in handler region — approximate by file size)
  for (const route of input.routes) {
    const content = byPath.get(route.file)?.content ?? "";
    const lines = content.split(/\r?\n/).length;
    if (lines >= 80 && route.handlerNames.includes("<inline>")) {
      findings.push({
        id: `large-handler:${route.file}:${route.line}`,
        title: "Large route handler",
        summary: `Inline handler in a large route file (${lines} lines)`,
        remediation: "automatable",
        evidence: [
          evidence("large-handler", "Large inline route handler", route.file, route.line, content),
        ],
      });
    }
  }

  // Shared-model writes: multiple files write the same model
  const writesByModel = new Map<string, Set<string>>();
  for (const access of input.modelAccess) {
    if (access.kind !== "write") continue;
    const set = writesByModel.get(access.modelName) ?? new Set();
    set.add(access.file);
    writesByModel.set(access.modelName, set);
  }
  for (const [modelName, files] of writesByModel) {
    if (files.size > 1) {
      findings.push({
        id: `shared-write:${modelName}`,
        title: "Shared Mongoose model ownership",
        summary: `Multiple files write model ${modelName}`,
        remediation: "developer_decision_required",
        evidence: [...files].map((file) =>
          evidence(
            "shared-model-writes",
            `Write access to ${modelName}`,
            file as NormalizedPath,
            1,
            byPath.get(file as NormalizedPath)?.content ?? "",
            "critical",
          ),
        ),
      });
    }
  }

  // Global mutable state
  for (const file of input.files) {
    if (!file.path.endsWith(".js")) continue;
    const globalRe = /\bglobal\.\w+\s*=|\bglobalThis\.\w+\s*=/;
    const match = globalRe.exec(file.content);
    if (match && match.index !== undefined) {
      const line = file.content.slice(0, match.index).split(/\r?\n/).length;
      findings.push({
        id: `global:${file.path}:${line}`,
        title: "Global mutable state",
        summary: "Assignment to global/globalThis detected",
        remediation: "developer_decision_required",
        evidence: [
          evidence("global-mutation", "Global mutation", file.path, line, file.content, "warning"),
        ],
      });
    }
  }

  // Missing characterization tests / harness
  if (!input.hasJestSupertest) {
    findings.push({
      id: "missing-test-harness",
      title: "Missing CommonJS Jest/Supertest harness",
      summary: "npm test does not provide Jest and Supertest for transformation",
      remediation: "developer_decision_required",
      evidence: [
        evidence(
          "missing-test-harness",
          "Jest/Supertest harness unavailable",
          "package.json" as NormalizedPath,
          1,
          byPath.get("package.json" as NormalizedPath)?.content ?? "",
          "critical",
        ),
      ],
    });
  } else {
    const hasTestFile = input.files.some((f) => f.path.includes("test") && f.path.endsWith(".js"));
    if (!hasTestFile) {
      findings.push({
        id: "missing-domain-tests",
        title: "Missing domain characterization tests",
        summary: "Supported harness exists but domain route tests are missing",
        remediation: "automatable",
        evidence: [
          evidence(
            "missing-domain-tests",
            "No test files found",
            "package.json" as NormalizedPath,
            1,
            byPath.get("package.json" as NormalizedPath)?.content ?? "",
          ),
        ],
      });
    }
  }

  return findings;
}

export function collectEvidence(
  result: Pick<AnalysisResult, "findings" | "routes" | "models">,
): Evidence[] {
  const out: Evidence[] = [];
  for (const finding of result.findings) {
    out.push(...finding.evidence);
  }
  return out;
}
