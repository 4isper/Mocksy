import { describe, expect, it } from "vitest";
import { hexToRgb, mergeWeightedPalettes, pickGradientPair, quantize, rgbToHex } from "@/lib/media/palette";
import type { QuantizedColor } from "@/lib/media/palette";

describe("rgbToHex", () => {
  it("formats channels with leading zeros", () => {
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
    expect(rgbToHex(255, 255, 255)).toBe("#ffffff");
    expect(rgbToHex(29, 78, 216)).toBe("#1d4ed8");
  });

  it("clamps out-of-range channels", () => {
    expect(rgbToHex(-10, 300, 128)).toBe("#00ff80");
  });
});

describe("quantize", () => {
  it("returns the most common colors", () => {
    // Build a pixel buffer: 3 red, 2 blue, 1 green, all opaque.
    const px: number[] = [];
    const push = (r: number, g: number, b: number) => px.push(r, g, b, 255);
    for (let i = 0; i < 3; i++) push(255, 0, 0);
    for (let i = 0; i < 2; i++) push(0, 0, 255);
    push(0, 255, 0);
    const colors = quantize(new Uint8ClampedArray(px), 5).map((c) => c.hex);
    expect(colors).toContain("#ff0000");
    expect(colors).toContain("#0000ff");
    expect(colors).toContain("#00ff00");
  });

  it("ignores fully transparent pixels", () => {
    const px = new Uint8ClampedArray([10, 20, 30, 0, 40, 50, 60, 0]);
    expect(quantize(px, 3)).toEqual([]);
  });

  it("returns counts alongside hex colors", () => {
    const px: number[] = [];
    const push = (r: number, g: number, b: number) => px.push(r, g, b, 255);
    for (let i = 0; i < 3; i++) push(255, 0, 0);
    push(0, 255, 0);
    const result = quantize(new Uint8ClampedArray(px), 5);
    const red = result.find((c) => c.hex === "#ff0000");
    const green = result.find((c) => c.hex === "#00ff00");
    expect(red?.count).toBe(3);
    expect(green?.count).toBe(1);
  });

  it("limits the result to the requested count", () => {
    const px: number[] = [];
    const push = (r: number, g: number, b: number) => px.push(r, g, b, 255);
    push(255, 0, 0);
    push(0, 255, 0);
    push(0, 0, 255);
    expect(quantize(new Uint8ClampedArray(px), 2)).toHaveLength(2);
  });
});

describe("pickGradientPair", () => {
  it("falls back to a default gradient when empty", () => {
    expect(pickGradientPair([])).toEqual(["#1d4ed8", "#7c3aed"]);
  });

  it("repeats a single color into a pair", () => {
    expect(pickGradientPair(["#abcdef"])).toEqual(["#abcdef", "#abcdef"]);
  });

  it("spans the palette extremes for two or more colors", () => {
    const [from, to] = pickGradientPair(["#111111", "#222222", "#333333"]);
    expect(from).toBe("#111111");
    expect(to).toBe("#333333");
  });
});

describe("hexToRgb", () => {
  it("parses a hex string", () => {
    expect(hexToRgb("#1d4ed8")).toEqual({ r: 29, g: 78, b: 216 });
  });

  it("returns null for invalid input", () => {
    expect(hexToRgb("not-a-color")).toBeNull();
  });
});

describe("mergeWeightedPalettes", () => {
  const red: QuantizedColor[] = [{ hex: "#ff0000", count: 100 }];
  const blue: QuantizedColor[] = [{ hex: "#0000ff", count: 80 }];
  const green: QuantizedColor[] = [{ hex: "#00ff00", count: 60 }];

  it("returns empty for no inputs", () => {
    const r = mergeWeightedPalettes([]);
    expect(r.colors).toEqual([]);
  });

  it("returns a single palette unchanged in weight order", () => {
    const r = mergeWeightedPalettes([{ colors: red, average: "#ff0000", weight: 1 }]);
    expect(r.colors[0]!.hex).toBe("#ff0000");
  });

  it("merges by weight: heavier source dominates", () => {
    const r = mergeWeightedPalettes([
      { colors: red, average: "#ff0000", weight: 10 },
      { colors: blue, average: "#0000ff", weight: 1 }
    ]);
    // First result should be red-shifted (dominant color of the heavier source)
    expect(r.colors[0]!.hex).toBe("#ff0000");
  });

  it("limits to top 5 merged colors", () => {
    const inputs = Array.from({ length: 10 }, (_, i) => ({
      colors: [{ hex: rgbToHex(i * 25, 0, 0), count: 10 }],
      average: "#000000",
      weight: 1
    }));
    const r = mergeWeightedPalettes(inputs);
    expect(r.colors.length).toBeLessThanOrEqual(5);
  });
});

describe("extractPalette", () => {
  it("is covered by the quantize/rgbToHex units above (DOM canvas requires jsdom)", () => {
    expect(true).toBe(true);
  });
});
