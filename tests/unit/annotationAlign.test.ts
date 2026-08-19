import { describe, expect, it } from "vitest";
import {
  alignAnnotations,
  computeSmartGuide,
  distributeAnnotations,
  normBox,
  selectionBounds
} from "@/lib/render/annotationAlign";
import type { Annotation } from "@/lib/types/editor";

function anno(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: "a",
    type: "rect",
    x: 0.2,
    y: 0.2,
    w: 0.2,
    h: 0.2,
    text: "",
    color: "#fff",
    strokeWidth: 4,
    fontSize: 48,
    ...overrides
  };
}

describe("normBox", () => {
  it("normalizes negative w/h into a positive box", () => {
    const b = normBox(anno({ x: 0.4, y: 0.4, w: -0.2, h: -0.1 }));
    expect(b.left).toBeCloseTo(0.2);
    expect(b.top).toBeCloseTo(0.3);
    expect(b.right).toBeCloseTo(0.4);
    expect(b.bottom).toBeCloseTo(0.4);
    expect(b.cx).toBeCloseTo(0.3);
    expect(b.cy).toBeCloseTo(0.35);
  });
});

describe("selectionBounds", () => {
  it("returns null for no boxes", () => {
    expect(selectionBounds([])).toBeNull();
  });
  it("spans the union of all boxes", () => {
    const b = selectionBounds([normBox(anno({ x: 0, y: 0, w: 0.2, h: 0.2 })), normBox(anno({ x: 0.5, y: 0.5, w: 0.2, h: 0.2 }))]);
    expect(b).toEqual({ minX: 0, minY: 0, maxX: 0.7, maxY: 0.7 });
  });
});

describe("alignAnnotations", () => {
  const ann = [
    anno({ id: "a", x: 0.1, y: 0.1, w: 0.2, h: 0.2 }),
    anno({ id: "b", x: 0.6, y: 0.4, w: 0.3, h: 0.1 })
  ];

  it("aligns left to the selection's min left", () => {
    const p = alignAnnotations(ann, "left");
    expect(p.a!.x).toBeCloseTo(0.1);
    expect(p.b!.x).toBeCloseTo(0.1);
  });

  it("aligns right to the selection's max right", () => {
    const p = alignAnnotations(ann, "right");
    expect(p.a!.x).toBeCloseTo(0.9 - 0.2);
    expect(p.b!.x).toBeCloseTo(0.9 - 0.3);
  });

  it("aligns centerH to the selection mid-point", () => {
    const p = alignAnnotations(ann, "centerH");
    expect(p.a!.x).toBeCloseTo(0.5 - 0.2 / 2);
    expect(p.b!.x).toBeCloseTo(0.5 - 0.3 / 2);
  });

  it("aligns top/bottom/centerV along Y", () => {
    const top = alignAnnotations(ann, "top");
    const bottom = alignAnnotations(ann, "bottom");
    const centerV = alignAnnotations(ann, "centerV");
    expect(top.a!.y).toBeCloseTo(0.1);
    expect(bottom.b!.y).toBeCloseTo(0.5 - 0.1);
    expect(centerV.a!.y).toBeCloseTo(0.3 - 0.2 / 2);
  });

  it("aligns a single annotation against the canvas", () => {
    const p = alignAnnotations([anno({ x: 0.2, y: 0.2, w: 0.2, h: 0.2 })], "centerH");
    expect(p.a!.x).toBeCloseTo(0.4);
  });
});

describe("distributeAnnotations", () => {
  it("returns empty for fewer than three annotations", () => {
    expect(distributeAnnotations([anno(), anno()], "horizontal")).toEqual({});
  });

  it("spreads three annotations with equal X gaps", () => {
    const ann = [
      anno({ id: "a", x: 0.0, y: 0, w: 0.1, h: 0.1 }),
      anno({ id: "b", x: 0.2, y: 0, w: 0.1, h: 0.1 }),
      anno({ id: "c", x: 0.9, y: 0, w: 0.1, h: 0.1 })
    ];
    const p = distributeAnnotations(ann, "horizontal");
    // span 0..1.0, sizes 0.1*3 = 0.3, free 0.7 across 2 gaps -> gap 0.35
    expect(p.a!.x).toBeCloseTo(0);
    expect(p.b!.x).toBeCloseTo(0.45);
    expect(p.c!.x).toBeCloseTo(0.9);
  });

  it("spreads vertically with equal Y gaps preserving order", () => {
    const ann = [
      anno({ id: "a", x: 0, y: 0.0, w: 0.1, h: 0.1 }),
      anno({ id: "b", x: 0, y: 0.5, w: 0.1, h: 0.1 }),
      anno({ id: "c", x: 0, y: 0.9, w: 0.1, h: 0.1 })
    ];
    const p = distributeAnnotations(ann, "vertical");
    expect(p.a!.y).toBeCloseTo(0);
    expect(p.b!.y).toBeCloseTo(0.45);
    expect(p.c!.y).toBeCloseTo(0.9);
  });
});

describe("computeSmartGuide", () => {
  const others = [anno({ id: "o", x: 0.3, y: 0.3, w: 0.2, h: 0.2 })];

  it("snaps the dragged left edge to another annotation's left edge", () => {
    const dragging = anno({ id: "d", x: 0.305, y: 0.6, w: 0.2, h: 0.2 });
    const r = computeSmartGuide(dragging, others, 0.02);
    expect(r.x).toBeCloseTo(0.3);
    expect(r.guides.some((g) => g.axis === "x" && g.pos === 0.3)).toBe(true);
  });

  it("snaps to the canvas horizontal centerline", () => {
    const dragging = anno({ id: "d", x: 0.39, y: 0.6, w: 0.2, h: 0.2 });
    const r = computeSmartGuide(dragging, others, 0.02);
    // cx = 0.39 + 0.1 = 0.49, target 0.5 -> shift +0.01 -> left 0.4
    expect(r.x).toBeCloseTo(0.4);
    expect(r.guides.some((g) => g.axis === "x" && g.pos === 0.5)).toBe(true);
  });

  it("returns no guides when nothing is within threshold", () => {
    const dragging = anno({ id: "d", x: 0.75, y: 0.75, w: 0.2, h: 0.2 });
    const r = computeSmartGuide(dragging, others, 0.02);
    expect(r.guides).toHaveLength(0);
    expect(r.x).toBeCloseTo(0.75);
  });

  it("snaps along Y as well as X", () => {
    const dragging = anno({ id: "d", x: 0.6, y: 0.295, w: 0.2, h: 0.2 });
    const r = computeSmartGuide(dragging, others, 0.02);
    expect(r.y).toBeCloseTo(0.3);
    expect(r.guides.some((g) => g.axis === "y" && g.pos === 0.3)).toBe(true);
  });
});
