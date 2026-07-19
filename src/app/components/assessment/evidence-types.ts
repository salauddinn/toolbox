/** Client-safe evidence fields shared by assessment surfaces and the inspector. */
export type EvidenceRecord = {
  ruleId: string;
  message: string;
  severity: string;
  file: string;
  line: number;
  snippet: string;
};

/** Full evidence detail with prev/next over the current collection. */
export type EvidenceInspection = {
  mode: "evidence";
  items: readonly EvidenceRecord[];
  index: number;
};

/**
 * Path/line context only. Used for graph nodes/edges, routes, and models.
 * Must never invent rule, severity, message, or snippet.
 */
export type FileContextInspection = {
  mode: "file-context";
  file: string;
  line?: number;
  /** Optional origin label for the inspector chrome (not treated as evidence). */
  origin?: "graph" | "route" | "model" | "other";
};

export type EvidenceInspectorState = EvidenceInspection | FileContextInspection;

export type OpenEvidenceRequest = {
  kind: "evidence";
  items: readonly EvidenceRecord[];
  index: number;
};

export type OpenFileContextRequest = {
  kind: "file-context";
  file: string;
  line?: number;
  origin?: FileContextInspection["origin"];
};

export type InspectRequest = OpenEvidenceRequest | OpenFileContextRequest;

export function toInspectorState(request: InspectRequest): EvidenceInspectorState {
  if (request.kind === "evidence") {
    const max = Math.max(0, request.items.length - 1);
    const index = Math.min(Math.max(0, request.index), max);
    return {
      mode: "evidence",
      items: request.items,
      index,
    };
  }
  return {
    mode: "file-context",
    file: request.file,
    line: request.line,
    origin: request.origin,
  };
}
