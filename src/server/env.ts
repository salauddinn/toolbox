import { z } from "zod";
import { validateAiBaseUrl } from "@/server/ai/provider-url";

export const DEFAULT_AI_INPUT_TOKEN_BUDGET = 64 * 1024;
/**
 * A provider-output outer gate, deliberately lower than some Stage Plan byte ceilings.
 * See README and .env.example for the resulting one-response limitation.
 */
export const DEFAULT_AI_OUTPUT_TOKEN_BUDGET = 32 * 1024;

/** Default single provider HTTP request timeout (slow models often exceed 60s). */
export const DEFAULT_AI_REQUEST_TIMEOUT_MS = 180_000;
/** ClinePass exposes MiniMax M3 through Cline's OpenAI-compatible API. */
export const DEFAULT_AI_BASE_URL = "https://api.cline.bot/api/v1";
export const DEFAULT_AI_MODEL = "cline-pass/minimax-m3";
export const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";

/** Operational caps keep untrusted environment configuration from producing impractical requests. */
export const MAX_AI_INPUT_TOKEN_BUDGET = 1_000_000;
export const MAX_AI_OUTPUT_TOKEN_BUDGET = 128 * 1024;
export const MIN_AI_REQUEST_TIMEOUT_MS = 10_000;
export const MAX_AI_REQUEST_TIMEOUT_MS = 600_000;

const inputTokenBudgetSchema = z.coerce.number().int().min(1).max(MAX_AI_INPUT_TOKEN_BUDGET);
const outputTokenBudgetSchema = z.coerce.number().int().min(1).max(MAX_AI_OUTPUT_TOKEN_BUDGET);
const requestTimeoutSchema = z.coerce
  .number()
  .int()
  .min(MIN_AI_REQUEST_TIMEOUT_MS)
  .max(MAX_AI_REQUEST_TIMEOUT_MS);

/**
 * Server-only environment contract.
 * Import only from server modules (Route Handlers, server utilities).
 * Never import from Client Components or code that can reach the browser bundle.
 */
const serverEnvSchema = z
  .object({
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
      })
      .default(DEFAULT_AI_BASE_URL),
    /** ClinePass-compatible primary provider. Defaults to MiniMax M3. */
    AI_API_KEY: z.string().min(1).optional(),
    AI_MODEL: z.string().min(1).default(DEFAULT_AI_MODEL),
    /** Optional fallback, used only after a retryable primary-provider failure. */
    GEMINI_API_KEY: z.string().min(1).optional(),
    GEMINI_BASE_URL: z
      .string()
      .url()
      .superRefine((value, ctx) => {
        const checked = validateAiBaseUrl(value, {
          allowHttpLocalhost: process.env.NODE_ENV !== "production",
        });
        if (!checked.ok) ctx.addIssue({ code: "custom", message: checked.message });
      })
      .default(DEFAULT_GEMINI_BASE_URL),
    GEMINI_MODEL: z.string().min(1).default(DEFAULT_GEMINI_MODEL),
    /** Optional final fallback, used only after retryable prior-provider failures. */
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_BASE_URL: z
      .string()
      .url()
      .superRefine((value, ctx) => {
        const checked = validateAiBaseUrl(value, {
          allowHttpLocalhost: process.env.NODE_ENV !== "production",
        });
        if (!checked.ok) ctx.addIssue({ code: "custom", message: checked.message });
      })
      .default(DEFAULT_OPENAI_BASE_URL),
    OPENAI_MODEL: z.string().min(1).default(DEFAULT_OPENAI_MODEL),
    /** Provider request budgets, capped to documented operational maxima. */
    AI_INPUT_TOKEN_BUDGET: inputTokenBudgetSchema.default(DEFAULT_AI_INPUT_TOKEN_BUDGET),
    AI_OUTPUT_TOKEN_BUDGET: outputTokenBudgetSchema.default(DEFAULT_AI_OUTPUT_TOKEN_BUDGET),
    /** Single chat-completions HTTP timeout in milliseconds. */
    AI_REQUEST_TIMEOUT_MS: requestTimeoutSchema.default(DEFAULT_AI_REQUEST_TIMEOUT_MS),
    GITHUB_TOKEN: z.string().min(1).optional(),
    TOOLBOX_SESSION_SECRET: z.string().min(16).optional(),
    NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.AI_API_KEY && !value.GEMINI_API_KEY && !value.OPENAI_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["AI_API_KEY"],
        message: "Set AI_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY",
      });
    }
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
    GEMINI_API_KEY: source.GEMINI_API_KEY,
    GEMINI_BASE_URL: source.GEMINI_BASE_URL,
    GEMINI_MODEL: source.GEMINI_MODEL,
    OPENAI_API_KEY: source.OPENAI_API_KEY,
    OPENAI_BASE_URL: source.OPENAI_BASE_URL,
    OPENAI_MODEL: source.OPENAI_MODEL,
    AI_INPUT_TOKEN_BUDGET: source.AI_INPUT_TOKEN_BUDGET,
    AI_OUTPUT_TOKEN_BUDGET: source.AI_OUTPUT_TOKEN_BUDGET,
    AI_REQUEST_TIMEOUT_MS: source.AI_REQUEST_TIMEOUT_MS,
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
export const SECRET_ENV_KEYS = [
  "AI_API_KEY",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "GITHUB_TOKEN",
  "TOOLBOX_SESSION_SECRET",
] as const;
