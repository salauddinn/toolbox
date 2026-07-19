import { z } from "zod";
import { validateAiBaseUrl } from "@/server/ai/provider-url";

export const DEFAULT_AI_INPUT_TOKEN_BUDGET = 64 * 1024;
/**
 * A provider-output outer gate, deliberately lower than some Stage Plan byte ceilings.
 * See README and .env.example for the resulting one-response limitation.
 */
export const DEFAULT_AI_OUTPUT_TOKEN_BUDGET = 32 * 1024;

/** Operational caps keep untrusted environment configuration from producing impractical requests. */
export const MAX_AI_INPUT_TOKEN_BUDGET = 1_000_000;
export const MAX_AI_OUTPUT_TOKEN_BUDGET = 128 * 1024;

const inputTokenBudgetSchema = z.coerce.number().int().min(1).max(MAX_AI_INPUT_TOKEN_BUDGET);
const outputTokenBudgetSchema = z.coerce.number().int().min(1).max(MAX_AI_OUTPUT_TOKEN_BUDGET);

/**
 * Server-only environment contract.
 * Import only from server modules (Route Handlers, server utilities).
 * Never import from Client Components or code that can reach the browser bundle.
 */
const serverEnvSchema = z.object({
  AI_BASE_URL: z
    .string()
    .url()
    .superRefine((value, ctx) => {
      const checked = validateAiBaseUrl(value, {
        allowHttpLocalhost: process.env.NODE_ENV !== "production",
      });
      if (!checked.ok) {
        ctx.addIssue({ code: "custom", message: checked.message });
      }
    }),
  AI_API_KEY: z.string().min(1),
  AI_MODEL: z.string().min(1),
  /** Provider request budgets, capped to documented operational maxima. */
  AI_INPUT_TOKEN_BUDGET: inputTokenBudgetSchema.default(DEFAULT_AI_INPUT_TOKEN_BUDGET),
  AI_OUTPUT_TOKEN_BUDGET: outputTokenBudgetSchema.default(DEFAULT_AI_OUTPUT_TOKEN_BUDGET),
  GITHUB_TOKEN: z.string().min(1).optional(),
  TOOLBOX_SESSION_SECRET: z.string().min(16).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export type EnvValidationResult =
  { ok: true; env: ServerEnv } | { ok: false; code: "ENV_INVALID"; issues: string[] };

let cached: ServerEnv | undefined;

export type EnvSource = Record<string, string | undefined>;

function readRawEnv(source: EnvSource = process.env): EnvSource {
  return {
    AI_BASE_URL: source.AI_BASE_URL,
    AI_API_KEY: source.AI_API_KEY,
    AI_MODEL: source.AI_MODEL,
    AI_INPUT_TOKEN_BUDGET: source.AI_INPUT_TOKEN_BUDGET,
    AI_OUTPUT_TOKEN_BUDGET: source.AI_OUTPUT_TOKEN_BUDGET,
    GITHUB_TOKEN: source.GITHUB_TOKEN || undefined,
    TOOLBOX_SESSION_SECRET: source.TOOLBOX_SESSION_SECRET || undefined,
    NODE_ENV: source.NODE_ENV,
  };
}

/**
 * Validates server environment without throwing.
 * Use at request boundaries when generation or GitHub access is required.
 */
export function validateServerEnv(source: EnvSource = process.env): EnvValidationResult {
  const parsed = serverEnvSchema.safeParse(readRawEnv(source));
  if (!parsed.success) {
    return {
      ok: false,
      code: "ENV_INVALID",
      issues: parsed.error.issues.map((issue) => {
        const path = issue.path.join(".") || "env";
        return `${path}: ${issue.message}`;
      }),
    };
  }
  return { ok: true, env: parsed.data };
}

/**
 * Returns validated server env, throwing on first use if invalid.
 * Safe only on the server.
 */
export function getServerEnv(): ServerEnv {
  if (cached) {
    return cached;
  }
  const result = validateServerEnv();
  if (!result.ok) {
    throw new Error(`Invalid server environment: ${result.issues.join("; ")}`);
  }
  cached = result.env;
  return cached;
}

/** Test helper — clears the process-local cache. */
export function resetServerEnvCache(): void {
  cached = undefined;
}

/** Names of secrets that must never appear in client assets. */
export const SECRET_ENV_KEYS = ["AI_API_KEY", "GITHUB_TOKEN", "TOOLBOX_SESSION_SECRET"] as const;
