import type { Evidence } from "./evidence";
import type { NormalizedPath } from "./paths";

export type StageKind =
  "behavior_capture" | "domain_module" | "cycle_repair" | "integration_cleanup";

export type StageKindRequired = Exclude<StageKind, "cycle_repair">;

/** Allowed path patterns for create/update/delete within a stage. */
export type PathEnvelope = {
  create: readonly string[];
  update: readonly string[];
  delete: readonly string[];
};

/** Symbols or AST regions the stage may mutate. */
export type MutableAstRegion = {
  file: NormalizedPath;
  /** Symbol names, export names, or handler identifiers. */
  symbols: readonly string[];
};

/** Fingerprint of protected top-level regions that must not change. */
export type ProtectedRegionFingerprint = {
  file: NormalizedPath;
  /** Stable hash of protected AST text for the file. */
  fingerprint: string;
  description: string;
};

export type StageValidationCriterion = {
  id: string;
  description: string;
  kind: "static" | "runtime";
};

/**
 * Scoped purpose presented before generation authorization (ADR-0012).
 * AI cannot change stage count, trigger outcome, or purpose.
 */
export type StagePlan = {
  id: string;
  kind: StageKind;
  title: string;
  purpose: string;
  /** True when this is the evidence-triggered conditional cycle stage. */
  conditional: boolean;
  evidence: readonly Evidence[];
  expectedFiles: readonly NormalizedPath[];
  pathEnvelope: PathEnvelope;
  mutableRegions: readonly MutableAstRegion[];
  protectedFingerprints: readonly ProtectedRegionFingerprint[];
  validationCriteria: readonly StageValidationCriterion[];
  budgets: {
    maxOperations: number;
    maxBytesPerFile: number;
    maxTotalChangedBytes: number;
  };
};

export type PendingConditionalMarker = {
  kind: "cycle_repair";
  reason: string;
  evidence: readonly Evidence[];
  /** Resolved only after Domain Module acceptance against the entry-reachable graph. */
  status: "pending_post_module_recalc";
};

export type ModernizationSequencePlan = {
  requiredStages: readonly [
    StagePlan & { kind: "behavior_capture" },
    StagePlan & { kind: "domain_module" },
    StagePlan & { kind: "integration_cleanup" },
  ];
  pendingConditional?: PendingConditionalMarker;
  /** Filled only when post-module graph still has the supported cycle. */
  conditionalStage?: StagePlan & { kind: "cycle_repair"; conditional: true };
};

export const DEFAULT_STAGE_BUDGETS = {
  maxOperations: 20,
  maxBytesPerFile: 128 * 1024,
  maxTotalChangedBytes: 512 * 1024,
} as const;
