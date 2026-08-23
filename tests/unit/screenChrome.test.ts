import { describe, expect, it, vi } from "vitest";
import { screenChromeElements, screenChromeSvg, drawScreenChrome, SCREEN_CHROME_DOCK_COLORS } from "@/lib/render/screenChrome";
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

  it("lock style draws status bar time, clock, date, flashlight circles and home indicator", () => {
    const out = screenChromeElements(chrome(), W, H, "t");
    // status bar time + lock clock + lock date
    expect(out.match(/<text /g)).toHaveLength(3);
    expect(out).toContain("9:41");
    expect(out).toContain("Tuesday, August 4");
    // two flashlight buttons (ring + dot each) + the wi-fi dot
    expect(out.match(/<circle /g)).toHaveLength(5);
    // three wi-fi arcs + the battery outline
    expect(out.match(/fill="none"/g)).toHaveLength(4);
    // home indicator pill
    expect(out).toContain('fill="rgba(255,255,255,0.92)"');
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
    // no battery outline when the status bar is hidden
    expect(out).not.toContain('fill="none"');
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
      set lineCap(_v: unknown) {}
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
      set lineCap(_v: unknown) {}
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

  it("android keeps the status bar but drops the iOS dock and home indicator", () => {
    const home = screenChromeElements(chrome({ style: "home", os: "android" }), W, H, "t");
    expect(home).toContain("9:41"); // status bar remains
    expect(home).not.toContain(`fill="${SCREEN_CHROME_DOCK_COLORS[0]}"`); // no iOS dock
    const indicator = screenChromeElements(chrome({ showHomeIndicator: true, os: "android" }), W, H, "t");
    // home indicator is an iOS-only pill, gated out for android
    expect(indicator).not.toContain('fill="rgba(0,0,0,0.88)"');
    expect(indicator).not.toContain('fill="rgba(255,255,255,0.92)"');
  });

  it("desktop renders no mobile chrome at all", () => {
    expect(screenChromeElements(chrome({ os: "desktop" }), W, H, "t")).toBe("");
    expect(screenChromeElements(chrome({ style: "lock", os: "desktop" }), W, H, "t")).toBe("");
    const c = ctx();
    drawScreenChrome(c as never, chrome({ os: "desktop" }), 0, 0, W, H);
    // drawScreenChrome returns early for desktop, so no scrim fillRect
    expect((c as unknown as { _calls: { fillRect: unknown[][] } })._calls.fillRect).toHaveLength(0);
  });

  it("defaults to ios chrome when os is omitted", () => {
    const home = screenChromeElements(chrome({ style: "home" }), W, H, "t");
    expect(home).toContain(`fill="${SCREEN_CHROME_DOCK_COLORS[0]}"`); // iOS dock drawn
  });
});
