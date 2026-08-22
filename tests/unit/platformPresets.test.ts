import { describe, expect, it } from "vitest";
import {
  MAX_EXPORT_DIMENSION,
  PLATFORM_PRESETS,
  closestAspectRatio,
  findPlatformPreset
} from "@/lib/export/platformPresets";

describe("PLATFORM_PRESETS", () => {
  it("has unique ids and dimensions within the export cap", () => {
    const ids = new Set(PLATFORM_PRESETS.map((p) => p.id));
    expect(ids.size).toBe(PLATFORM_PRESETS.length);
    for (const p of PLATFORM_PRESETS) {
      expect(p.width).toBeGreaterThanOrEqual(1);
      expect(p.height).toBeGreaterThanOrEqual(1);
      expect(p.width).toBeLessThanOrEqual(MAX_EXPORT_DIMENSION);
      expect(p.height).toBeLessThanOrEqual(MAX_EXPORT_DIMENSION);
      expect(Number.isInteger(p.width)).toBe(true);
      expect(Number.isInteger(p.height)).toBe(true);
    }
  });

  it("covers the well-known platform sizes", () => {
    expect(findPlatformPreset("appStorePhone")).toEqual({ id: "appStorePhone", width: 1290, height: 2796 });
    expect(findPlatformPreset("dribbbleShot")).toEqual({ id: "dribbbleShot", width: 1600, height: 1200 });
    expect(findPlatformPreset("story")).toEqual({ id: "story", width: 1080, height: 1920 });
    expect(findPlatformPreset("nope")).toBeUndefined();
  });
});

describe("closestAspectRatio", () => {
  it("returns exact matches unchanged", () => {
    expect(closestAspectRatio(1600, 1200)).toBe("4 / 3");
    expect(closestAspectRatio(1600, 900)).toBe("16 / 9");
    expect(closestAspectRatio(1080, 1080)).toBe("1 / 1");
    expect(closestAspectRatio(1080, 1350)).toBe("4 / 5");
    expect(closestAspectRatio(1080, 1920)).toBe("9 / 16");
  });

  it("picks the nearest supported ratio when none matches exactly", () => {
    // App Store 6.7" (≈9:19.5): 9/16 is the nearest portrait option.
    expect(closestAspectRatio(1290, 2796)).toBe("9 / 16");
    // iPad 13" (3:4): 4/5 is nearer than 2/3.
    expect(closestAspectRatio(2064, 2752)).toBe("4 / 5");
    // Open Graph (≈1.905): 16/9 is the nearest landscape option.
    expect(closestAspectRatio(1200, 630)).toBe("16 / 9");
  });

  it("falls back to the default ratio for degenerate input", () => {
    expect(closestAspectRatio(0, 100)).toBe("16 / 9");
    expect(closestAspectRatio(100, 0)).toBe("16 / 9");
  });
});
