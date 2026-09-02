import { expect, test } from "@playwright/test";
import { openRightPanel } from "./helpers";

// End-to-end coverage for locale switching: the URL-driven proxy + next-intl
// pipeline and the LocaleSwitcher. Verifies the whole UI actually re-renders in
// the chosen language (not just the switcher) and that partial-coverage locales
// degrade gracefully to English fallback instead of crashing.

test.describe("i18n", () => {
  test("switching to Russian re-renders the UI in Russian", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#preview-canvas")).toBeVisible();

    // Default locale is English. On mobile the right panel is a parked
    // bottom sheet; open it so the panel tab is visible.
    await expect(page.getByLabel("Language")).toBeVisible();
    await openRightPanel(page);
    await expect(page.getByRole("tab", { name: /^Layers/ })).toBeVisible();

    await page.locator("select.locale-select").selectOption("ru");
    await expect(page).toHaveURL(/\/ru/);

    // The re-rendered UI is now Russian: the switcher label and a panel tab
    // both come through the translation layer.
    await expect(page.getByLabel("Язык")).toBeVisible();
    await openRightPanel(page);
    await expect(page.getByRole("tab", { name: /^Слои/ })).toBeVisible();
  });

  test("partial locale renders and applies its translations", async ({ page }) => {
    // German is ~91% translated: it must still load, show partial coverage in
    // the switcher, and apply the strings it does have. The "(partial)" badge
    // is a translated key, so on /de it renders in German ("teilweise") —
    // match either form instead of hardcoding the English one.
    await page.goto("/de");
    await expect(page.locator("#preview-canvas")).toBeVisible();
    await expect(page.getByLabel("Sprache")).toBeVisible();

    const select = page.locator("select.locale-select");
    await expect(select).toHaveValue("de");
    await expect(
      select.locator("option", { hasText: /Deutsch \((partial|teilweise)\)/ })
    ).toHaveCount(1);

    // Translated keys render in German; untranslated ones fall back to English
    // without breaking the editor.
    await openRightPanel(page);
    await expect(page.getByRole("tab", { name: /^Ebenen/ })).toBeVisible();
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });
});
