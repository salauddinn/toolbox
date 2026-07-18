import { describe, expect, it } from "vitest";
import { validateAiBaseUrl } from "./provider-url";

describe("validateAiBaseUrl", () => {
  it("accepts public https OpenAI-compatible URLs", () => {
    const result = validateAiBaseUrl("https://api.openai.com/v1", {
      allowHttpLocalhost: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.baseUrl).toBe("https://api.openai.com/v1");
  });

  it("rejects private and metadata hosts", () => {
    expect(validateAiBaseUrl("https://169.254.169.254/latest").ok).toBe(false);
    expect(validateAiBaseUrl("https://127.0.0.1/v1", { allowHttpLocalhost: false }).ok).toBe(
      false,
    );
    expect(validateAiBaseUrl("https://10.0.0.5/v1").ok).toBe(false);
    expect(validateAiBaseUrl("https://metadata.google.internal/").ok).toBe(false);
  });

  it("rejects http except localhost in dev", () => {
    expect(validateAiBaseUrl("http://evil.example/v1", { allowHttpLocalhost: true }).ok).toBe(
      false,
    );
    const local = validateAiBaseUrl("http://127.0.0.1:8080/v1", {
      allowHttpLocalhost: true,
    });
    expect(local.ok).toBe(true);
  });

  it("rejects credentials in URL", () => {
    expect(validateAiBaseUrl("https://user:pass@api.openai.com/v1").ok).toBe(false);
  });
});
