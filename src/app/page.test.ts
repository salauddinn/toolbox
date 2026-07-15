import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const layoutSource = readFileSync(path.join(__dirname, "layout.tsx"), "utf8");

describe("placeholder start screen", () => {
  it("offers the supported example action and URL entry points", () => {
    expect(pageSource).toContain("Try supported example");
    expect(pageSource).toContain("https://github.com/owner/repo");
    expect(pageSource).toContain("Supported repository contract");
  });

  it("states the product boundary without microservices language as the goal", () => {
    expect(pageSource).toContain("does not create microservices");
    expect(layoutSource).toContain("ToolBox");
  });
});
