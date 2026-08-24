import { describe, expect, it } from "vitest";
import { buildLayerFilterCss } from "@/lib/render/layerFilters";

describe("buildLayerFilterCss", () => {
  it("returns 'none' for an undefined layer", () => {
    expect(buildLayerFilterCss(undefined)).toBe("none");
  });

  it("returns 'none' for neutral filter values", () => {
    expect(buildLayerFilterCss({ brightness: 100, contrast: 100, saturate: 100, blur: 0, grayscale: 0 })).toBe("none");
  });

  it("omits neutral values and emits only non-default filters", () => {
    expect(buildLayerFilterCss({ brightness: 150, contrast: 100, saturate: 100, blur: 0, grayscale: 0 })).toBe("brightness(150%)");
    expect(buildLayerFilterCss({ brightness: 100, contrast: 80, saturate: 120, blur: 3, grayscale: 40 })).toBe("contrast(80%) saturate(120%) blur(3px) grayscale(40%)");
  });

  it("falls back to defaults for missing fields", () => {
    expect(buildLayerFilterCss({} as { brightness: number; contrast: number; saturate: number; blur: number; grayscale: number })).toBe("none");
    expect(buildLayerFilterCss({ brightness: 200 } as { brightness: number; contrast: number; saturate: number; blur: number; grayscale: number })).toBe("brightness(200%)");
  });
});
