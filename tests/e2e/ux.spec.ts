import { expect, test } from "@playwright/test";
import { clickToolbarAction, isMobileLayout, openRightTab } from "./helpers";

// E2E coverage for the UX features: full-screen preview, right-click context
// menus, the "Surprise me" random style and the onboarding tour. Runs against
// the real app strings (default en locale) on both the desktop and the
// mobile (stacked bottom-sheet) layouts.

test.describe("full-screen preview", () => {
  test("F hides the panels and Esc restores them", async ({ page }) => {
    await page.goto("/");
    if (await isMobileLayout(page)) {
      // Stacked layout: the panels are mounted but parked (hidden) until
      // their bottom sheet opens, so "restores" means back in the DOM.
      await expect(page.locator(".control-panel")).toBeHidden();
    } else {
      await expect(page.locator(".control-panel")).toBeVisible();
      await expect(page.locator(".right-panel")).toBeVisible();
    }

    await page.keyboard.press("f");
    await expect(page.locator(".control-panel")).toHaveCount(0);
    await expect(page.locator(".right-panel")).toHaveCount(0);
    // The preview fills the editor; an exit affordance is shown.
    await expect(page.getByRole("button", { name: "Exit full screen (Esc)" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator(".control-panel")).toHaveCount(1);
    await expect(page.locator(".right-panel")).toHaveCount(1);
    if (!(await isMobileLayout(page))) {
      await expect(page.locator(".control-panel")).toBeVisible();
      await expect(page.locator(".right-panel")).toBeVisible();
    }
  });

  test("toolbar button enters full screen", async ({ page }) => {
    await page.goto("/");
    // At the mobile breakpoint the fullscreen button folds behind the "…"
    // overflow menu; the helper falls back to it automatically.
    await clickToolbarAction(page, /Full-screen preview/);
    await expect(page.locator(".control-panel")).toHaveCount(0);
    await page.getByRole("button", { name: "Exit full screen (Esc)" }).click();
    await expect(page.locator(".control-panel")).toHaveCount(1);
    if (!(await isMobileLayout(page))) {
      await expect(page.locator(".control-panel")).toBeVisible();
    }
  });
});

test.describe("context menus", () => {
  test("empty canvas menu adds a text annotation", async ({ page }) => {
    test.skip(test.info().project.name === "chromium-mobile", "touch right-click re-mounts the menu mid-click; covered natively in mobile.spec.ts");
    await page.goto("/");
    await expect(page.locator("[data-annotation]")).toHaveCount(0);

    await page.locator("#preview-canvas").click({ button: "right" });
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: "Add text" }).click();

    await expect(page.locator("[data-annotation]")).toHaveCount(1);
    // Menu closes after an action.
    await expect(menu).toHaveCount(0);
  });

  test("annotation menu deletes the annotation", async ({ page }) => {
    test.skip(test.info().project.name === "chromium-mobile", "touch right-click re-mounts the menu mid-click; covered natively in mobile.spec.ts");
    await page.goto("/");
    await page.locator("#preview-canvas").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Add text" }).click();
    await expect(page.locator("[data-annotation]")).toHaveCount(1);

    await page.locator("[data-annotation]").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.locator("[data-annotation]")).toHaveCount(0);
  });

  test("layer row menu duplicates the layer", async ({ page }) => {
    test.skip(test.info().project.name === "chromium-mobile", "touch right-click re-mounts the menu mid-click; covered natively in mobile.spec.ts");
    await page.goto("/");
    await openRightTab(page, "Layers");
    const items = page.locator(".layer-item");
    // The first-run demo scene ships several layers; duplicate one of them.
    await expect(items.first()).toBeVisible();
    const before = await items.count();

    await items.first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(items).toHaveCount(before + 1);
  });
});

test.describe("surprise style", () => {
  test("Surprise me applies a random appearance without dropping media", async ({ page }) => {
    await page.goto("/");
    // On mobile the right panel is a bottom sheet; the helper opens it first.
    await openRightTab(page, "Scene presets");

    const appearance = () =>
      page.evaluate(() => {
        const raw = localStorage.getItem("mocksy-projects");
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { projects?: Array<{ scene?: { backgroundMode?: string; backgroundColor?: string; stylePreset?: string; layers?: Array<{ mediaUrl: string | null }> }; updatedAt?: number }> };
        const project = parsed.projects?.[0];
        if (!project?.scene) return null;
        return {
          mode: project.scene.backgroundMode ?? "",
          color: project.scene.backgroundColor ?? "",
          style: project.scene.stylePreset ?? "",
          // Autosave writes are debounced; the timestamp tells a fresh write
          // from the previous one, which the loop below waits for.
          updatedAt: project.updatedAt ?? 0,
          hasMedia: (project.scene.layers ?? []).some((l) => !!l.mediaUrl)
        };
      });

    await expect.poll(appearance, { timeout: 10000 }).not.toBeNull();
    const before = (await appearance())!;

    // The randomizer may legitimately repeat the current look — click until
    // the appearance triple actually changes (bounded to keep the test fast).
    // Each round waits for the debounced autosave write to land (updatedAt
    // moves) before comparing, so a fresh read can't see the stale scene.
    const button = page.getByRole("button", { name: "Surprise me" });
    const sameLook = (a: NonNullable<Awaited<ReturnType<typeof appearance>>>, b: NonNullable<Awaited<ReturnType<typeof appearance>>>) =>
      a.mode === b.mode && a.color === b.color && a.style === b.style;
    let after = before;
    for (let i = 0; i < 8 && sameLook(after, before); i++) {
      await button.click();
      await expect
        .poll(async () => {
          const s = await appearance();
          return s !== null && s.updatedAt !== before.updatedAt;
        }, { timeout: 10000 })
        .toBe(true);
      after = (await appearance())!;
    }
    expect([after.mode, after.color, after.style]).not.toEqual([before.mode, before.color, before.style]);
    // Media survives the randomize.
    expect(after.hasMedia).toBe(true);
  });
});

test.describe("onboarding tour", () => {
  test("opens from the command palette, walks steps and persists the seen flag", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("dialog")).toHaveCount(0); // not auto-opened under automation

    await page.keyboard.press("ControlOrMeta+K");
    const paletteInput = page.getByPlaceholder("Type a command…");
    await paletteInput.fill("intro");
    await page.getByRole("option", { name: "Show the intro tour" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Welcome to Mocksy");

    // Walk every step.
    for (let i = 0; i < 4; i++) {
      await dialog.getByRole("button", { name: "Next", exact: true }).click();
    }
    await expect(dialog).toContainText("You're all set");
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("mocksy.onboardingSeen"))).toBe("1");

    // Reopening from the palette still works after the flag is set.
    await page.keyboard.press("ControlOrMeta+K");
    await paletteInput.fill("intro");
    await page.getByRole("option", { name: "Show the intro tour" }).first().click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Skip tour" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("Escape dismisses the tour", async ({ page }) => {
    await page.goto("/");
    // Wait for hydration so the ⌘K handler is attached before pressing it.
    await expect(page.getByRole("dialog")).toHaveCount(0); // not auto-opened under automation
    await page.keyboard.press("ControlOrMeta+K");
    await page.getByPlaceholder("Type a command…").fill("intro");
    await page.getByRole("option", { name: "Show the intro tour" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Welcome to Mocksy");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("mocksy.onboardingSeen"))).toBe("1");
  });
});
