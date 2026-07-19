import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoSeriousAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const seriousViolations = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(seriousViolations).toEqual([]);
}

async function expectNoPageHorizontalOverflow(page: Page) {
  const hasPageOverflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
  expect(hasPageOverflow).toBe(false);
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
  await expect(page.getByTestId("theme-toggle")).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);

  // No page-level horizontal overflow at a narrow mobile width.
  await page.setViewportSize({ width: 320, height: 720 });
  await expectNoPageHorizontalOverflow(page);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("link", { name: "Open work console" }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("button", { name: "Try controlled example" })).toBeVisible();
  await expect(page.getByLabel("Public GitHub repository URL")).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
});

test("theme toggle persists, stays user-controlled, and keeps pages accessible", async ({
  page,
}) => {
  await page.addInitScript(() => {
    try {
      // Init scripts run on every navigation; clear only the new test tab's
      // initial state so the subsequent reload can prove persistence.
      if (!window.sessionStorage.getItem("toolbox-theme-test-initialized")) {
        window.localStorage.removeItem("toolbox-theme");
        window.sessionStorage.setItem("toolbox-theme-test-initialized", "true");
      }
    } catch {
      // ignore
    }
  });

  await page.goto("/");

  const toggle = page.getByTestId("theme-toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  // Default is light even when the OS prefers dark (no auto inversion).
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(async () => page.locator("html").getAttribute("data-theme")).toBe("light");

  await toggle.focus();
  await expect(toggle).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => page.locator("html").getAttribute("data-theme")).toBe("dark");
  await expect
    .poll(async () => page.evaluate(() => window.localStorage.getItem("toolbox-theme")))
    .toBe("dark");

  await expectNoSeriousAccessibilityViolations(page);

  await page.reload();
  await expect.poll(async () => page.locator("html").getAttribute("data-theme")).toBe("dark");
  await expect(page.getByTestId("theme-toggle")).toHaveAttribute("aria-pressed", "true");
  await expectNoSeriousAccessibilityViolations(page);

  await page.goto("/app");
  await expect.poll(async () => page.locator("html").getAttribute("data-theme")).toBe("dark");
  await expect(page.getByRole("button", { name: "Try controlled example" })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);

  // 320px overflow in dark mode on both primary routes.
  await page.setViewportSize({ width: 320, height: 720 });
  await expectNoPageHorizontalOverflow(page);
  await page.goto("/");
  await expectNoPageHorizontalOverflow(page);

  // Approximate 200% zoom by halving a desktop viewport; content must not force page overflow.
  await page.setViewportSize({ width: 640, height: 360 });
  await expectNoPageHorizontalOverflow(page);
  await page.goto("/app");
  await expect(page.getByRole("main")).toBeVisible();
  await expectNoPageHorizontalOverflow(page);
});
