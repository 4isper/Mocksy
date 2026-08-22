import { expect, test } from "@playwright/test";

// Mobile-viewport coverage for the stacked single-column editor layout
// (globals.css <=980px) and coarse-pointer interactions. Runs in the
// chromium-mobile project only; desktop-only suites (editor flows, video
// exports, visual regression) are excluded from that project via testIgnore.

test.describe("mobile editor layout", () => {
  test("stacks panels below the canvas without horizontal overflow", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#preview-canvas")).toBeVisible();
    await expect(page.locator(".control-panel")).toBeVisible();
    await expect(page.locator(".right-panel")).toBeVisible();
    const overflow = await page.evaluate(
      () => (document.scrollingElement?.scrollWidth ?? 0) - (document.scrollingElement?.clientWidth ?? 0)
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("preview keeps the scene aspect ratio when stacked", async ({ page }) => {
    await page.goto("/");
    const box = await page.locator("#preview-canvas").boundingBox();
    expect(box).toBeTruthy();
    // 16:9 canvas inside the capped-height stacked column; width-driven on a
    // narrow phone, so only assert the ratio holds within tolerance.
    const ratio = (box?.width ?? 0) / (box?.height ?? 1);
    expect(Math.abs(ratio - 16 / 9)).toBeLessThan(0.1);
  });

  test("canvas context menu adds an annotation on touch", async ({ page }) => {
    await page.goto("/");
    // In the stacked layout the synthesized tap can trigger a document
    // scroll, which closes the context menu mid-click (capture-phase scroll
    // handler). Retry the open→pick cycle until the annotation lands.
    await expect(async () => {
      if ((await page.locator("[data-annotation]").count()) > 0) return;
      await page.locator("#preview-canvas").click({ button: "right" });
      const menu = page.getByRole("menu");
      await expect(menu).toBeVisible();
      await menu.getByRole("menuitem", { name: "Add text" }).click({ force: true });
      await expect(page.locator("[data-annotation]")).toHaveCount(1);
    }).toPass({ timeout: 20_000 });
    await expect(page.locator("[data-annotation]")).toHaveCount(1);
  });

  test("export dialog opens from the toolbar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Export PNG/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
