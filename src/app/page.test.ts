import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const appSource = readFileSync(path.join(__dirname, "components/assessment-app.tsx"), "utf8");
const layoutSource = readFileSync(path.join(__dirname, "layout.tsx"), "utf8");

describe("assessment start screen", () => {
  it("offers the supported example action and URL entry points", () => {
    expect(pageSource).toContain("AssessmentApp");
    expect(appSource).toContain("Try supported example");
    expect(appSource).toContain("https://github.com/owner/repo");
    expect(appSource).toContain("Supported repository contract");
  });

  it("states the product boundary without microservices language as the goal", () => {
    expect(appSource).toContain("does not create microservices");
    expect(layoutSource).toContain("ToolBox");
  });

  it("traces candidates to evidence and labels safest technical candidate", () => {
    expect(appSource).toContain("safest technical candidate");
    expect(appSource).toContain("not a business priority");
    expect(appSource).toContain("Confirm Domain Candidate");
    expect(appSource).toContain("DependencyGraph");
  });
});
