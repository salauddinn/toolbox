import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_AI_INPUT_TOKEN_BUDGET,
  DEFAULT_AI_OUTPUT_TOKEN_BUDGET,
  MAX_AI_INPUT_TOKEN_BUDGET,
  MAX_AI_OUTPUT_TOKEN_BUDGET,
  getServerEnv,
  resetServerEnvCache,
  SECRET_ENV_KEYS,
  validateServerEnv,
} from "./env";

const validEnv = {
  AI_BASE_URL: "https://api.openai.com/v1",
  AI_API_KEY: "test-key-not-real",
  AI_MODEL: "gpt-4.1-mini",
  NODE_ENV: "test",
} as const;

afterEach(() => {
  resetServerEnvCache();
});

describe("validateServerEnv", () => {
  it("accepts required AI configuration", () => {
    const result = validateServerEnv({ ...validEnv });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.env.AI_MODEL).toBe("gpt-4.1-mini");
      expect(result.env.AI_INPUT_TOKEN_BUDGET).toBe(DEFAULT_AI_INPUT_TOKEN_BUDGET);
      expect(result.env.AI_OUTPUT_TOKEN_BUDGET).toBe(DEFAULT_AI_OUTPUT_TOKEN_BUDGET);
      expect(result.env.GITHUB_TOKEN).toBeUndefined();
    }
  });

  it("accepts configured positive token budgets", () => {
    const result = validateServerEnv({
      ...validEnv,
      AI_INPUT_TOKEN_BUDGET: "1234",
      AI_OUTPUT_TOKEN_BUDGET: "567",
    });
    expect(result).toEqual({
      ok: true,
      env: expect.objectContaining({
        AI_INPUT_TOKEN_BUDGET: 1234,
        AI_OUTPUT_TOKEN_BUDGET: 567,
      }),
    });
  });

  it("accepts token budgets at documented operational maxima", () => {
    const result = validateServerEnv({
      ...validEnv,
      AI_INPUT_TOKEN_BUDGET: String(MAX_AI_INPUT_TOKEN_BUDGET),
      AI_OUTPUT_TOKEN_BUDGET: String(MAX_AI_OUTPUT_TOKEN_BUDGET),
    });
    expect(result).toEqual({
      ok: true,
      env: expect.objectContaining({
        AI_INPUT_TOKEN_BUDGET: MAX_AI_INPUT_TOKEN_BUDGET,
        AI_OUTPUT_TOKEN_BUDGET: MAX_AI_OUTPUT_TOKEN_BUDGET,
      }),
    });
  });

  it("rejects invalid and over-maximum token budgets", () => {
    const result = validateServerEnv({
      ...validEnv,
      AI_INPUT_TOKEN_BUDGET: String(MAX_AI_INPUT_TOKEN_BUDGET + 1),
      AI_OUTPUT_TOKEN_BUDGET: String(MAX_AI_OUTPUT_TOKEN_BUDGET + 1),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join(" ")).toContain("AI_INPUT_TOKEN_BUDGET");
      expect(result.issues.join(" ")).toContain("AI_OUTPUT_TOKEN_BUDGET");
    }
  });

  it("accepts optional GITHUB_TOKEN", () => {
    const result = validateServerEnv({
      ...validEnv,
      GITHUB_TOKEN: "test-github-token-not-real",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.env.GITHUB_TOKEN).toBe("test-github-token-not-real");
    }
  });

  it("rejects missing AI_API_KEY", () => {
    const result = validateServerEnv({
      AI_BASE_URL: validEnv.AI_BASE_URL,
      AI_MODEL: validEnv.AI_MODEL,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ENV_INVALID");
      expect(result.issues.some((issue) => issue.includes("AI_API_KEY"))).toBe(true);
    }
  });

  it("rejects invalid AI_BASE_URL", () => {
    const result = validateServerEnv({
      ...validEnv,
      AI_BASE_URL: "not-a-url",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects private AI_BASE_URL targets", () => {
    const result = validateServerEnv({
      ...validEnv,
      AI_BASE_URL: "https://169.254.169.254/latest",
    });
    expect(result.ok).toBe(false);
  });

  it("lists every missing required field", () => {
    const result = validateServerEnv({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const joined = result.issues.join(" ");
      expect(joined).toContain("AI_BASE_URL");
      expect(joined).toContain("AI_API_KEY");
      expect(joined).toContain("AI_MODEL");
    }
  });
});

describe("getServerEnv", () => {
  it("throws when environment is incomplete", () => {
    const original = { ...process.env };
    delete process.env.AI_BASE_URL;
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
    try {
      expect(() => getServerEnv()).toThrow(/Invalid server environment/);
    } finally {
      process.env = original;
      resetServerEnvCache();
    }
  });
});

describe("SECRET_ENV_KEYS", () => {
  it("tracks credentials that must stay server-side", () => {
    expect(SECRET_ENV_KEYS).toContain("AI_API_KEY");
    expect(SECRET_ENV_KEYS).toContain("GITHUB_TOKEN");
    expect(SECRET_ENV_KEYS).toContain("TOOLBOX_SESSION_SECRET");
  });
});
