import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

// Accessibility audit of the editor shell in its default state. Runs on the
// chromium project only (desktop viewport); the mobile layout shares the same
// components. New violations fail CI, so anything excluded here needs a
// written reason in `tags`/`rules` below.

const EXCLUDED_RULES: Record<string, string> = {
  // "color-contrast": panels intentionally use translucent glass backgrounds;
  // axe measures against the wrong layer. Revisit if the theme changes.
};

test.describe("a11y", () => {
  test("editor page has no new axe violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#preview-canvas")).toBeVisible();

    const builder = new AxeBuilder({ page });
    const results = await (Object.keys(EXCLUDED_RULES).length > 0 ? builder.withRules(Object.keys(EXCLUDED_RULES)) : builder).analyze();
    const violations = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");

    expect(
      violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`),
      "critical/serious accessibility violations"
    ).toEqual([]);
  });

  test("export dialog has no critical violations", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Export PNG/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const violations = results.violations.filter((v) => v.impact === "critical");
    expect(violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  });
});
