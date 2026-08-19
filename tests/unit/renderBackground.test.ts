import { describe, expect, it, vi } from "vitest";
import { mulberry32, fillGradientBackground, fillBackgroundImage, fillPatternBackground, paintBackground } from "@/lib/render/renderBackground";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene } from "@/lib/types/editor";

function mockCtx(): CanvasRenderingContext2D {
  const fillStyles: string[] = [];
  const gradientStops: Array<[number, string]> = [];
  const grad = {
    addColorStop: (offset: number, color: string) => gradientStops.push([offset, color])
  };
  const ctx: Record<string, unknown> = {
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    closePath: vi.fn(),
    drawImage: vi.fn(),
    clearRect: vi.fn(),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4).fill(120),
      width: w,
      height: h
    }),
    putImageData: vi.fn(),
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    measureText: (t: string) => ({ width: t.length * 10 }),
    set fillStyle(v: unknown) { fillStyles.push(String(v)); },
    get fillStyle() { return fillStyles[fillStyles.length - 1]; },
    set strokeStyle(_v: unknown) {},
    set lineWidth(_v: unknown) {},
    set lineCap(_v: unknown) {},
    set filter(_v: unknown) {}
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

function sceneWith(overrides: Partial<EditorScene>): EditorScene {
  return { ...initialScene, ...overrides };
}

describe("mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("produces values in [0, 1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("fillGradientBackground", () => {
  it("uses radial gradient stops", () => {
    const ctx = mockCtx();
    fillGradientBackground(ctx, sceneWith({ gradientType: "radial", gradientFrom: "#111", gradientTo: "#222" }), 100, 100);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 100);
  });

  it("uses linear gradient with an explicit via stop", () => {
    const ctx = mockCtx();
    fillGradientBackground(ctx, sceneWith({ gradientType: "linear", gradientFrom: "#111", gradientVia: "#abc", gradientTo: "#222" }), 100, 100);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 100);
  });
});

describe("fillBackgroundImage", () => {
  it("draws the image cover-fitted and returns true", () => {
    const ctx = mockCtx();
    const drawn = { w: 0, h: 0 };
    (ctx.drawImage as ReturnType<typeof vi.fn>) = vi.fn((_img, x, y, w, h) => {
      drawn.w = w;
      drawn.h = h;
    });
    const ok = fillBackgroundImage(ctx, { naturalWidth: 50, naturalHeight: 50 } as CanvasImageSource, 100, 100, 2, 0);
    expect(ok).toBe(true);
    expect(drawn.w).toBeGreaterThanOrEqual(100);
  });

  it("applies a blur filter when requested", () => {
    const ctx = mockCtx();
    let filter = "";
    Object.defineProperty(ctx, "filter", { set: (v: string) => { filter = v; }, get: () => filter, configurable: true });
    fillBackgroundImage(ctx, { naturalWidth: 50, naturalHeight: 50 } as CanvasImageSource, 100, 100, 2, 4);
    expect(filter).toBe("blur(8px)");
  });
});

describe("fillPatternBackground", () => {
  it("falls back to a neutral fill for an unknown pattern", () => {
    const ctx = mockCtx();
    fillPatternBackground(ctx, sceneWith({ patternId: "does-not-exist" as EditorScene["patternId"] }), 40, 40);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 40, 40);
  });

  it("paints every known pattern without throwing", () => {
    const patterns = ["dots", "grid", "diagonal", "noise", "plus", "cross", "triangle"] as const;
    for (const patternId of patterns) {
      const ctx = mockCtx();
      expect(() => fillPatternBackground(ctx, sceneWith({ patternId }), 60, 60)).not.toThrow();
      expect(ctx.fillRect).toHaveBeenCalled();
    }
  });

  it("noise modifies pixel data deterministically", () => {
    const ctx = mockCtx();
    const data = new Uint8ClampedArray(4 * 4 * 4).fill(120);
    (ctx as unknown as { getImageData: () => { data: Uint8ClampedArray } }).getImageData = () => ({ data });
    fillPatternBackground(ctx, sceneWith({ patternId: "noise" }), 4, 4);
    expect(ctx.putImageData).toHaveBeenCalled();
    // Stable across two runs of the same canvas size.
    const data2 = new Uint8ClampedArray(4 * 4 * 4).fill(120);
    (ctx as unknown as { getImageData: () => { data: Uint8ClampedArray } }).getImageData = () => ({ data: data2 });
    fillPatternBackground(ctx, sceneWith({ patternId: "noise" }), 4, 4);
    expect(Array.from(data)).toEqual(Array.from(data2));
  });
});

describe("paintBackground", () => {
  it("paints a solid color", () => {
    const ctx = mockCtx();
    paintBackground(ctx, sceneWith({ backgroundMode: "solid", backgroundColor: "#abcdef" }), 100, 100, 1);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 100);
  });

  it("delegates to the gradient fill", () => {
    const ctx = mockCtx();
    paintBackground(ctx, sceneWith({ backgroundMode: "gradient", gradientFrom: "#111", gradientTo: "#222" }), 100, 100, 1);
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("delegates to the pattern fill", () => {
    const ctx = mockCtx();
    paintBackground(ctx, sceneWith({ backgroundMode: "pattern", patternId: "dots" }), 100, 100, 1);
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("paints an image when supplied", () => {
    const ctx = mockCtx();
    const ok = paintBackground(ctx, sceneWith({ backgroundMode: "image", backgroundBlur: 0 }), 100, 100, 1, undefined, { naturalWidth: 50, naturalHeight: 50 } as CanvasImageSource);
    expect(ok).toBeUndefined();
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it("uses the supplied fill for transparent mode", () => {
    const ctx = mockCtx();
    paintBackground(ctx, sceneWith({ backgroundMode: "transparent" }), 100, 100, 1, "rgba(0,0,0,1)");
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 100);
  });

  it("falls back to the empty color for unsupported combos", () => {
    const ctx = mockCtx();
    paintBackground(ctx, sceneWith({ backgroundMode: "transparent" }), 100, 100, 1, undefined, null, "rgba(9,9,9,0.5)");
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 100);
  });
});
