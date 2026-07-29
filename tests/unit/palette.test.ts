import { describe, expect, it, vi } from "vitest";
import { hexToRgb, mergeWeightedPalettes, paletteColorsFlat, pickGradientPair, quantize, rgbToHex, extractPalette } from "@/lib/media/palette";
import type { PaletteResult, QuantizedColor } from "@/lib/media/palette";

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

  it("merges overlapping color bins from different palettes", () => {
    // Both palettes have the same color (#ff0000 = red) - should merge into one bin
    const r = mergeWeightedPalettes([
      { colors: [{ hex: "#ff0000", count: 100 }], average: "#ff0000", weight: 2 },
      { colors: [{ hex: "#ff0000", count: 50 }], average: "#885555", weight: 1 }
    ]);
    // Only one unique color in result
    expect(r.colors.length).toBe(1);
    expect(r.colors[0]!.hex).toBe("#ff0000");
  });

  it("skips palette entries with zero or negative weight", () => {
    const r = mergeWeightedPalettes([
      { colors: [{ hex: "#ff0000", count: 100 }], average: "#ff0000", weight: 0 },
      { colors: [{ hex: "#0000ff", count: 80 }], average: "#0000ff", weight: 1 }
    ]);
    expect(r.colors.some(c => c.hex === "#0000ff")).toBe(true);
    expect(r.colors.some(c => c.hex === "#ff0000")).toBe(false);
  });

  it("returns empty when total weight is zero", () => {
    const r = mergeWeightedPalettes([
      { colors: [{ hex: "#ff0000", count: 100 }], average: "#ff0000", weight: -1 }
    ]);
    expect(r.colors).toEqual([]);
    expect(r.average).toBe("#000000");
  });

  it("skips colors with invalid hex codes", () => {
    const r = mergeWeightedPalettes([
      { colors: [{ hex: "not-a-color", count: 100 }, { hex: "#00ff00", count: 50 }], average: "#000000", weight: 1 }
    ]);
    expect(r.colors.every(c => c.hex.length === 7)).toBe(true);
    expect(r.colors.some(c => c.hex === "#00ff00")).toBe(true);
  });

  it("handles null average color gracefully", () => {
    const r = mergeWeightedPalettes([
      { colors: [{ hex: "#ff0000", count: 100 }], average: "invalid", weight: 1 }
    ]);
    expect(r.colors.length).toBeGreaterThan(0);
    expect(r.colors[0]!.hex).toBe("#ff0000");
  });
});

describe("paletteColorsFlat", () => {
  it("converts QuantizedColor[] to a flat hex string array", () => {
    const result: PaletteResult = {
      colors: [
        { hex: "#ff0000", count: 10 },
        { hex: "#00ff00", count: 5 },
        { hex: "#0000ff", count: 3 }
      ],
      average: "#888888"
    };
    expect(paletteColorsFlat(result)).toEqual(["#ff0000", "#00ff00", "#0000ff"]);
  });

  it("returns empty array for empty colors", () => {
    const result: PaletteResult = { colors: [], average: "#000000" };
    expect(paletteColorsFlat(result)).toEqual([]);
  });
});

describe("extractPalette", () => {
  it("extracts palette from a canvas-backed image element", () => {
    vi.stubGlobal("HTMLCanvasElement", class {});
    vi.stubGlobal("HTMLVideoElement", class {});

    // Build fake pixel data: 4 red pixels, 4 blue pixels in a 2x4 grid
    const pixels = new Uint8ClampedArray(32);
    for (let i = 0; i < 16; i += 4) { pixels[i] = 255; pixels[i + 1] = 0; pixels[i + 2] = 0; pixels[i + 3] = 255; } // red
    for (let i = 16; i < 32; i += 4) { pixels[i] = 0; pixels[i + 1] = 0; pixels[i + 2] = 255; pixels[i + 3] = 255; } // blue

    const fakeCtx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: pixels, width: 2, height: 4 }))
    };

    const fakeCanvas = { width: 2, height: 4, getContext: vi.fn(() => fakeCtx) } as unknown as HTMLCanvasElement;

    vi.stubGlobal("document", {
      createElement: vi.fn(() => fakeCanvas)
    });

    const img = {
      naturalWidth: 200,
      naturalHeight: 400
    } as unknown as HTMLImageElement;

    const result = extractPalette(img, 3);
    expect(result.colors.length).toBeGreaterThan(0);
    expect(result.colors.some(c => c.hex === "#ff0000")).toBe(true);
    expect(result.colors.some(c => c.hex === "#0000ff")).toBe(true);
    expect(typeof result.average).toBe("string");
    expect(result.average).toMatch(/^#[0-9a-f]{6}$/);
    vi.unstubAllGlobals();
  });

  it("throws for unreadable media", () => {
    vi.stubGlobal("HTMLVideoElement", class {});
    const img = { naturalWidth: 0, naturalHeight: 0 } as unknown as HTMLImageElement;
    expect(() => extractPalette(img, 3)).toThrow("Media has no readable dimensions yet.");
    vi.unstubAllGlobals();
  });

  it("extracts palette from video element using videoWidth/videoHeight", () => {
    class HTMLVideoElementStub {}
    const fakeCtx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]), width: 1, height: 2 }))
    };
    const fakeCanvas = { width: 1, height: 1, getContext: vi.fn(() => fakeCtx) } as unknown as HTMLCanvasElement;
    vi.stubGlobal("HTMLCanvasElement", class {});
    vi.stubGlobal("HTMLVideoElement", HTMLVideoElementStub as unknown as typeof HTMLVideoElement);
    vi.stubGlobal("document", { createElement: vi.fn(() => fakeCanvas) });
    const video = Object.setPrototypeOf({ videoWidth: 1920, videoHeight: 1080 }, HTMLVideoElementStub.prototype);
    expect(() => extractPalette(video as unknown as HTMLVideoElement, 3)).not.toThrow();
    vi.unstubAllGlobals();
  });

  it("throws when canvas 2d context cannot be created", () => {
    vi.stubGlobal("HTMLCanvasElement", class {});
    vi.stubGlobal("HTMLVideoElement", class {});
    const fakeCanvas = { width: 1, height: 1, getContext: vi.fn(() => null) } as unknown as HTMLCanvasElement;
    vi.stubGlobal("document", { createElement: vi.fn(() => fakeCanvas) });
    const img = { naturalWidth: 200, naturalHeight: 200 } as unknown as HTMLImageElement;
    expect(() => extractPalette(img, 3)).toThrow("Could not read media pixels.");
    vi.unstubAllGlobals();
  });

  it("throws when second getContext call fails in extractPalette", () => {
    const fakeCtx = { drawImage: vi.fn() };
    const getContextMock = vi.fn()
      .mockReturnValueOnce(fakeCtx)  // loadElementImage succeeds
      .mockReturnValueOnce(null);     // extractPalette fails
    const fakeCanvas = { width: 1, height: 1, getContext: getContextMock } as unknown as HTMLCanvasElement;
    vi.stubGlobal("HTMLCanvasElement", class {});
    vi.stubGlobal("HTMLVideoElement", class {});
    vi.stubGlobal("document", { createElement: vi.fn(() => fakeCanvas) });
    const img = { naturalWidth: 200, naturalHeight: 200 } as unknown as HTMLImageElement;
    expect(() => extractPalette(img, 3)).toThrow("Could not read media pixels.");
    vi.unstubAllGlobals();
  });

  it("returns empty palette when all pixels are transparent", () => {
    vi.stubGlobal("HTMLCanvasElement", class {});
    vi.stubGlobal("HTMLVideoElement", class {});

    // All transparent pixels (alpha < 125)
    const pixels = new Uint8ClampedArray(16);
    for (let i = 0; i < 16; i += 4) {
      pixels[i] = 255;
      pixels[i + 1] = 0;
      pixels[i + 2] = 0;
      pixels[i + 3] = 0; // fully transparent
    }

    const fakeCtx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: pixels, width: 2, height: 2 }))
    };

    const fakeCanvas = { width: 2, height: 2, getContext: vi.fn(() => fakeCtx) } as unknown as HTMLCanvasElement;

    vi.stubGlobal("document", {
      createElement: vi.fn(() => fakeCanvas)
    });

    const img = { naturalWidth: 200, naturalHeight: 200 } as unknown as HTMLImageElement;
    const result = extractPalette(img, 3);
    expect(result.colors).toEqual([]);
    expect(result.average).toBe("#000000");
    vi.unstubAllGlobals();
  });
});
