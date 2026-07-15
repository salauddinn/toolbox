import type { Evidence, ModernizationFinding } from "./evidence";
import type { NormalizedPath } from "./paths";

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "all" | "use";

export type RouteEvidence = {
  method: HttpMethod;
  path: string;
  file: NormalizedPath;
  line: number;
  handlerNames: readonly string[];
  /** Mount prefix when registered via app.use(prefix, router). */
  mountPrefix?: string;
};

export type ModelAccessKind = "read" | "write" | "unknown";

export type ModelEvidence = {
  modelName: string;
  collectionName?: string;
  file: NormalizedPath;
  line: number;
  schemaFingerprint?: string;
};

export type ModelAccessEvidence = {
  modelName: string;
  kind: ModelAccessKind;
  methodName: string;
  file: NormalizedPath;
  line: number;
};

export type DependencyEdge = {
  from: NormalizedPath;
  to: NormalizedPath;
  line: number;
};

export type DependencyCycle = {
  files: readonly NormalizedPath[];
  edges: readonly DependencyEdge[];
};

export type DependencyGraph = {
  nodes: readonly NormalizedPath[];
  edges: readonly DependencyEdge[];
  /** Files reachable from the recognized application entry. */
  entryReachable: ReadonlySet<NormalizedPath>;
  cycles: readonly DependencyCycle[];
};

/**
 * Deterministic static analysis output.
 * AI may explain these facts but must not invent them.
 */
export type AnalysisResult = {
  runtime: {
    nodeRange?: string;
    expressVersion?: string;
    mongooseVersion?: string;
  };
  entryPath: NormalizedPath;
  routes: readonly RouteEvidence[];
  models: readonly ModelEvidence[];
  modelAccess: readonly ModelAccessEvidence[];
  graph: DependencyGraph;
  findings: readonly ModernizationFinding[];
  /** Content hash of the analyzed snapshot for in-memory cache keys. */
  contentHash: string;
  evidence: readonly Evidence[];
};
