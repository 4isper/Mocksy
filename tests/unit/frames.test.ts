import { describe, expect, it } from "vitest";
import { FRAME_ORDER, FRAME_SPECS, getFrameSpec } from "@/lib/render/frames";

describe("FRAME_SPECS", () => {
  it("registers overlay assets for iphone15 / iphone16pro", () => {
    expect(FRAME_SPECS.iphone15.isOverlay).toBe(true);
    expect(FRAME_SPECS.iphone15.asset).toMatch(/iphone15\.svg$/);
    expect(FRAME_SPECS.iphone16pro.isOverlay).toBe(true);
    expect(FRAME_SPECS.iphone16pro.asset).toMatch(/iphone16pro\.svg$/);
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
    expect(FRAME_SPECS.iphone.aspectRatio).toBe("390 / 844");
    expect(FRAME_SPECS.desktop.aspectRatio).toBe("16 / 10");
    expect(FRAME_SPECS.tablet.aspectRatio).toBe("4 / 3");
    expect(FRAME_SPECS.watch.aspectRatio).toBe("1 / 1");
    // "none" has no device shape, so it follows the scene aspect ratio.
    expect(FRAME_SPECS.none.aspectRatio).toBeNull();
  });

  it("exposes every MockupFrame value through FRAME_ORDER", () => {
    const expected: Array<keyof typeof FRAME_SPECS> = [
      "none",
      "iphone",
      "iphone15",
      "iphone16pro",
      "desktop",
      "tablet",
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
