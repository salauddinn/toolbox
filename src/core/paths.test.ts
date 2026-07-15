import { describe, expect, it } from "vitest";
import { assertNormalizedPath, normalizeRepositoryPath } from "./paths";

describe("normalizeRepositoryPath", () => {
  it("normalizes relative POSIX paths", () => {
    const result = normalizeRepositoryPath("./src/routes/orders.js");
    expect(result).toEqual({ ok: true, path: "src/routes/orders.js" });
  });

  it("rejects absolute paths", () => {
    expect(normalizeRepositoryPath("/etc/passwd").ok).toBe(false);
    expect(normalizeRepositoryPath("C:/windows").ok).toBe(false);
  });

  it("rejects backslashes and NUL", () => {
    expect(normalizeRepositoryPath("src\\routes.js").ok).toBe(false);
    expect(normalizeRepositoryPath("src/\0evil.js").ok).toBe(false);
  });

  it("rejects traversal outside the repository root", () => {
    const result = normalizeRepositoryPath("../secrets.env");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PATH_TRAVERSAL");
    }
  });

  it("allows internal .. that stays inside the root", () => {
    const result = normalizeRepositoryPath("src/../lib/util.js");
    expect(result).toEqual({ ok: true, path: "lib/util.js" });
  });

  it("assertNormalizedPath throws on invalid input", () => {
    expect(() => assertNormalizedPath("../x")).toThrow(/PATH_TRAVERSAL/);
  });
});
