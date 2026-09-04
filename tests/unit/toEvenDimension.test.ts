import { describe, expect, it } from "vitest";
import { toEvenDimension } from "@/lib/export/videoExportHelpers";

describe("toEvenDimension", () => {
  it("rounds odd dimensions down to the nearest even value", () => {
    expect(toEvenDimension(675)).toBe(674);
    expect(toEvenDimension(1081)).toBe(1080);
    expect(toEvenDimension(1201)).toBe(1200);
  });

  it("keeps even dimensions unchanged", () => {
    expect(toEvenDimension(674)).toBe(674);
    expect(toEvenDimension(1080)).toBe(1080);
    expect(toEvenDimension(1200)).toBe(1200);
  });

  it("never returns a value below 2", () => {
    expect(toEvenDimension(1)).toBe(2);
    expect(toEvenDimension(0)).toBe(2);
    expect(toEvenDimension(-5)).toBe(2);
  });

  it("handles non-integer input", () => {
    expect(toEvenDimension(674.7)).toBe(674);
    expect(toEvenDimension(675.2)).toBe(674);
  });
});
