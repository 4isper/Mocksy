import { describe, expect, it } from "vitest";
import {
  ANIMATION_PRESETS,
  ASPECT_RATIOS,
  DEFAULT_VIEWBOX,
  FRAME_ORDER,
  FRAME_SPECS,
  frameInstanceHalfExtents,
  frameInstanceSize,
  frameViewBox,
  getFrameSpec
} from "@/lib/render/frames";

describe("FRAME_SPECS", () => {
  it("registers overlay assets for every SVG device skin", () => {
    const overlays = ["iphone15", "iphone16pro", "pixel8pro", "galaxy24", "iphoneSE", "ipad", "galaxyTab", "macbook", "imac", "notebook", "browser", "tv", "watchUltra", "watch"] as const;
    for (const frame of overlays) {
      expect(FRAME_SPECS[frame].isOverlay, `${frame} should be an overlay`).toBe(true);
      expect(FRAME_SPECS[frame].asset, `${frame} should have an asset`).toMatch(/\.svg$/);
    }
    expect(FRAME_SPECS.iphone15.asset).toMatch(/iphone15\.svg$/);
    expect(FRAME_SPECS.iphone16pro.asset).toMatch(/iphone16pro\.svg$/);
    expect(FRAME_SPECS.pixel8pro.asset).toMatch(/pixel8pro\.svg$/);
    expect(FRAME_SPECS.galaxy24.asset).toMatch(/galaxy24\.svg$/);
    expect(FRAME_SPECS.iphoneSE.asset).toMatch(/iphoneSE\.svg$/);
    expect(FRAME_SPECS.ipad.asset).toMatch(/ipad\.svg$/);
    expect(FRAME_SPECS.galaxyTab.asset).toMatch(/galaxyTab\.svg$/);
    expect(FRAME_SPECS.macbook.asset).toMatch(/macbook\.svg$/);
    expect(FRAME_SPECS.imac.asset).toMatch(/imac\.svg$/);
    expect(FRAME_SPECS.notebook.asset).toMatch(/notebook\.svg$/);
    expect(FRAME_SPECS.browser.asset).toMatch(/browser\.svg$/);
    expect(FRAME_SPECS.tv.asset).toMatch(/tv\.svg$/);
    expect(FRAME_SPECS.watchUltra.asset).toMatch(/watchUltra\.svg$/);
    expect(FRAME_SPECS.watch.asset).toMatch(/watch\.svg$/);
  });

  it("keeps CSS-only frames non-overlay", () => {
    expect(FRAME_SPECS.none.isOverlay).toBe(false);
    expect(FRAME_SPECS.iphone.isOverlay).toBe(false);
    expect(FRAME_SPECS.desktop.isOverlay).toBe(false);
    expect(FRAME_SPECS.tablet.isOverlay).toBe(false);
  });

  it("gives each device frame its own native aspect ratio", () => {
    expect(FRAME_SPECS.iphone15.aspectRatio).toBe("390 / 844");
    // Real logical sizes: iPhone 16 Pro is 402x874, Pixel 8 Pro is 448x996.
    expect(FRAME_SPECS.iphone16pro.aspectRatio).toBe("402 / 874");
    expect(FRAME_SPECS.pixel8pro.aspectRatio).toBe("448 / 996");
    expect(FRAME_SPECS.galaxy24.aspectRatio).toBe("360 / 780");
    expect(FRAME_SPECS.iphoneSE.aspectRatio).toBe("375 / 667");
    expect(FRAME_SPECS.iphone.aspectRatio).toBe("390 / 844");
    expect(FRAME_SPECS.ipad.aspectRatio).toBe("834 / 1194");
    expect(FRAME_SPECS.galaxyTab.aspectRatio).toBe("800 / 1280");
    expect(FRAME_SPECS.desktop.aspectRatio).toBe("16 / 10");
    expect(FRAME_SPECS.tablet.aspectRatio).toBe("4 / 3");
    expect(FRAME_SPECS.macbook.aspectRatio).toBe("1600 / 1074");
    expect(FRAME_SPECS.imac.aspectRatio).toBe("1600 / 1420");
    expect(FRAME_SPECS.notebook.aspectRatio).toBe("1600 / 1000");
    expect(FRAME_SPECS.browser.aspectRatio).toBe("1440 / 1000");
    expect(FRAME_SPECS.tv.aspectRatio).toBe("1600 / 1000");
    expect(FRAME_SPECS.watchUltra.aspectRatio).toBe("410 / 502");
    expect(FRAME_SPECS.watch.aspectRatio).toBe("396 / 484");
    // "none" has no device shape, so it follows the scene aspect ratio.
    expect(FRAME_SPECS.none.aspectRatio).toBeNull();
  });

  it("defines a screen cutout for every overlay skin", () => {
    expect(FRAME_SPECS.iphone15.cutout).toEqual({ x: 14, y: 14, w: 362, h: 816, rx: 55 });
    expect(FRAME_SPECS.iphoneSE.cutout).toEqual({ x: 10, y: 34, w: 355, h: 577, rx: 10 });
    expect(FRAME_SPECS.ipad.cutout).toEqual({ x: 14, y: 14, w: 806, h: 1166, rx: 25 });
    expect(FRAME_SPECS.galaxyTab.cutout).toEqual({ x: 18, y: 18, w: 764, h: 1244, rx: 24 });
    expect(FRAME_SPECS.macbook.cutout).toEqual({ x: 44, y: 34, w: 1512, h: 982, rx: 6 });
    expect(FRAME_SPECS.imac.cutout).toEqual({ x: 70, y: 80, w: 1460, h: 821, rx: 18 });
    expect(FRAME_SPECS.notebook.cutout).toEqual({ x: 80, y: 40, w: 1440, h: 810, rx: 8 });
    expect(FRAME_SPECS.browser.cutout).toEqual({ x: 0, y: 96, w: 1440, h: 904, rx: 20 });
    expect(FRAME_SPECS.tv.cutout).toEqual({ x: 40, y: 24, w: 1520, h: 855, rx: 12 });
    expect(FRAME_SPECS.watchUltra.cutout).toEqual({ x: 20, y: 24, w: 370, h: 454, rx: 82 });
  });

  it("defaults skins to the 390x844 viewBox unless overridden", () => {
    expect(FRAME_SPECS.iphone15.viewBox).toBeUndefined();
    expect(frameViewBox(FRAME_SPECS.iphone15)).toEqual(DEFAULT_VIEWBOX);
    expect(frameViewBox(FRAME_SPECS.iphoneSE)).toEqual({ w: 375, h: 667 });
    expect(frameViewBox(FRAME_SPECS.ipad)).toEqual({ w: 834, h: 1194 });
    expect(frameViewBox(FRAME_SPECS.galaxyTab)).toEqual({ w: 800, h: 1280 });
    expect(frameViewBox(FRAME_SPECS.macbook)).toEqual({ w: 1600, h: 1074 });
    expect(frameViewBox(FRAME_SPECS.imac)).toEqual({ w: 1600, h: 1420 });
    expect(frameViewBox(FRAME_SPECS.notebook)).toEqual({ w: 1600, h: 1000 });
    expect(frameViewBox(FRAME_SPECS.browser)).toEqual({ w: 1440, h: 1000 });
    expect(frameViewBox(FRAME_SPECS.tv)).toEqual({ w: 1600, h: 1000 });
    expect(frameViewBox(FRAME_SPECS.watchUltra)).toEqual({ w: 410, h: 502 });
    expect(frameViewBox(FRAME_SPECS.watch)).toEqual({ w: 396, h: 484 });
  });

  it("marks the browser frame with a url bar for the renderers", () => {
    expect(FRAME_SPECS.browser.urlBar).toBe(true);
    for (const [frame, spec] of Object.entries(FRAME_SPECS)) {
      if (frame === "browser") continue;
      expect(spec.urlBar, `${frame} should not have a url bar`).toBeUndefined();
    }
  });

  it("exposes every MockupFrame value through FRAME_ORDER", () => {
    const expected: Array<keyof typeof FRAME_SPECS> = [
      "none",
      "iphone",
      "iphone15",
      "iphone16pro",
      "pixel8pro",
      "galaxy24",
      "iphoneSE",
      "ipad",
      "galaxyTab",
      "desktop",
      "tablet",
      "macbook",
      "imac",
      "notebook",
      "browser",
      "tv",
      "watchUltra",
      "watch"
    ];
    expect(FRAME_ORDER).toEqual(expected);
  });

  it("getFrameSpec falls back to none for unknown frames", () => {
    expect(getFrameSpec("iphone15")).toBe(FRAME_SPECS.iphone15);
    // @ts-expect-error testing fallback for invalid frame
    expect(getFrameSpec("nonexistent")).toBe(FRAME_SPECS.none);
  });
});

describe("ANIMATION_PRESETS", () => {
  it("lists all known animation presets including none", () => {
    expect(ANIMATION_PRESETS).toEqual(["none", "zoomIn", "zoomOut", "parallax", "panLeft", "panRight", "breathe", "float", "sway"]);
  });
});

describe("ASPECT_RATIOS", () => {
  it("lists all standard aspect ratios", () => {
    expect(ASPECT_RATIOS).toEqual(["16 / 9", "4 / 3", "3 / 2", "1 / 1", "4 / 5", "2 / 3", "9 / 16"]);
  });

  it("includes 16/9 as the first entry (default)", () => {
    expect(ASPECT_RATIOS[0]).toBe("16 / 9");
  });
});

describe("frameInstanceHalfExtents", () => {
  it("gives half the scale as the width half-extent", () => {
    const half = frameInstanceHalfExtents({ frame: "iphone15", scale: 0.3 });
    expect(half.w).toBeCloseTo(0.15);
  });

  it("derives height from the frame's native ratio and the canvas ratio", () => {
    // iphone15 is 390/844 tall; on a 16/9 canvas the height fraction is
    // scale * (844/390) * (16/9).
    const half = frameInstanceHalfExtents({ frame: "iphone15", scale: 0.3 }, null, "16 / 9");
    expect(half.h).toBeCloseTo((0.3 * (844 / 390) * (16 / 9)) / 2);
  });

  it("makes the watch frame portrait on a square canvas", () => {
    const half = frameInstanceHalfExtents({ frame: "watch", scale: 0.2 }, null, "1 / 1");
    expect(half.h).toBeGreaterThan(half.w);
  });

  it("lets frame 'none' follow the scene aspect ratio", () => {
    const wide = frameInstanceHalfExtents({ frame: "none", scale: 0.4 }, null, "16 / 9");
    const tall = frameInstanceHalfExtents({ frame: "none", scale: 0.4 }, null, "9 / 16");
    expect(wide.w).toBeCloseTo(tall.w);
    expect(wide.h).toBeLessThan(tall.h);
  });
});

describe("frameInstanceSize", () => {
  it("keeps portrait dimensions: width = scale, height follows native ratio", () => {
    const size = frameInstanceSize({ frame: "iphone15", scale: 0.4 }, null, "16 / 9");
    expect(size.w).toBeCloseTo(0.4);
    // h/w fraction = native ratio × (canvasW/canvasH) = 2.1641 × (16/9)
    expect(size.h).toBeCloseTo(0.4 * (844 / 390) * (16 / 9));
  });

  it("swaps the physical extents for landscape", () => {
    const portrait = frameInstanceSize({ frame: "iphone15", scale: 0.4 }, null, "16 / 9");
    const landscape = frameInstanceSize({ frame: "iphone15", scale: 0.4, orientation: "landscape" }, null, "16 / 9");
    // Physical swap: landscape width (px) equals portrait height (px), so as
    // canvas-width fractions: w' = scale·nativeAr; height fraction relative
    // to canvasH: h' = scale·(arW/arH).
    expect(landscape.w).toBeCloseTo(0.4 * (844 / 390));
    expect(landscape.h).toBeCloseTo(0.4 * (16 / 9));
    // Physical pixel check on a matching-AR canvas: swapped exactly.
    const cw = 1600;
    const ch = 900;
    expect(landscape.w * cw).toBeCloseTo(portrait.h * ch);
    expect(landscape.h * ch).toBeCloseTo(portrait.w * cw);
  });

  it("lets 'none' follow the scene in both orientations", () => {
    const p = frameInstanceSize({ frame: "none", scale: 0.5 }, null, "1 / 1");
    expect(p.w).toBeCloseTo(p.h);
    const l = frameInstanceSize({ frame: "none", scale: 0.5, orientation: "landscape" }, null, "1 / 1");
    expect(l.w).toBeCloseTo(l.h);
  });
});
