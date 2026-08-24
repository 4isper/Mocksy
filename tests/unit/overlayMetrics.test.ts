import { describe, expect, it } from "vitest";
import { OVERLAY_REFERENCE_WIDTH, overlayScaleFor } from "@/lib/render/overlayMetrics";

describe("overlayScaleFor", () => {
  it("is 1 at the reference width", () => {
    expect(overlayScaleFor(OVERLAY_REFERENCE_WIDTH)).toBe(1);
  });

  it("scales linearly with the artboard width", () => {
    expect(overlayScaleFor(1600)).toBe(2);
    expect(overlayScaleFor(400)).toBeCloseTo(0.5, 10);
  });

  it("falls back to 1 without a real measurement (zero-size canvas)", () => {
    expect(overlayScaleFor(0)).toBe(1);
    expect(overlayScaleFor(-10)).toBe(1);
  });
});
