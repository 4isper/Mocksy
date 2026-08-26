import { expect, test } from "@playwright/test";

// Tablet coverage for the responsive layout. The desktop project runs at
// 1280px and the mobile project at a 412px phone, leaving two zones untested:
// the 769–980px stacked layout (panels in flow, no bottom sheet) and the
// 981–1180px slim-panel desktop layout. These verify the editor stays usable
// and never produces horizontal overflow at tablet sizes.

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

  test("portrait (834px) uses the stacked layout without the mobile bottom sheet", async ({ page }) => {
    await page.setViewportSize({ width: 834, height: 1112 });
    await page.goto("/");
    await expect(page.locator("#preview-canvas")).toBeVisible();
    // Above the 768px bottom-sheet breakpoint the right panel stays in flow.
    await expect(page.locator("#right-panel")).toBeVisible();
    await expect(page.locator(".mobile-tabbar")).toBeHidden();

    expect(await horizontalOverflow(page), "horizontal overflow at 834px").toBeLessThanOrEqual(1);
  });
});
