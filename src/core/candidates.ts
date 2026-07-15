import type { Evidence } from "./evidence";
import type { NormalizedPath } from "./paths";
import type { ModelEvidence, RouteEvidence } from "./analysis";

/**
 * Technically coherent area eligible to become a Domain Module.
 * Ranking reflects code evidence, not business importance (ADR-0004).
 */
export type DomainCandidate = {
  id: string;
  name: string;
  /** Technical suitability score; higher is safer to modularize first. */
  technicalScore: number;
  confidence: number;
  routes: readonly RouteEvidence[];
  primaryModel?: ModelEvidence;
  files: readonly NormalizedPath[];
  signals: readonly Evidence[];
  conflictingEvidence: readonly Evidence[];
};

export type CandidateRanking = {
  /** Up to three candidates, highest technical score first. */
  candidates: readonly DomainCandidate[];
  safestTechnicalCandidateId?: string;
};
