import type { AnalysisResult } from "./analysis";
import type { EligibilityResult } from "./eligibility";
import type { RepositoryFile } from "./repository";

/**
 * Future-facing analyzer boundary.
 * MVP ships exactly one implementation: ExpressAnalyzer.
 * No plugin loader or framework selector (rough.md).
 */
export interface CodebaseAnalyzer {
  readonly id: string;
  supports(files: readonly RepositoryFile[]): EligibilityResult;
  analyze(files: readonly RepositoryFile[]): Promise<AnalysisResult>;
}

/**
 * Express.js + CommonJS + Mongoose analyzer shell.
 * Real parsing and graph construction land in Phase 2.
 */
export class ExpressAnalyzer implements CodebaseAnalyzer {
  readonly id = "express-mongoose-commonjs";

  supports(files: readonly RepositoryFile[]): EligibilityResult {
    void files;
    return {
      eligible: false,
      rejections: [
        {
          code: "ELIGIBILITY_UNSUPPORTED_SYNTAX_PROFILE",
          message: "ExpressAnalyzer.supports is not implemented yet; eligibility lands in Phase 2.",
          evidence: [],
        },
      ],
    };
  }

  async analyze(files: readonly RepositoryFile[]): Promise<AnalysisResult> {
    void files;
    throw new Error(
      "ExpressAnalyzer.analyze is not implemented yet; static analysis lands in Phase 2.",
    );
  }
}
