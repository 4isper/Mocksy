import { describe, expect, it } from "vitest";
import {
  ANIMATION_PRESETS,
  ASPECT_RATIOS,
  DEFAULT_VIEWBOX,
  FRAME_ORDER,
  FRAME_SPECS,
  frameViewBox,
  getFrameSpec
} from "@/lib/render/frames";

describe("FRAME_SPECS", () => {
  it("registers overlay assets for every SVG device skin", () => {
    const overlays = ["iphone15", "iphone16pro", "pixel8pro", "galaxy24", "iphoneSE", "ipad", "galaxyTab", "macbook", "imac", "notebook"] as const;
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
  });

  it("keeps CSS-only frames non-overlay", () => {
    expect(FRAME_SPECS.none.isOverlay).toBe(false);
    expect(FRAME_SPECS.iphone.isOverlay).toBe(false);
    expect(FRAME_SPECS.desktop.isOverlay).toBe(false);
    expect(FRAME_SPECS.tablet.isOverlay).toBe(false);
  });

  it("gives each device frame its own native aspect ratio", () => {
    expect(FRAME_SPECS.iphone15.aspectRatio).toBe("390 / 844");
    expect(FRAME_SPECS.iphone16pro.aspectRatio).toBe("390 / 844");
    expect(FRAME_SPECS.pixel8pro.aspectRatio).toBe("390 / 844");
    expect(FRAME_SPECS.galaxy24.aspectRatio).toBe("390 / 844");
    expect(FRAME_SPECS.iphoneSE.aspectRatio).toBe("375 / 667");
    expect(FRAME_SPECS.iphone.aspectRatio).toBe("390 / 844");
    expect(FRAME_SPECS.ipad.aspectRatio).toBe("862 / 1140");
    expect(FRAME_SPECS.galaxyTab.aspectRatio).toBe("800 / 1280");
    expect(FRAME_SPECS.desktop.aspectRatio).toBe("16 / 10");
    expect(FRAME_SPECS.tablet.aspectRatio).toBe("4 / 3");
    expect(FRAME_SPECS.macbook.aspectRatio).toBe("1600 / 1040");
    expect(FRAME_SPECS.imac.aspectRatio).toBe("1600 / 1420");
    expect(FRAME_SPECS.notebook.aspectRatio).toBe("1600 / 1000");
    expect(FRAME_SPECS.watch.aspectRatio).toBe("1 / 1");
    // "none" has no device shape, so it follows the scene aspect ratio.
    expect(FRAME_SPECS.none.aspectRatio).toBeNull();
  });

  it("defines a screen cutout for every overlay skin", () => {
    expect(FRAME_SPECS.iphone15.cutout).toEqual({ x: 14, y: 14, w: 362, h: 816, rx: 46 });
    expect(FRAME_SPECS.iphoneSE.cutout).toEqual({ x: 10, y: 34, w: 355, h: 577, rx: 10 });
    expect(FRAME_SPECS.ipad.cutout).toEqual({ x: 14, y: 14, w: 834, h: 1112, rx: 12 });
    expect(FRAME_SPECS.galaxyTab.cutout).toEqual({ x: 18, y: 18, w: 764, h: 1244, rx: 24 });
    expect(FRAME_SPECS.macbook.cutout).toEqual({ x: 44, y: 34, w: 1512, h: 944, rx: 6 });
    expect(FRAME_SPECS.imac.cutout).toEqual({ x: 70, y: 80, w: 1460, h: 821, rx: 10 });
    expect(FRAME_SPECS.notebook.cutout).toEqual({ x: 80, y: 40, w: 1440, h: 810, rx: 8 });
  });

  it("defaults skins to the 390x844 viewBox unless overridden", () => {
    expect(FRAME_SPECS.iphone15.viewBox).toBeUndefined();
    expect(frameViewBox(FRAME_SPECS.iphone15)).toEqual(DEFAULT_VIEWBOX);
    expect(frameViewBox(FRAME_SPECS.iphoneSE)).toEqual({ w: 375, h: 667 });
    expect(frameViewBox(FRAME_SPECS.ipad)).toEqual({ w: 862, h: 1140 });
    expect(frameViewBox(FRAME_SPECS.galaxyTab)).toEqual({ w: 800, h: 1280 });
    expect(frameViewBox(FRAME_SPECS.macbook)).toEqual({ w: 1600, h: 1040 });
    expect(frameViewBox(FRAME_SPECS.imac)).toEqual({ w: 1600, h: 1420 });
    expect(frameViewBox(FRAME_SPECS.notebook)).toEqual({ w: 1600, h: 1000 });
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
    expect(ANIMATION_PRESETS).toEqual(["none", "zoomIn", "zoomOut", "parallax", "panLeft", "panRight", "breathe"]);
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
