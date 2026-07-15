import type { FileOperation } from "@/core/changes";
import type { StagePlan } from "@/core/stages";
import {
  delimitUntrustedSource,
  type AiProvider,
  type GenerationRequest,
  type GenerationResult,
  validateOperationsAgainstStage,
} from "./provider";

export type MockProviderScript =
  | { type: "operations"; operations: FileOperation[] }
  | { type: "invalid_json" }
  | { type: "invalid_schema" }
  | { type: "transport_fail_then"; operations: FileOperation[] }
  | { type: "always_transport_fail" };

/**
 * Deterministic provider for tests. No network.
 */
export class MockAiProvider implements AiProvider {
  private callCount = 0;
  private transportFails = 0;

  constructor(private readonly script: MockProviderScript) {}

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    this.callCount += 1;
    void request;

    if (this.script.type === "always_transport_fail") {
      return {
        ok: false,
        code: "PROVIDER_TRANSPORT",
        message: "mock transport failure",
        retryable: true,
      };
    }

    if (this.script.type === "transport_fail_then") {
      if (this.transportFails < 1) {
        this.transportFails += 1;
        return {
          ok: false,
          code: "PROVIDER_TRANSPORT",
          message: "transient mock failure",
          retryable: true,
        };
      }
      return this.success(this.script.operations, request.stage);
    }

    if (this.script.type === "invalid_json") {
      return {
        ok: false,
        code: "PROVIDER_INVALID_JSON",
        message: "not json",
        rawText: "NOT JSON {{{",
        retryable: false,
      };
    }

    if (this.script.type === "invalid_schema") {
      return {
        ok: false,
        code: "PROVIDER_SCHEMA",
        message: "bad schema",
        rawText: JSON.stringify({ operations: [{ type: "rename", path: "x" }] }),
        retryable: false,
      };
    }

    return this.success(this.script.operations, request.stage);
  }

  private success(operations: FileOperation[], stage: StagePlan): GenerationResult {
    const budget = validateOperationsAgainstStage(operations, stage);
    if (budget) return budget;
    return {
      ok: true,
      operations,
      rawText: JSON.stringify({ operations }),
      attempt: 1,
    };
  }

  get calls(): number {
    return this.callCount;
  }
}

export function mockUntrustedBlock(snippet: string): string {
  return delimitUntrustedSource(snippet);
}
