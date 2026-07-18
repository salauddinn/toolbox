import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const appSource = readFileSync(path.join(__dirname, "components/assessment-app.tsx"), "utf8");
const landingSource = readFileSync(
  path.join(__dirname, "components/marketing-landing.tsx"),
  "utf8",
);
const workConsolePageSource = readFileSync(path.join(__dirname, "app/page.tsx"), "utf8");
const layoutSource = readFileSync(path.join(__dirname, "layout.tsx"), "utf8");

describe("assessment start screen", () => {
  it("offers the supported example action and URL entry points", () => {
    expect(pageSource).toContain("MarketingLanding");
    expect(workConsolePageSource).toContain("AssessmentApp");
    expect(appSource).toContain("Try controlled example");
    expect(appSource).toContain("https://github.com/owner/repo");
    expect(appSource).toContain("supported contract");
  });

  it("states the product boundary without microservices language as the goal", () => {
    expect(landingSource).toContain("no microservices required");
    expect(landingSource).toContain("No rewrite or");
    expect(layoutSource).toContain("ToolBox");
  });

  it("makes the bounded AI role explicit", () => {
    expect(landingSource).toContain('AI role", v: "Bounded');
    expect(appSource).toContain("Authorize AI generation for this stage");
    expect(appSource).toContain("AI-generated, validated Change Set");
  });

  it("traces candidates to evidence and labels safest technical candidate", () => {
    expect(appSource).toContain("safest technical candidate");
    expect(appSource).toContain("not a business priority");
    expect(appSource).toContain("Confirm Domain Candidate");
    expect(appSource).toContain("DependencyGraph");
  });
});
