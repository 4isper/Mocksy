import { describe, expect, it } from "vitest";
import { computeArrowGeometry } from "@/lib/render/annotationArrow";
import type { Annotation } from "@/lib/types/editor";

function arrow(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: "a",
    type: "arrow",
    x: 0.1,
    y: 0.2,
    w: 0.4,
    h: 0.3,
    text: "",
    color: "#fff",
    strokeWidth: 2,
    fontSize: 24,
    ...overrides,
  };
}

describe("computeArrowGeometry", () => {
  it("maps fractional coords to canvas-pixel line endpoints", () => {
    // bx/by normalize negative w/h; here both are positive so box top-left is
    // the annotation origin.
    const g = computeArrowGeometry(arrow(), 1000, 1000, 0.1, 0.2);
    expect(g.startX).toBeCloseTo(0);
    expect(g.startY).toBeCloseTo(0);
    expect(g.endX).toBeCloseTo(400);
    expect(g.endY).toBeCloseTo(300);
    // Arrowhead points anchor at the end point (the polygon's first coord).
    expect(g.points.startsWith("400,300")).toBe(true);
  });

  it("inverts endpoints when the arrow points up-left (negative w/h)", () => {
    const g = computeArrowGeometry(arrow({ x: 0.5, y: 0.5, w: -0.4, h: -0.3 }), 1000, 1000, 0.1, 0.2);
    expect(g.startX).toBeCloseTo(400);
    expect(g.startY).toBeCloseTo(300);
    expect(g.endX).toBeCloseTo(0);
    expect(g.endY).toBeCloseTo(0);
  });

  it("falls back to a 1px canvas when size is missing", () => {
    const g = computeArrowGeometry(arrow(), 0, 0, 0, 0);
    // 1px canvas -> fractions map nearly 1:1, shifted by the box origin.
    expect(g.startX).toBeCloseTo(0.1);
    expect(g.startY).toBeCloseTo(0.2);
    expect(g.endX).toBeCloseTo(0.5);
    expect(g.endY).toBeCloseTo(0.5);
  });
});
