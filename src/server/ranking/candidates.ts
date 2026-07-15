import type { AnalysisResult, ModelAccessEvidence, RouteEvidence } from "@/core/analysis";
import type { CandidateRanking, DomainCandidate } from "@/core/candidates";
import type { Evidence } from "@/core/evidence";
import type { NormalizedPath } from "@/core/paths";

type Cluster = {
  name: string;
  routes: RouteEvidence[];
  files: Set<string>;
  modelNames: Set<string>;
};

function normalizeDomainName(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  if (!cleaned) return "Domain";
  return cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

function domainFromPath(filePath: string): string | null {
  const base = filePath.split("/").pop() ?? filePath;
  const name = base.replace(/\.js$/i, "");
  const stripped = name
    .replace(/\.routes$/i, "")
    .replace(/\.controller$/i, "")
    .replace(/\.model$/i, "")
    .replace(/routes?/i, "")
    .replace(/models?/i, "");
  if (!stripped || stripped.toLowerCase() === "app" || stripped.toLowerCase() === "index") {
    return null;
  }
  return normalizeDomainName(stripped);
}

function domainFromRoutePath(routePath: string): string | null {
  const parts = routePath.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  const first = parts[0]!.replace(/:.*/, "");
  if (!first || first === "api" || first === "health") return null;
  return normalizeDomainName(first);
}

function buildClusters(analysis: AnalysisResult): Cluster[] {
  const clusters = new Map<string, Cluster>();

  const ensure = (name: string): Cluster => {
    const key = name.toLowerCase();
    let cluster = clusters.get(key);
    if (!cluster) {
      cluster = { name, routes: [], files: new Set(), modelNames: new Set() };
      clusters.set(key, cluster);
    }
    return cluster;
  };

  for (const route of analysis.routes) {
    const fromMount = route.mountPrefix ? domainFromRoutePath(route.mountPrefix) : null;
    const fromPath = domainFromRoutePath(route.path);
    const fromFile = domainFromPath(route.file);
    const name = fromMount ?? fromPath ?? fromFile;
    if (!name) continue;
    const cluster = ensure(name);
    cluster.routes.push(route);
    cluster.files.add(route.file);
  }

  for (const model of analysis.models) {
    const name = normalizeDomainName(model.modelName);
    const cluster = ensure(name);
    cluster.modelNames.add(model.modelName);
    cluster.files.add(model.file);
  }

  for (const access of analysis.modelAccess) {
    const name = normalizeDomainName(access.modelName);
    const cluster = ensure(name);
    cluster.modelNames.add(access.modelName);
    cluster.files.add(access.file);
  }

  return [...clusters.values()].filter((c) => c.routes.length > 0 || c.modelNames.size > 0);
}

function scoreCluster(
  cluster: Cluster,
  analysis: AnalysisResult,
): { score: number; confidence: number; signals: Evidence[]; conflicting: Evidence[] } {
  const signals: Evidence[] = [];
  const conflicting: Evidence[] = [];
  let score = 0;

  // Domain-name consistency
  const nameHits = cluster.routes.length + cluster.modelNames.size;
  score += Math.min(0.25, nameHits * 0.05);
  if (cluster.routes.length > 0) {
    signals.push({
      ruleId: "signal-routes",
      message: `${cluster.routes.length} route(s) associated with ${cluster.name}`,
      severity: "info",
      file: cluster.routes[0]!.file,
      line: cluster.routes[0]!.line,
      snippet: cluster.routes[0]!.path,
    });
  }

  // Direct DB access in handlers (good modularization candidate)
  const writes = analysis.modelAccess.filter(
    (a) => a.kind === "write" && cluster.files.has(a.file) && cluster.modelNames.has(a.modelName),
  );
  score += Math.min(0.25, writes.length * 0.08);
  if (writes.length > 0) {
    signals.push({
      ruleId: "signal-direct-writes",
      message: `${writes.length} direct model write(s) in domain files`,
      severity: "warning",
      file: writes[0]!.file,
      line: writes[0]!.line,
      snippet: `${writes[0]!.modelName}.${writes[0]!.methodName}`,
    });
  }

  // Internal cohesion vs external imports
  const internalEdges = analysis.graph.edges.filter(
    (e) => cluster.files.has(e.from) && cluster.files.has(e.to),
  );
  const externalEdges = analysis.graph.edges.filter(
    (e) => cluster.files.has(e.from) && !cluster.files.has(e.to),
  );
  score += Math.min(0.15, internalEdges.length * 0.05);
  score -= Math.min(0.1, externalEdges.length * 0.02);

  // Cycles involving domain files
  const inCycle = analysis.graph.cycles.some((c) => c.files.some((f) => cluster.files.has(f)));
  if (inCycle) {
    score += 0.1; // automatable cycle repair makes this still attractive technically
    const cycle = analysis.graph.cycles.find((c) => c.files.some((f) => cluster.files.has(f)));
    if (cycle?.edges[0]) {
      signals.push({
        ruleId: "signal-cycle",
        message: "Domain participates in an entry-reachable cycle",
        severity: "warning",
        file: cycle.edges[0].from,
        line: cycle.edges[0].line,
        snippet: cycle.files.join(" → "),
      });
    }
  }

  // Competing writes from outside domain
  for (const modelName of cluster.modelNames) {
    const writers = analysis.modelAccess.filter(
      (a) => a.kind === "write" && a.modelName === modelName,
    );
    const outside = writers.filter((w) => !cluster.files.has(w.file));
    if (outside.length > 0) {
      score -= 0.2;
      conflicting.push({
        ruleId: "conflict-shared-writes",
        message: `Model ${modelName} is written outside the candidate`,
        severity: "critical",
        file: outside[0]!.file,
        line: outside[0]!.line,
        snippet: `${modelName}.${outside[0]!.methodName}`,
      });
    }
  }

  // Route count
  score += Math.min(0.15, cluster.routes.length * 0.03);

  const clamped = Math.max(0, Math.min(1, score));
  const confidence = Math.max(0.2, Math.min(0.95, clamped * 0.9 + (signals.length > 2 ? 0.1 : 0)));
  return { score: clamped, confidence, signals, conflicting };
}

/**
 * Cluster evidence into up to three Domain Candidates ranked by technical signals.
 * Ranking is not business priority (ADR-0004).
 */
export function rankDomainCandidates(analysis: AnalysisResult): CandidateRanking {
  const clusters = buildClusters(analysis);
  const candidates: DomainCandidate[] = clusters.map((cluster) => {
    const scored = scoreCluster(cluster, analysis);
    const primaryModelName = [...cluster.modelNames][0];
    const primaryModel = analysis.models.find((m) => m.modelName === primaryModelName);
    return {
      id: cluster.name.toLowerCase(),
      name: cluster.name,
      technicalScore: Number(scored.score.toFixed(4)),
      confidence: Number(scored.confidence.toFixed(4)),
      routes: cluster.routes,
      primaryModel,
      files: [...cluster.files].sort() as NormalizedPath[],
      signals: scored.signals,
      conflictingEvidence: scored.conflicting,
    };
  });

  candidates.sort((a, b) => {
    if (b.technicalScore !== a.technicalScore) return b.technicalScore - a.technicalScore;
    return a.name.localeCompare(b.name);
  });

  const top = candidates.slice(0, 3);
  return {
    candidates: top,
    safestTechnicalCandidateId: top[0]?.id,
  };
}

export function writeAccessForModel(
  access: readonly ModelAccessEvidence[],
  modelName: string,
): ModelAccessEvidence[] {
  return access.filter((a) => a.modelName === modelName && a.kind === "write");
}
