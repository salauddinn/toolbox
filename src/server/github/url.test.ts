import { describe, expect, it } from "vitest";
import { isAllowedGitHubHost, parseGitHubRepoUrl } from "./url";

describe("parseGitHubRepoUrl", () => {
  it("accepts root https GitHub URLs", () => {
    const result = parseGitHubRepoUrl("https://github.com/acme/legacy-orders");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ref.owner).toBe("acme");
      expect(result.ref.repo).toBe("legacy-orders");
      expect(result.ref.canonicalUrl).toBe("https://github.com/acme/legacy-orders");
    }
  });

  it("strips .git suffix", () => {
    const result = parseGitHubRepoUrl("https://github.com/acme/app.git");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ref.repo).toBe("app");
  });

  it("rejects non-GitHub hosts and nested paths", () => {
    expect(parseGitHubRepoUrl("https://gitlab.com/acme/app").ok).toBe(false);
    expect(parseGitHubRepoUrl("https://github.com/acme/app/tree/main").ok).toBe(false);
    expect(parseGitHubRepoUrl("git@github.com:acme/app.git").ok).toBe(false);
    expect(parseGitHubRepoUrl("https://github.com/acme/app?ref=main").ok).toBe(false);
  });
});

describe("isAllowedGitHubHost", () => {
  it("allows documented archive hosts only", () => {
    expect(isAllowedGitHubHost("codeload.github.com")).toBe(true);
    expect(isAllowedGitHubHost("evil.example.com")).toBe(false);
  });
});
