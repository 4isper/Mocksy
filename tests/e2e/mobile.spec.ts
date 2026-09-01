import { expect, test } from "@playwright/test";

// Responsive-viewport coverage for the stacked single-column editor layout
// (<=980px), the mobile/tablet bottom-sheet navigation (<=980px), the
// slim-panel narrow-desktop range (981-1180px) and coarse-pointer
// interactions. Runs in the chromium-mobile project only; desktop-only suites
// (editor flows, video exports, visual regression) are excluded from that
// project via testIgnore.

test.describe("mobile editor layout", () => {
  test("keeps the preview in flow with panels behind the bottom tab bar", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#preview-canvas")).toBeVisible();
    const tabbar = page.locator(".mobile-tabbar");
    await expect(tabbar).toBeVisible();
    // Side panels start parked (no sheet open).
    await expect(page.locator(".sheet-host--controls")).not.toHaveClass(/is-open/);
    await expect(page.locator(".sheet-host--right")).not.toHaveClass(/is-open/);
    const overflow = await page.evaluate(
      () => (document.scrollingElement?.scrollWidth ?? 0) - (document.scrollingElement?.clientWidth ?? 0)
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("opens and closes side panels as bottom sheets", async ({ page }) => {
    await page.goto("/");
    const controls = page.locator(".sheet-host--controls");
    const right = page.locator(".sheet-host--right");
    const controlsTab = page.getByRole("button", { name: "Controls", exact: true });
    const layersTab = page.getByRole("button", { name: "Panels", exact: true });

    await controlsTab.click();
    await expect(controls).toHaveClass(/is-open/);
    await expect(controls.locator("#control-panel")).toBeVisible();
    await expect(controlsTab).toHaveAttribute("aria-expanded", "true");

    // Opening the other sheet switches instead of stacking.
    await layersTab.click();
    await expect(right).toHaveClass(/is-open/);
    await expect(right.locator("#right-panel")).toBeVisible();
    await expect(controls).not.toHaveClass(/is-open/);

    // Tapping the active tab toggles its sheet closed.
    await layersTab.click();
    await expect(right).not.toHaveClass(/is-open/);

    // Reopen and dismiss via the backdrop.
    await controlsTab.click();
    await expect(page.locator(".sheet-backdrop")).toBeVisible();
    await page.locator(".sheet-backdrop").click({ position: { x: 10, y: 10 } });
    await expect(controls).not.toHaveClass(/is-open/);
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

  test("keeps undo reachable in the bottom tab bar", async ({ page }) => {
    await page.goto("/");
    const undo = page.locator(".mobile-tabbar").getByRole("button", { name: /Undo/ });
    // Fresh session: no history yet, but the action is one tap away on the
    // always-visible bar instead of buried in the wrapped toolbar.
    await expect(undo).toBeVisible();
    await expect(undo).toBeDisabled();
  });

  test("export dialog opens from the toolbar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Export PNG/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test.describe("narrow desktop layout (981-1180px)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.goto("/");
    await expect(page.locator("#preview-canvas")).toBeVisible();
  });

  test("keeps panels beside the canvas instead of stacking", async ({ page }) => {
    const control = await page.locator(".control-panel").boundingBox();
    const right = await page.locator(".right-panel").boundingBox();
    expect(control).toBeTruthy();
    expect(right).toBeTruthy();
    // Same grid row: both panels start at the same top offset, unlike the
    // stacked single column at <=980px.
    expect(Math.abs(control!.y - right!.y)).toBeLessThan(5);
    const overflow = await page.evaluate(
      () => (document.scrollingElement?.scrollWidth ?? 0) - (document.scrollingElement?.clientWidth ?? 0)
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("applies the slim panel-width tokens", async ({ page }) => {
    const widths = await page.evaluate(() => ({
      left: getComputedStyle(document.documentElement).getPropertyValue("--panel-left-w").trim(),
      right: getComputedStyle(document.documentElement).getPropertyValue("--panel-right-w").trim()
    }));
    expect(widths.left).toBe("244px");
    expect(widths.right).toBe("276px");
  });
});
