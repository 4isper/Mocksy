import { describe, expect, it, vi } from "vitest";
import { annotationCanvasGradient, annotationGradientCSS, annotationSvgGradientDef } from "@/lib/render/annotationGradient";
import type { Annotation } from "@/lib/types/editor";

function gradientAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: "a1",
    type: "rect",
    x: 0.1,
    y: 0.1,
    w: 0.3,
    h: 0.2,
    text: "",
    color: "#ff0000",
    strokeWidth: 4,
    animated: false,
    gradientFrom: "#000000",
    gradientTo: "#ffffff",
    gradientVia: null,
    gradientType: "linear",
    gradientAngle: 135,
    ...overrides
  } as Annotation;
}

function mockCtx() {
  const calls: Array<{ type: string; args: number[] }> = [];
  const ctx = {
    createLinearGradient: vi.fn((...args: number[]) => {
      calls.push({ type: "linear", args });
      return { addColorStop: vi.fn() };
    }),
    createRadialGradient: vi.fn((...args: number[]) => {
      calls.push({ type: "radial", args });
      return { addColorStop: vi.fn() };
    })
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

describe("annotationCanvasGradient", () => {
  const BOX = { x: 0, y: 0, w: 200, h: 100 };

  it("measures the angle clockwise from north (CSS convention)", () => {
    // 0° runs bottom → top like CSS linear-gradient(0deg): direction
    // (sin 0, −cos 0) = (0, −1) — the "from" stop sits at the bottom.
    const { ctx, calls } = mockCtx();
    annotationCanvasGradient(ctx, gradientAnnotation({ gradientAngle: 0 }), BOX.x, BOX.y, BOX.w, BOX.h);
    const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = calls[0]!.args;
    expect(x1).toBeCloseTo(100);
    expect(y1).toBeGreaterThan(50);
    expect(x2).toBeCloseTo(100);
    expect(y2).toBeLessThan(50);
  });

  it("points 90° to the right", () => {
    const { ctx, calls } = mockCtx();
    annotationCanvasGradient(ctx, gradientAnnotation({ gradientAngle: 90 }), BOX.x, BOX.y, BOX.w, BOX.h);
    const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = calls[0]!.args;
    expect(x1).toBeLessThan(100);
    expect(x2).toBeGreaterThan(100);
    expect(y1).toBeCloseTo(y2, 5);
  });

  it("uses the CSS gradient-line length through the center", () => {
    // At 0°: len = |w·sin0| + |h·cos0| = 100 → endpoints at cy ± 50.
    const { ctx, calls } = mockCtx();
    annotationCanvasGradient(ctx, gradientAnnotation({ gradientAngle: 0 }), BOX.x, BOX.y, BOX.w, BOX.h);
    const [, y1 = 0, , y2 = 0] = calls[0]!.args;
    expect(Math.abs(y2 - y1)).toBeCloseTo(100);
  });

  it("uses farthest-corner radius for radial gradients", () => {
    const { ctx, calls } = mockCtx();
    annotationCanvasGradient(ctx, gradientAnnotation({ gradientType: "radial" }), BOX.x, BOX.y, BOX.w, BOX.h);
    const [cx = 0, cy = 0, r0 = 0, , , r = 0] = calls[0]!.args;
    expect(cx).toBeCloseTo(100);
    expect(cy).toBeCloseTo(50);
    expect(r0).toBe(0);
    expect(r).toBeCloseTo(Math.hypot(200, 100) / 2);
  });

  it("returns null without gradient colors", () => {
    const { ctx } = mockCtx();
    expect(annotationCanvasGradient(ctx, gradientAnnotation({ gradientFrom: "" }), 0, 0, 10, 10)).toBeNull();
  });
});

describe("annotationSvgGradientDef", () => {
  it("emits the CSS gradient direction as objectBoundingBox percentages", () => {
    // 0°: direction (0, −1) → start at the bottom edge (y=100%), end at top (0%).
    const { def } = annotationSvgGradientDef(gradientAnnotation({ gradientAngle: 0 }), "g1", 0, 0, 200, 100)!;
    expect(def).toContain('x1="50%"');
    expect(def).toContain('y1="100%"');
    expect(def).toContain('x2="50%"');
    expect(def).toContain('y2="0%"');
  });

  it("matches the canvas path for a non-square box at 135°", () => {
    // The default 135° must run to bottom-right (CSS: 135° = ↘), i.e.
    // x1 < 50% < x2 and y1 < 50% < y2 — the old math-convention code produced
    // the mirrored top-right → bottom-left sweep.
    const { def } = annotationSvgGradientDef(gradientAnnotation({ gradientAngle: 135 }), "g2", 0, 0, 200, 100)!;
    const x1 = Number(def.match(/x1="([-\d.]+)%"/)![1]);
    const y1 = Number(def.match(/y1="([-\d.]+)%"/)![1]);
    const x2 = Number(def.match(/x2="([-\d.]+)%"/)![1]);
    const y2 = Number(def.match(/y2="([-\d.]+)%"/)![1]);
    expect(x1).toBeLessThan(50);
    expect(y1).toBeLessThan(50);
    expect(x2).toBeGreaterThan(50);
    expect(y2).toBeGreaterThan(50);
  });

  it("emits a userSpaceOnUse circle with the farthest-corner radius for radial", () => {
    const { def } = annotationSvgGradientDef(gradientAnnotation({ gradientType: "radial" }), "g3", 10, 20, 200, 100)!;
    expect(def).toContain('gradientUnits="userSpaceOnUse"');
    expect(def).toContain('cx="110"');
    expect(def).toContain('cy="70"');
    expect(def).toContain(`r="${Number((Math.hypot(200, 100) / 2).toFixed(2))}"`);
  });
});

describe("annotationGradientCSS", () => {
  it("keeps the CSS string form for previews", () => {
    expect(annotationGradientCSS(gradientAnnotation({ gradientAngle: 45 }))).toBe("linear-gradient(45deg, #000000, #ffffff)");
    expect(annotationGradientCSS(gradientAnnotation({ gradientType: "radial" }))).toBe("radial-gradient(circle, #000000, #ffffff)");
  });
});
