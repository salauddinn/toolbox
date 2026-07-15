import type { AnalysisResult } from "./analysis";
import type { EligibilityResult } from "./eligibility";
import type { RepositoryFile } from "./repository";

/**
 * Future-facing analyzer boundary.
 * MVP ships exactly one implementation: ExpressAnalyzer (server/analysis).
 * No plugin loader or framework selector (rough.md).
 */
export interface CodebaseAnalyzer {
  readonly id: string;
  supports(files: readonly RepositoryFile[]): EligibilityResult;
  analyze(files: readonly RepositoryFile[]): Promise<AnalysisResult>;
}
