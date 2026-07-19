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
      name: "From a Supported Repository to one accepted Domain Module.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Open work console" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Modernization workflow" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Responsibility ledger" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Requirements for assessment" })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);

  // No page-level horizontal overflow at a narrow mobile width.
  await page.setViewportSize({ width: 320, height: 720 });
  const hasPageOverflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
  expect(hasPageOverflow).toBe(false);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("link", { name: "Open work console" }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("button", { name: "Try controlled example" })).toBeVisible();
  await expect(page.getByLabel("Public GitHub repository URL")).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
});
