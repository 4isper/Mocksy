import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const waitForStable = async (page: import("@playwright/test").Page) => {
  // Wait for animations and fonts to settle.
  await page.waitForTimeout(600);
  // Wait until the preview canvas indicates it has rendered (no loading state).
  await expect(page.locator("#preview-canvas")).toBeVisible();
};

test("default scene renders consistently", async ({ page }) => {
  await page.goto("/");
  await waitForStable(page);
  await expect(page).toHaveScreenshot("default-scene.png", {
    maxDiffPixels: 80,
    mask: [
      // The "Saved" / "Unsaved" badge timestamp text is non-deterministic.
      page.locator(".autosave-badge")
    ]
  });
});

test("iphone16pro overlay renders consistently", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "16 Pro", exact: true }).click();
  await waitForStable(page);
  await expect(page).toHaveScreenshot("iphone16pro-overlay.png", {
    maxDiffPixels: 80,
    mask: [page.locator(".autosave-badge")]
  });
});

test("dark studio preset renders consistently", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Scene presets" }).click();
  await page.getByRole("button", { name: "Dark Studio" }).click();
  await waitForStable(page);
  await expect(page).toHaveScreenshot("dark-studio-preset.png", {
    maxDiffPixels: 80,
    mask: [page.locator(".autosave-badge")]
  });
});

test("annotations render consistently", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Annotations" }).click();
  await page.locator('.segmented[aria-label="Add annotation"] button', { hasText: "+ Text" }).click();
  await page.locator("textarea").fill("Hello Mocksy");
  await page.locator('.segmented[aria-label="Add annotation"] button', { hasText: "+ Arrow" }).click();
  await waitForStable(page);
  await expect(page).toHaveScreenshot("annotations.png", {
    maxDiffPixels: 80,
    mask: [page.locator(".autosave-badge")]
  });
});

test("export dialog renders consistently", async ({ page }) => {
  await page.goto("/");
  // The toolbar button's accessible name carries its shortcut tooltip
  // ("Export PNG / MP4 / GIF (⌘E)"), so match by prefix instead of exact.
  await page.getByRole("button", { name: /^Export/ }).click();
  await expect(page.locator(".modal[role='dialog']")).toBeVisible();
  await waitForStable(page);
  await expect(page).toHaveScreenshot("export-dialog.png", {
    maxDiffPixels: 40,
    clip: { x: 0, y: 0, width: 1440, height: 900 }
  });
});

test("mobile viewport renders consistently", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  await page.waitForTimeout(1200);
  await expect(page).toHaveScreenshot("mobile-viewport.png", {
    maxDiffPixels: 80,
    mask: [page.locator(".autosave-badge")]
  });
});

test("2-frame grid renders consistently", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "2", exact: true }).first().click();
  await waitForStable(page);
  await expect(page).toHaveScreenshot("two-frame-grid.png", {
    maxDiffPixels: 80,
    mask: [page.locator(".autosave-badge")]
  });
});

test("fan layout renders consistently", async ({ page }) => {
  await page.goto("/");
  // Layout buttons are disabled while no frames exist ("Add frames first"),
  // so re-layout the default grid instead of starting from an empty canvas.
  await page.getByRole("button", { name: "Fan" }).click();
  await waitForStable(page);
  await expect(page).toHaveScreenshot("fan-layout.png", {
    maxDiffPixels: 80,
    mask: [page.locator(".autosave-badge")]
  });
});

test("keyboard shortcuts dialog renders consistently", async ({ page }) => {
  await page.goto("/");
  await waitForStable(page);
  await page.keyboard.press("Shift+Slash");
  await expect(page.locator(".modal[role='dialog']")).toBeVisible();
  await waitForStable(page);
  await expect(page).toHaveScreenshot("shortcuts-dialog.png", {
    maxDiffPixels: 40,
    clip: { x: 0, y: 0, width: 1440, height: 900 }
  });
});
