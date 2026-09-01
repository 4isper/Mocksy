import { expect, test } from "@playwright/test";

// Tablet coverage for the responsive layout. The desktop project runs at
// 1280px and the mobile project at a 412px phone, leaving two zones to cover:
// the 981–1180px slim-panel desktop layout and the 769–980px tablet band,
// which shares the phone's bottom-sheet navigation. These verify the editor
// stays usable and never produces horizontal overflow at tablet sizes.

async function horizontalOverflow(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test.describe("tablet", () => {
  test("landscape (1024px) keeps the slim-panel desktop layout usable", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/");
    await expect(page.locator("#preview-canvas")).toBeVisible();
    await expect(page.locator("#right-panel")).toBeVisible();
    await expect(page.getByRole("button", { name: /Export PNG \/ MP4/ })).toBeVisible();

    // No horizontal overflow at the slim-panel width.
    expect(await horizontalOverflow(page), "horizontal overflow at 1024px").toBeLessThanOrEqual(1);

    // Export dialog must still open and dismiss at this size.
    await page.getByRole("button", { name: /Export PNG \/ MP4/ }).click();
    await expect(page.locator(".modal[role='dialog']")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".modal[role='dialog']")).toHaveCount(0);
  });

  test("portrait (834px) uses the tablet bottom navigation", async ({ page }) => {
    await page.setViewportSize({ width: 834, height: 1112 });
    await page.goto("/");
    await expect(page.locator("#preview-canvas")).toBeVisible();
    // The bottom-sheet breakpoint covers the whole <=980px band, so tablets in
    // portrait get the same one-tap tab bar as phones instead of panels buried
    // below the fold.
    const tabbar = page.locator(".mobile-tabbar");
    await expect(tabbar).toBeVisible();
    // Undo stays reachable on the always-visible bar.
    await expect(tabbar.getByRole("button", { name: /Undo/ })).toBeVisible();

    // Side panels start parked; the right panel is now a sheet, not a flow column.
    await expect(page.locator(".sheet-host--right")).not.toHaveClass(/is-open/);
    await expect(page.locator(".sheet-host--controls")).not.toHaveClass(/is-open/);

    // Opening the Layers sheet keeps everything on screen (no horizontal overflow).
    await tabbar.getByRole("button", { name: "Panels", exact: true }).click();
    await expect(page.locator(".sheet-host--right")).toHaveClass(/is-open/);
    await page.locator(".sheet-backdrop").click({ position: { x: 10, y: 10 } });
    expect(await horizontalOverflow(page), "horizontal overflow at 834px").toBeLessThanOrEqual(1);
  });
});
