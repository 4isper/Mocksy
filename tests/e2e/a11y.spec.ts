import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

// Accessibility audit of the editor shell and its interactive surfaces. Runs
// on the chromium project only (desktop viewport); the mobile layout shares
// the same components. New violations fail CI, so anything excluded here needs
// a written reason in `tags`/`rules` below.

const EXCLUDED_RULES: Record<string, string> = {
  // "color-contrast": panels intentionally use translucent glass backgrounds;
  // axe would measure against the wrong layer. Revisit if the theme changes.
};

type AxeImpact = "minor" | "moderate" | "serious" | "critical";

// Runs axe against the whole page and returns only violations at or above the
// given impact, so callers can scope how strict each surface must be.
async function audit(page: import("@playwright/test").Page, minImpact: AxeImpact = "serious") {
  const builder = Object.keys(EXCLUDED_RULES).length > 0
    ? new AxeBuilder({ page }).withRules(Object.keys(EXCLUDED_RULES))
    : new AxeBuilder({ page });
  const results = await builder.analyze();
  const ranks: AxeImpact[] = ["minor", "moderate", "serious", "critical"];
  const min = ranks.indexOf(minImpact);
  return results.violations.filter((v) => ranks.indexOf((v.impact ?? "minor") as AxeImpact) >= min);
}

function describeViolations(violations: { id: string; impact?: string | null; nodes: unknown[] }[]) {
  return violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`);
}

// Opens the right-panel tab by its visible label and waits for its panel to
// render. Each tab is a discrete surface worth auditing on its own.
async function openRightTab(page: import("@playwright/test").Page, label: string) {
  // The label may carry a count badge (e.g. "Layers2"), so match as a prefix.
  await page.getByRole("tab", { name: new RegExp(`^${label}`) }).click();
  await expect(page.locator("#right-panel-content")).toBeVisible();
}

test.describe("a11y", () => {
  test("editor page has no new axe violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#preview-canvas")).toBeVisible();

    const violations = await audit(page, "serious");
    expect(describeViolations(violations), "serious/critical accessibility violations").toEqual([]);
  });

  test("export dialog has no critical violations", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Export PNG \/ MP4/ }).click();
    await expect(page.locator(".modal[role='dialog']")).toBeVisible();

    const violations = await audit(page, "critical");
    expect(describeViolations(violations)).toEqual([]);
  });

  test("command palette has no critical violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#preview-canvas")).toBeVisible();
    await page.getByRole("button", { name: /Open command palette/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const violations = await audit(page, "critical");
    expect(describeViolations(violations)).toEqual([]);
  });

  test("shortcuts dialog has no critical violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#preview-canvas")).toBeVisible();
    await page.keyboard.press("Shift+Slash");
    await expect(page.getByRole("dialog", { name: /Keyboard shortcuts/ })).toBeVisible();

    const violations = await audit(page, "critical");
    expect(describeViolations(violations)).toEqual([]);
  });

  test("share QR dialog has no critical violations", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    await expect(page.locator("#preview-canvas")).toBeVisible();
    await page.getByRole("button", { name: /Copy Share URL/ }).click();
    await expect(page.getByRole("dialog", { name: /Scan to open/ })).toBeVisible();

    const violations = await audit(page, "critical");
    expect(describeViolations(violations)).toEqual([]);
  });

  test("right-panel tabs have no serious violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#preview-canvas")).toBeVisible();
    await expect(page.locator("#right-panel")).toBeVisible();

    for (const label of ["Scene presets", "Layers", "Annotations", "History", "Projects"]) {
      await openRightTab(page, label);
      const violations = await audit(page, "serious");
      expect(describeViolations(violations), `violations on "${label}" tab`).toEqual([]);
    }
  });

  test("preview context menu has no critical violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#preview-canvas")).toBeVisible();
    await page.locator("#preview-canvas").click({ button: "right" });
    await expect(page.getByRole("menu")).toBeVisible();

    const violations = await audit(page, "critical");
    expect(describeViolations(violations)).toEqual([]);
  });

  test("modals trap focus", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#preview-canvas")).toBeVisible();
    await page.keyboard.press("Shift+Slash");
    const dialog = page.getByRole("dialog", { name: /Keyboard shortcuts/ });
    await expect(dialog).toBeVisible();

    // Tab repeatedly; focus must never escape the dialog.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const active = page.locator("*:focus");
      await expect(active).toHaveCount(1);
      const inDialog = await dialog.evaluate((el) => el.contains(document.activeElement));
      expect(inDialog, "focus escaped the modal").toBe(true);
    }
  });

  test("layer list has proper ARIA listbox semantics", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#preview-canvas")).toBeVisible();
    await openRightTab(page, "Layers");

    const listbox = page.getByRole("listbox", { name: /^Layers/ });
    await expect(listbox).toBeVisible();
    await expect(listbox).toHaveAttribute("aria-multiselectable", "true");

    const options = listbox.getByRole("option");
    await expect(options.first()).toBeVisible();
    const count = await options.count();
    expect(count, "should have at least one layer option").toBeGreaterThanOrEqual(1);
  });

  test("layer keyboard navigation moves focus", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#preview-canvas")).toBeVisible();
    await openRightTab(page, "Layers");

    const options = page.getByRole("listbox", { name: /^Layers/ }).getByRole("option");
    const first = options.first();
    await first.click();
    await expect(first).toHaveAttribute("tabindex", "0");

    // Arrow down should move focus to the next option (if there are 2+ layers).
    const count = await options.count();
    if (count >= 2) {
      await first.press("ArrowDown");
      const second = options.nth(1);
      await expect(second).toBeFocused();
    }
  });

  test("preview canvas has accessible role and label", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#preview-canvas")).toBeVisible();

    const canvas = page.locator("#preview-canvas");
    await expect(canvas).toHaveAttribute("role", "group");
    await expect(canvas).toHaveAttribute("aria-label");
    const label = await canvas.getAttribute("aria-label");
    expect(label, "canvas aria-label should not be empty").toBeTruthy();
  });

  test("live announcer is present in the DOM", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#preview-canvas")).toBeVisible();

    const announcer = page.locator("[data-testid='live-announcer']");
    await expect(announcer).toHaveAttribute("aria-live", "polite");
    await expect(announcer).toHaveAttribute("aria-atomic", "true");
  });
});
