import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoSeriousAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const seriousViolations = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(seriousViolations).toEqual([]);
}

test("landing and assessment start are accessible and connected", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Turn one tangled Express domain into an accepted module.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Open work console" })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);

  await page.getByRole("link", { name: "Open work console" }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("button", { name: "Try controlled example" })).toBeVisible();
  await expect(page.getByLabel("Public GitHub repository URL")).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
});
