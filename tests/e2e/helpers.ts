import { expect, type Page } from "@playwright/test";

// Shared e2e helpers for the responsive editor shell. At the <=980px
// breakpoint the side panels live in parked bottom sheets behind the fixed
// tab bar and the secondary toolbar actions fold behind the "…" overflow
// menu, so tests must not assume the desktop grid layout.

// True when the editor renders the stacked mobile layout (<=980px).
export async function isMobileLayout(page: Page): Promise<boolean> {
  const tabbar = page.locator(".mobile-tabbar");
  return (await tabbar.count()) > 0 && (await tabbar.first().isVisible());
}

// Opens the right panel in either layout. On mobile the panel is a parked
// bottom sheet, so the "Panels" tab-bar button must open it first. The
// button is matched via aria-controls (translation-independent) and toggling
// is skipped when the sheet is already open (the tab toggles its sheet).
export async function openRightPanel(page: Page): Promise<void> {
  if (!(await isMobileLayout(page))) return;
  const panelsTab = page.locator('button[aria-controls="right-panel"]');
  await panelsTab.waitFor({ state: "visible" });
  if ((await panelsTab.getAttribute("aria-expanded")) !== "true") {
    await panelsTab.click();
  }
  await expect(page.locator(".sheet-host--right")).toHaveClass(/is-open/);
}

// Opens a right-panel tab by its visible label (prefix match — the label may
// carry a count badge like "Layers2"), opening the bottom sheet on mobile
// first, and waits for the tab's panel to render.
export async function openRightTab(page: Page, label: string): Promise<void> {
  await openRightPanel(page);
  await page.getByRole("tab", { name: new RegExp(`^${label}`) }).click();
  await expect(page.locator("#right-panel-content")).toBeVisible();
}

// Clicks a toolbar action that folds behind the "…" overflow menu at the
// mobile breakpoint: direct click when the button is visible, overflow
// menu item otherwise.
export async function clickToolbarAction(page: Page, label: RegExp): Promise<void> {
  const button = page.getByRole("button", { name: label });
  if (await button.isVisible()) {
    await button.click();
    return;
  }
  await page.getByRole("button", { name: /More actions/ }).click();
  await page.getByRole("menuitem", { name: label }).click();
}
