import { describe, expect, it } from "vitest";
import { parseFileOperations } from "./changes";
import { assertNormalizedPath } from "./paths";

describe("parseFileOperations", () => {
  it("accepts schema-valid operations", () => {
    const ops = parseFileOperations([
      { type: "create", path: assertNormalizedPath("tests/orders.test.js"), content: "ok" },
      { type: "update", path: assertNormalizedPath("app.js"), content: "require('./x')" },
      { type: "delete", path: assertNormalizedPath("routes/legacy.js") },
    ]);
    expect(ops).toHaveLength(3);
  });

  it("rejects malformed provider output", () => {
    expect(parseFileOperations(null)).toBeNull();
    expect(parseFileOperations([{ type: "create", path: "a.js" }])).toBeNull();
    expect(parseFileOperations([{ type: "rename", path: "a.js" }])).toBeNull();
  });
});
