import { describe, expect, it, vi } from "vitest";
import { screenChromeElements, screenChromeSvg, drawScreenChrome, androidGridGeom, ANDROID_GRID_APPS, GRID_ICON_PRESETS, SCREEN_CHROME_DOCK_COLORS } from "@/lib/render/screenChrome";
import { frameOs } from "@/lib/render/frames";
import { DEFAULT_SCREEN_CHROME } from "@/lib/state/editorScene";
import type { ScreenChrome } from "@/lib/types/editor";

const W = 390;
const H = 844;

function chrome(overrides: Partial<ScreenChrome> = {}): ScreenChrome {
  return { ...DEFAULT_SCREEN_CHROME, ...overrides };
}

describe("screenChromeElements", () => {
  it("renders the top scrim and a gradient for every style", () => {
    const out = screenChromeElements(chrome(), W, H, "t");
    expect(out).toContain("<defs>");
    expect(out).toContain('id="t-top"');
    expect(out).toContain("linearGradient");
    expect(out).toContain("fill=\"url(#t-top)\"");
  });

  it("omits the top scrim when nothing is drawn in the top area", () => {
    const homeOnly = screenChromeElements(chrome({ style: "home", showStatusBar: false }), W, H, "t");
    expect(homeOnly).not.toContain("<defs>");
    const lockFlagsOff = screenChromeElements(chrome({ showStatusBar: false, showClock: false, showDate: false }), W, H, "t");
    expect(lockFlagsOff).not.toContain("<defs>");
  });

  it("keeps the scrim when only the clock is visible (status bar off)", () => {
    const out = screenChromeElements(chrome({ showStatusBar: false }), W, H, "t");
    expect(out).toContain("<defs>");
  });

  it("places the lock date above the big clock like iOS", () => {
    const out = screenChromeElements(chrome(), W, H, "t");
    const texts = [...out.matchAll(/<text [^>]*y="([\d.]+)"[^>]*>([^<]+)<\/text>/g)].map((m) => ({
      y: Number(m[1]),
      content: m[2]
    }));
    const sorted = [...texts].sort((a, b) => a.y - b.y);
    expect(sorted).toHaveLength(3);
    const statusBar = sorted[0]!;
    const date = sorted[1]!;
    const clock = sorted[2]!;
    expect(statusBar.content).toBe("9:41");
    expect(statusBar.y).toBeLessThan(H * 0.05);
    expect(date.content).toBe("Tuesday, August 4");
    expect(date.y).toBeGreaterThan(statusBar.y);
    expect(date.y).toBeLessThan(clock.y);
    expect(clock.content).toBe("9:41");
    expect(clock.y).toBeGreaterThan(H * 0.12);
  });

  it("lock style draws status bar time, clock, date, shortcut buttons and home indicator", () => {
    const out = screenChromeElements(chrome(), W, H, "t");
    // status bar time + lock clock + lock date
    expect(out.match(/<text /g)).toHaveLength(3);
    expect(out).toContain("9:41");
    expect(out).toContain("Tuesday, August 4");
    // two shortcut rings + camera lens + the wi-fi dot
    expect(out.match(/<circle /g)).toHaveLength(4);
    // three wi-fi arcs + battery outline + camera lens
    expect(out.match(/fill="none"/g)).toHaveLength(5);
    // home indicator pill
    expect(out).toContain('fill="rgba(255,255,255,0.92)"');
  });

  it("draws flashlight and camera glyphs near the screen edges", () => {
    const out = screenChromeElements(chrome(), W, H, "t");
    // shortcut circles sit at ±0.346w from center (iOS-like edge placement)
    expect(out).toContain('cx="60.1"');
    expect(out).toContain('cx="329.9"');
    // real glyphs instead of placeholder dots: camera body is a g-wide rect
    expect(out).toContain('width="22.3"');
    expect(out).not.toContain('r="12.8"'); // old inner placeholder dot
  });

  it("suppresses the shortcut rings when showLockShortcuts is false", () => {
    const out = screenChromeElements(chrome({ showLockShortcuts: false }), W, H, "t");
    // no flashlight/camera circles: only the wi-fi dot + camera lens remain
    expect(out).not.toContain('cx="60.1"');
    expect(out).not.toContain('cx="329.9"');
  });

  it("honors the per-frame lockShortcuts spec", () => {
    // Pixel frame declares lockShortcuts: false, so iOS lock style draws none
    const out = screenChromeElements(chrome({ style: "lock", os: "ios" }), W, H, "t", "pixel8pro");
    expect(out).not.toContain('cx="60.1"');
    expect(out).not.toContain('cx="329.9"');
    // iPhone shows them
    const ios = screenChromeElements(chrome({ style: "lock", os: "ios" }), W, H, "t", "iphone15");
    expect(ios).toContain('cx="60.1"');
  });

  it("home dock uses an iOS-like corner radius and squircle icons", () => {
    const out = screenChromeElements(chrome({ style: "home" }), W, H, "t");
    const dockH = H * 0.112;
    const dockRx = Math.round(dockH * 0.4 * 10) / 10;
    expect(out).toContain(`rx="${dockRx}"`); // rounded rect, not a capsule
    // Icons are superellipse squircles (paths closing with Z), not plain rects.
    expect(out.match(/d="M [^"]+ Z"/g)).toHaveLength(4);
    // The squircle outline passes through the first icon's edge midpoints.
    expect(out).toContain("96.7 742.7"); // right-center of the first icon
    expect(out).toContain("67.5 713.5"); // top-center of the first icon
    expect(out).not.toContain(`width="${W * 0.15}"`);
    expect(out).not.toContain(`rx="${dockH / 2}"`);
  });

  it("home style draws the dock icons instead of the clock", () => {
    const out = screenChromeElements(chrome({ style: "home" }), W, H, "t");
    // only the status bar time remains
    expect(out.match(/<text /g)).toHaveLength(1);
    for (const color of SCREEN_CHROME_DOCK_COLORS) {
      expect(out).toContain(`fill="${color}"`);
    }
    expect(out).not.toContain("Tuesday, August 4");
  });

  it("statusBar style draws neither clock nor dock", () => {
    const out = screenChromeElements(chrome({ style: "statusBar" }), W, H, "t");
    expect(out.match(/<text /g)).toHaveLength(1);
    expect(out).not.toContain("Tuesday, August 4");
  });

  it("respects the showStatusBar flag", () => {
    const out = screenChromeElements(chrome({ showStatusBar: false }), W, H, "t");
    // no battery body when the status bar is hidden
    expect(out).not.toContain('width="11.1"');
    const bare = screenChromeElements(chrome({ style: "statusBar", showStatusBar: false, showHomeIndicator: false }), W, H, "t");
    expect(bare).not.toContain('fill="none"');
  });

  it("keeps signal bars below the battery height", () => {
    const out = screenChromeElements(chrome({ style: "statusBar" }), W, H, "t");
    const batteryH = H * 0.015;
    const barHeights = [...out.matchAll(/width="2\.9" height="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(barHeights).toHaveLength(4);
    for (const bh of barHeights) {
      expect(bh).toBeLessThan(batteryH);
    }
    expect(Math.max(...barHeights)).toBeGreaterThan(batteryH * 0.3);
  });

  it("sizes the status bar time like iOS and separates the signal bars", () => {
    const out = screenChromeElements(chrome({ style: "statusBar" }), W, H, "t");
    // ~17.7px at 390×844, matching the real ~17pt status bar font
    expect(out).toContain('font-size="17.7"');
    const xs = [...out.matchAll(/<rect x="([\d.]+)" y="[\d.]+" width="2\.9"/g)].map((m) => Number(m[1]));
    expect(xs).toHaveLength(4);
    const sorted = [...xs].sort((a, b) => a - b);
    // pitch must exceed the bar width so bars never touch
    expect(sorted[1]! - sorted[0]!).toBeGreaterThan(3.5);
    expect(sorted[2]! - sorted[1]!).toBeGreaterThan(3.5);
    expect(sorted[3]! - sorted[2]!).toBeGreaterThan(3.5);
  });

  it("keeps the android triangle within the battery height", () => {
    const out = screenChromeElements(chrome({ showStatusBar: true, os: "android" }), W, H, "t");
    const tri = out.match(/<path d="M ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+) Z"/)!;
    const baseY = Number(tri[2]);
    const topY = Number(tri[6]);
    expect(baseY - topY).toBeLessThan(H * 0.015);
  });

  it("respects the showHomeIndicator flag", () => {
    const out = screenChromeElements(chrome({ showHomeIndicator: false }), W, H, "t");
    expect(out).not.toContain('fill="rgba(255,255,255,0.92)"');
  });

  it("hides the dock when showDock is false", () => {
    const out = screenChromeElements(chrome({ style: "home", showDock: false }), W, H, "t");
    expect(out).not.toContain('fill="rgba(255,255,255,0.16)"');
  });

  it("hides the lock clock and date individually", () => {
    const noClock = screenChromeElements(chrome({ showClock: false }), W, H, "t");
    expect(noClock.match(/<text /g)).toHaveLength(2); // status bar time + date
    const noDate = screenChromeElements(chrome({ showDate: false }), W, H, "t");
    expect(noDate).not.toContain("Tuesday, August 4");
  });

  it("escapes user-provided time and date text", () => {
    const out = screenChromeElements(chrome({ time: "1<2", date: 'a"b' }), W, H, "t");
    expect(out).toContain("1&lt;2");
    expect(out).toContain('a&quot;b');
  });

  it("uses the light theme palette when configured", () => {
    const dark = screenChromeElements(chrome(), W, H, "t");
    const light = screenChromeElements(chrome({ theme: "light" }), W, H, "t");
    expect(light).toContain('fill="#0a0a0a"');
    expect(dark).toContain('fill="#ffffff"');
  });

  it("clockSizeFactor scales the lock clock vertically", () => {
    const baseline = screenChromeElements(chrome(), W, H, "t");
    const large = screenChromeElements(chrome({ clockSizeFactor: 0.20 }), W, H, "t");
    // Default clock y ≈ 147.7; with clockYFactor unchanged, only the font-size changes.
    const baseSize = Number(baseline.match(/font-size="([\d.]+)" font-weight="200"/)![1]);
    const largeSize = Number(large.match(/font-size="([\d.]+)" font-weight="200"/)![1]);
    expect(largeSize).toBeGreaterThan(baseSize);
  });

  it("clockYFactor moves the lock clock up and down", () => {
    const high = screenChromeElements(chrome({ clockYFactor: 0.10 }), W, H, "t");
    const low = screenChromeElements(chrome({ clockYFactor: 0.35 }), W, H, "t");
    // Grab the y attribute of the <text> element that carries the big lock
    // clock (font-weight="200").
    const extractClockY = (svg: string) => {
      const m = svg.match(/<text x="[\d.]+" y="([\d.]+)" font-size="[\d.]+" font-weight="200"/);
      return m ? Number(m[1]) : NaN;
    };
    const highY = extractClockY(high);
    const lowY = extractClockY(low);
    expect(lowY).toBeGreaterThan(highY);
  });

  it("clockColor overrides the theme-derived clock text color", () => {
    const defaultDark = screenChromeElements(chrome(), W, H, "t");
    // Default dark theme clock color is #ffffff; override to red.
    const custom = screenChromeElements(chrome({ clockColor: "#ff0000" }), W, H, "t");
    // The clock font-weight=200 text (lock clock) uses clockColor
    expect(custom).toContain('font-weight="200" fill="#ff0000"');
    // Default dark theme clock uses fg=#ffffff
    expect(defaultDark).toContain('font-weight="200" fill="#ffffff"');
  });

  it("clockColor also colors the lock date line", () => {
    const custom = screenChromeElements(chrome({ clockColor: "#aabbcc" }), W, H, "t");
    // Date uses clockDim which equals clockColor when set.
    expect(custom).toContain('font-weight="600" fill="#aabbcc"');
  });

  it("dockBackground overrides the default translucent dock fill", () => {
    const out = screenChromeElements(chrome({ style: "home", dockBackground: "#123456" }), W, H, "t");
    expect(out).toContain('fill="#123456"');
    // No default translucent fill present
    expect(out).not.toContain('fill="rgba(255,255,255,0.16)"');
  });

  it("dockColors overrides the default 4-icon dock palette", () => {
    const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00"];
    const out = screenChromeElements(chrome({ style: "home", dockColors: colors }), W, H, "t");
    for (const c of colors) {
      expect(out).toContain(`fill="${c}"`);
    }
    for (const c of SCREEN_CHROME_DOCK_COLORS) {
      expect(out).not.toContain(`fill="${c}"`);
    }
  });

  it("dockColors falls back to default when empty array is provided", () => {
    const out = screenChromeElements(chrome({ style: "home", dockColors: [] }), W, H, "t");
    for (const c of SCREEN_CHROME_DOCK_COLORS) {
      expect(out).toContain(`fill="${c}"`);
    }
  });

  it("renders custom dock icons with emoji and labels on the home dock", () => {
    const out = screenChromeElements(
      chrome({
        style: "home",
        dockIcons: [
          { label: "Mail", color: "#ff3b30", emoji: "✉️" },
          { label: "Maps", color: "#34c759", emoji: "🗺️" }
        ]
      }),
      W, H, "t"
    );
    expect(out).toContain('fill="#ff3b30"');
    expect(out).toContain('fill="#34c759"');
    expect(out).toContain("✉️");
    expect(out).toContain("🗺️");
    expect(out).toContain("Mail");
    expect(out).toContain("Maps");
  });

  it("skips empty dockIcons and falls back to the plain palette", () => {
    const out = screenChromeElements(chrome({ style: "home", dockIcons: [] }), W, H, "t");
    for (const c of SCREEN_CHROME_DOCK_COLORS) {
      expect(out).toContain(`fill="${c}"`);
    }
  });

  it("android dock honors custom dockIcons instead of the default palette", () => {
    const out = screenChromeElements(
      chrome({
        style: "home",
        os: "android",
        dockIcons: [
          { label: "Phone", color: "#1a73e8", emoji: "📞" },
          { label: "Mail", color: "#0f9d58", emoji: "✉️" }
        ]
      }),
      W, H, "t"
    );
    expect(out).toContain('fill="#1a73e8"');
    expect(out).toContain('fill="#0f9d58"');
    expect(out).toContain("📞");
    expect(out).toContain("✉️");
  });
});

describe("lock-screen notifications", () => {
  it("renders two notification cards below the clock when enabled", () => {
    const out = screenChromeElements(chrome({ showNotifications: true }), W, H, "t");
    expect(out).toContain("Messages");
    expect(out).toContain("Calendar");
    // two app-icon squircles (superellipse paths), matches the card count
    expect(out.match(/d="M [^"]+ Z" fill="(?:#30d158|#0a84ff)"/g)).toHaveLength(2);
    expect(out).toContain('fill="#30d158"'); // Messages icon
    expect(out).toContain('fill="#0a84ff"'); // Calendar icon
  });

  it("skips notification cards by default", () => {
    const out = screenChromeElements(chrome(), W, H, "t");
    expect(out).not.toContain("Messages");
    expect(out).not.toContain("Calendar");
  });

  it("renders notification cards even when the clock is hidden", () => {
    const out = screenChromeElements(chrome({ showNotifications: true, showClock: false, showDate: false, showStatusBar: false }), W, H, "t");
    // Cards fall back to a fixed position below the top scrim.
    expect(out).toContain("Messages");
    expect(out).toContain("Calendar");
  });

  it("renders custom notifications from the chrome config", () => {
    const out = screenChromeElements(
      chrome({
        showNotifications: true,
        notifications: [
          { app: "Instagram", subtitle: "Liked your post", color: "#e1306c" },
          { app: "Slack", subtitle: "New message in #design", color: "#4a154b" }
        ]
      }),
      W, H, "t"
    );
    expect(out).toContain("Instagram");
    expect(out).toContain("Slack");
    expect(out).toContain('fill="#e1306c"');
    expect(out).toContain('fill="#4a154b"');
    // default cards are replaced, not appended
    expect(out).not.toContain("Messages");
    expect(out).not.toContain("Calendar");
  });

  it("falls back to default cards when the custom list is empty", () => {
    const out = screenChromeElements(chrome({ showNotifications: true, notifications: [] }), W, H, "t");
    expect(out).toContain("Messages");
    expect(out).toContain("Calendar");
  });
});

describe("screenChromeSvg", () => {
  it("wraps the elements in a viewBox-sized SVG document", () => {
    const out = screenChromeSvg(chrome(), W, H, "t");
    expect(out).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 390 844"/);
    expect(out).toContain('width="100%"');
    expect(out).toContain("</svg>");
  });
});

describe("drawScreenChrome", () => {
  function ctx(): CanvasRenderingContext2D {
    const calls = { fillText: [] as unknown[], translate: [] as unknown[], fillRect: [] as unknown[], clip: [] as unknown[] };
    return {
      _calls: calls,
      save: vi.fn(),
      restore: vi.fn(),
      translate: (...a: unknown[]) => calls.translate.push(a),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      arcTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: (...a: unknown[]) => calls.fillRect.push(a),
      fillText: (...a: unknown[]) => calls.fillText.push(a),
      measureText: (t: string) => ({ width: t.length * 10 }),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
      set fillStyle(_v: unknown) {},
      set strokeStyle(_v: unknown) {},
      set lineWidth(_v: unknown) {},
      set font(_v: unknown) {},
      set textAlign(_v: unknown) {},
      set textBaseline(_v: unknown) {},
      set lineCap(_v: unknown) {},
      setLineDash: vi.fn()
    } as unknown as CanvasRenderingContext2D & { _calls: typeof calls };
  }

  it("translates to the target rectangle origin and paints the scrim", () => {
    const c = ctx();
    drawScreenChrome(c as never, chrome({ showStatusBar: false, showHomeIndicator: false }), 10, 20, 390, 844);
    expect((c as unknown as { _calls: unknown })._calls).toBeDefined();
    const calls = (c as unknown as { _calls: { translate: unknown[][] } })._calls.translate;
    expect(calls).toEqual([[10, 20]]);
    const fillRects = (c as unknown as { _calls: { fillRect: unknown[][] } })._calls.fillRect;
    expect(fillRects.length).toBeGreaterThan(0);
  });

  it("draws the status bar time text", () => {
    const c = ctx();
    drawScreenChrome(c as never, chrome(), 0, 0, 390, 844);
    const fillTexts = (c as unknown as { _calls: { fillText: unknown[][] } })._calls.fillText;
    expect(fillTexts.some((args) => args[0] === "9:41")).toBe(true);
  });

  it("draws lock-screen notification cards when enabled", () => {
    const c = ctx();
    drawScreenChrome(c as never, chrome({ showNotifications: true }), 0, 0, 390, 844);
    const fillTexts = (c as unknown as { _calls: { fillText: unknown[][] } })._calls.fillText;
    expect(fillTexts.some((args) => args[0] === "Messages")).toBe(true);
    expect(fillTexts.some((args) => args[0] === "Calendar")).toBe(true);
  });

  it("paints nothing when every element is hidden", () => {
    const c = ctx();
    drawScreenChrome(
      c as never,
      chrome({ style: "statusBar", showStatusBar: false, showHomeIndicator: false }),
      0,
      0,
      W,
      H
    );
    expect((c as unknown as { _calls: { fillRect: unknown[][] } })._calls.fillRect).toHaveLength(0);
  });

  it("paints the Android home grid and dock circles with the search glyph", () => {
    const c = ctx();
    drawScreenChrome(c as never, chrome({ style: "home", os: "android" }), 0, 0, W, H);
    const arcCalls = (c as unknown as { arc: ReturnType<typeof vi.fn> }).arc;
    // 20 grid icons + 4 dock icons + wifi dot + Google G outline.
    expect(arcCalls.mock.calls.length).toBeGreaterThanOrEqual(24);
    const fillTexts = (c as unknown as { _calls: { fillText: unknown[][] } })._calls.fillText;
    expect(fillTexts.some((args) => args[0] === "Search")).toBe(true);
  });
});

describe("OS-specific chrome (frameOs / os flag)", () => {
  function ctx(): CanvasRenderingContext2D {
    const calls = { fillText: [] as unknown[], translate: [] as unknown[], fillRect: [] as unknown[], clip: [] as unknown[] };
    return {
      _calls: calls,
      save: vi.fn(),
      restore: vi.fn(),
      translate: (...a: unknown[]) => calls.translate.push(a),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      arcTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: (...a: unknown[]) => calls.fillRect.push(a),
      fillText: (...a: unknown[]) => calls.fillText.push(a),
      measureText: (t: string) => ({ width: t.length * 10 }),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
      set fillStyle(_v: unknown) {},
      set strokeStyle(_v: unknown) {},
      set lineWidth(_v: unknown) {},
      set font(_v: unknown) {},
      set textAlign(_v: unknown) {},
      set textBaseline(_v: unknown) {},
      set lineCap(_v: unknown) {},
      setLineDash: vi.fn()
    } as unknown as CanvasRenderingContext2D & { _calls: typeof calls };
  }

  it("frameOs maps frames to their OS family", () => {
    expect(frameOs("pixel8pro")).toBe("android");
    expect(frameOs("galaxy24")).toBe("android");
    expect(frameOs("desktop")).toBe("desktop");
    expect(frameOs("tablet")).toBe("desktop");
    expect(frameOs("notebook")).toBe("desktop");
    expect(frameOs("browser")).toBe("desktop");
    expect(frameOs("tv")).toBe("desktop");
    expect(frameOs("iphone")).toBe("ios");
    expect(frameOs("iphone16pro")).toBe("ios");
    expect(frameOs("ipad")).toBe("ios");
    expect(frameOs("macbook")).toBe("ios");
    expect(frameOs("watch")).toBe("ios");
    expect(frameOs("watchUltra")).toBe("ios");
    expect(frameOs(undefined)).toBe("ios");
  });

  it("android home renders the search bar, app grid and dock but no iOS indicator", () => {
    const home = screenChromeElements(chrome({ style: "home", os: "android" }), W, H, "t");
    expect(home).toContain("9:41"); // status bar remains
    // Google search pill with the multicolor G.
    expect(home).toContain('fill="rgba(255,255,255,0.94)"');
    expect(home).toContain('stroke="#4285f4"');
    // App grid (20 circles) + dock (4 circles) present; the exact total also
    // counts the wifi vertex dot and the Google-G outline.
    expect(home.match(/<circle /g)!.length).toBeGreaterThanOrEqual(24);
    expect(home).toContain('<circle cx=');
    // dock icons use the Android palette, not the iOS squircle dock.
    expect(home).toContain(`fill="#1a73e8"`);
    expect(home).not.toContain(`fill="${SCREEN_CHROME_DOCK_COLORS[0]}"`);
    const indicator = screenChromeElements(chrome({ showHomeIndicator: true, os: "android" }), W, H, "t");
    // home indicator is an iOS-only pill, gated out for android
    expect(indicator).not.toContain('fill="rgba(0,0,0,0.88)"');
    expect(indicator).not.toContain('fill="rgba(255,255,255,0.92)"');
  });

  it("custom android grid icons render label and emoji in SVG", () => {
    const home = screenChromeElements(
      chrome({ style: "home", os: "android", androidGridIcons: [{ label: "Mail", color: "#ff0000", emoji: "✉️" }, { label: "Solo", color: "#00ff00" }] }),
      W,
      H,
      "t"
    );
    expect(home).toContain('fill="#ff0000"');
    expect(home).toContain('fill="#00ff00"');
    expect(home).toContain(">Mail</text>");
    expect(home).toContain(">Solo</text>");
    expect(home).toContain("✉️");
    // A custom single-entry list only paints one grid icon, not the default 20.
    expect(home.match(/<circle /g)!.length).toBeLessThan(20);
  });

  it("custom android grid icons render label, emoji and colors on canvas", () => {
    const c = ctx();
    drawScreenChrome(
      c as never,
      chrome({ style: "home", os: "android", androidGridIcons: [{ label: "Mail", color: "#ff0000", emoji: "✉️" }, { label: "Solo", color: "#00ff00" }] }),
      0,
      0,
      W,
      H
    );
    const arcCalls = (c as unknown as { arc: ReturnType<typeof vi.fn> }).arc;
    // 2 custom grid icons + 4 dock icons + wifi dot + Google G outline.
    expect(arcCalls.mock.calls.length).toBeGreaterThanOrEqual(6);
    expect(arcCalls.mock.calls.length).toBeLessThan(20);
    const fillTexts = (c as unknown as { _calls: { fillText: unknown[][] } })._calls.fillText;
    expect(fillTexts.some((args) => args[0] === "Mail")).toBe(true);
  });

  it("android home folders occupy trailing grid cells in SVG", () => {
    const plain = screenChromeElements(chrome({ style: "home", os: "android" }), W, H, "t");
    const home = screenChromeElements(
      chrome({ style: "home", os: "android", folders: [{ label: "Social", color: "#5e35b1" }] }),
      W,
      H,
      "t"
    );
    // The folder stub renders as a rounded tile (rect) with its color, label and
    // 3 mini-app dots; one icon cell is replaced, so its 19 icon circles still
    // coexist with the folder tile instead of a 20th grid icon.
    expect(home).toContain('fill="#5e35b1"');
    expect(home).toContain(">Social</text>");
    expect(home).toContain("<rect ");
    expect(home.match(/<circle /g)!.length).toBeGreaterThan(plain.match(/<circle /g)!.length);
  });

  it("android home folders render on canvas", () => {
    const c = ctx();
    drawScreenChrome(
      c as never,
      chrome({ style: "home", os: "android", folders: [{ label: "Social", color: "#5e35b1" }] }),
      0,
      0,
      W,
      H
    );
    const fillTexts = (c as unknown as { _calls: { fillText: unknown[][] } })._calls.fillText;
    expect(fillTexts.some((args) => args[0] === "Social")).toBe(true);
  });

  it("android home widgets render cards above the grid in SVG", () => {
    const home = screenChromeElements(
      chrome({ style: "home", os: "android", widgets: [{ type: "clock" }, { type: "weather" }] }),
      W,
      H,
      "t"
    );
    expect(home).toContain(">9:41</text>");
    expect(home).toContain(">Tuesday, Sep 2</text>");
    expect(home).toContain(">72°</text>");
    expect(home).toContain(">San Francisco</text>");
    // Two widget cards appear above the app grid.
    expect(home.match(/<rect /g)!.length).toBeGreaterThanOrEqual(2);
  });

  it("android home widgets render on canvas", () => {
    const c = ctx();
    drawScreenChrome(
      c as never,
      chrome({ style: "home", os: "android", widgets: [{ type: "clock" }, { type: "weather" }] }),
      0,
      0,
      W,
      H
    );
    const fillTexts = (c as unknown as { _calls: { fillText: unknown[][] } })._calls.fillText;
    expect(fillTexts.some((args) => args[0] === "9:41")).toBe(true);
    expect(fillTexts.some((args) => args[0] === "San Francisco")).toBe(true);
  });

  it("android status bar uses a triangular signal and dotted wifi instead of iOS bars", () => {
    const android = screenChromeElements(chrome({ showStatusBar: true, os: "android" }), W, H, "t");
    const ios = screenChromeElements(chrome({ showStatusBar: true, os: "ios" }), W, H, "t");
    // Android draws a single filled right-triangle (M L L Z); iOS uses 4 bars.
    const triangle = /<path d="M [\d.]+ [\d.]+ L [\d.]+ [\d.]+ L [\d.]+ [\d.]+ Z"/;
    expect(android).toMatch(triangle);
    expect(ios).not.toMatch(triangle);
    // Android wifi arcs are dotted (stroke-dasharray); iOS wifi is solid.
    expect(android).toContain("stroke-dasharray=");
    expect(ios).not.toContain("stroke-dasharray=");
  });

  it("desktop renders a status bar but no lock/home chrome", () => {
    const statusBar = screenChromeElements(chrome({ os: "desktop", showStatusBar: true }), W, H, "t");
    expect(statusBar).toContain("9:41"); // time shown
    expect(statusBar).toContain("fill="); // battery/wifi glyphs present
    // No lock-screen clock, dock, shortcuts, or home indicator for desktop
    const lock = screenChromeElements(chrome({ style: "lock", os: "desktop" }), W, H, "t");
    expect(lock).not.toContain("88.6"); // no large lock clock
    const c = ctx();
    drawScreenChrome(c as never, chrome({ os: "desktop" }), 0, 0, W, H);
    // Desktop still draws the status bar scrim and glyphs (no early return)
    expect((c as unknown as { _calls: { fillRect: unknown[][] } })._calls.fillRect.length).toBeGreaterThan(0);
  });

  it("defaults to ios chrome when os is omitted", () => {
    const home = screenChromeElements(chrome({ style: "home" }), W, H, "t");
    expect(home).toContain(`fill="${SCREEN_CHROME_DOCK_COLORS[0]}"`); // iOS dock drawn
  });
});

describe("androidGridGeom", () => {
  it("lays out 4×5 cells and marks short screens as not fitting", () => {
    const g = androidGridGeom(W, H, 60, 36, 0.1, 0.02);
    expect(g.cols).toBe(4);
    expect(g.rows).toBe(5);
    expect(g.fits).toBe(true);
    // First cell is centered in the top-left quarter.
    expect(g.center(0)).toEqual({ cx: W / 8, cy: g.gridTop + g.cellH / 2 });
    // 20th icon (index 19) is the last cell of the bottom row.
    const last = g.center(19);
    expect(last.cx).toBe(W - W / 8);
    expect(last.cy).toBeCloseTo(g.gridTop + g.cellH * 4 + g.cellH / 2);
    // Label sits just under the icon's edge.
    expect(g.labelY(g.gridTop)).toBeGreaterThan(g.gridTop);
  });

  it("does not fit on very short screens", () => {
    const g = androidGridGeom(400, 60, 20, 20, 0.5, 0.2);
    expect(g.fits).toBe(false);
  });

  it("honors custom column/row counts", () => {
    const g5x5 = androidGridGeom(W, H, 60, 36, 0.1, 0.02, 5, 5);
    expect(g5x5.cols).toBe(5);
    expect(g5x5.rows).toBe(5);
    // 5 columns → narrower cells than the default 4.
    expect(g5x5.cellW).toBe(W / 5);
    // A 3×4 layout fills with exactly 12 cells.
    const g34 = androidGridGeom(W, H, 60, 36, 0.1, 0.02, 3, 4);
    expect(g34.center(11).cx).toBe(W - W / 6);
    expect(g34.center(11).cy).toBeCloseTo(g34.gridTop + g34.cellH * 3 + g34.cellH / 2);
  });
});

describe("GRID_ICON_PRESETS", () => {
  it("exposes 4 named presets each with exactly 20 valid icons", () => {
    expect(GRID_ICON_PRESETS.map((p) => p.id)).toEqual(["google", "classic", "minimal", "none"]);
    for (const preset of GRID_ICON_PRESETS) {
      expect(preset.icons.length).toBe(20);
      for (const icon of preset.icons) {
        expect(icon.label.length).toBeGreaterThan(0);
        expect(icon.color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("google preset matches the default ANDROID_GRID_APPS", () => {
    const google = GRID_ICON_PRESETS.find((p) => p.id === "google")!;
    expect(google.icons).toEqual(ANDROID_GRID_APPS);
  });
});
