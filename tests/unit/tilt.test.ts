import { describe, expect, it, vi } from "vitest";
import {
  TILT_LIMIT,
  TILT_PERSPECTIVE,
  drawTiltedQuad,
  hasTilt,
  projectPoint,
  projectTiltedRect,
  tiltCss,
  tiltMatrixSvg
} from "@/lib/render/tilt";

function scene(tiltX = 0, tiltY = 0) {
  return { tiltX, tiltY };
}

describe("hasTilt", () => {
  it("is false when both angles are zero", () => {
    expect(hasTilt(scene(0, 0))).toBe(false);
  });

  it("is true when either angle is non-zero", () => {
    expect(hasTilt(scene(5, 0))).toBe(true);
    expect(hasTilt(scene(0, -3))).toBe(true);
  });

  it("ignores sub-threshold jitter", () => {
    expect(hasTilt(scene(0.001, 0))).toBe(false);
  });
});

describe("tiltCss", () => {
  it("returns an empty string without tilt", () => {
    expect(tiltCss(scene(0, 0))).toBe("");
  });

  it("builds perspective + rotateY + rotateX in the canvas order", () => {
    expect(tiltCss(scene(10, 15))).toBe(`perspective(${TILT_PERSPECTIVE}px) rotateY(10deg) rotateX(15deg) `);
  });
});

describe("projectPoint", () => {
  it("keeps the center on the projection axis", () => {
    expect(projectPoint(0, 0, 20, 20, TILT_PERSPECTIVE)).toEqual({ x: 0, y: 0 });
  });

  it("foreshortens the horizontal width for tiltX", () => {
    const p = projectPoint(100, 0, 25, 0, TILT_PERSPECTIVE);
    expect(p.x).toBeLessThan(100);
    expect(p.y).toBeCloseTo(0);
  });

  it("foreshortens the vertical height for tiltY", () => {
    const p = projectPoint(0, 100, 0, 25, TILT_PERSPECTIVE);
    expect(p.y).toBeLessThan(100);
  });

  it("moves the near edge away from the axis of rotation", () => {
    // rotateY around the vertical axis: +x edge moves toward the viewer.
    const p = projectPoint(100, 0, 25, 0, TILT_PERSPECTIVE);
    expect(p.x).toBeGreaterThan(0);
  });

  it("applies rotateX then rotateY to match the CSS transform order", () => {
    // CSS `rotateY(20deg) rotateX(15deg)` applies the rightmost function
    // (rotateX) first, so the projection must not be a plain rotateY-then-rotateX.
    const p = projectPoint(100, 100, 20, 15, 1000);
    expect(p.x).toBeCloseTo(101.815, 2);
    expect(p.y).toBeCloseTo(95.647, 2);
  });
});

describe("projectTiltedRect", () => {
  const rect = { x: 100, y: 200, width: 400, height: 300 };

  it("returns the original corners without tilt", () => {
    const q = projectTiltedRect(rect, 0, 0);
    expect(q).toEqual({ tl: { x: 100, y: 200 }, tr: { x: 500, y: 200 }, bl: { x: 100, y: 500 }, br: { x: 500, y: 500 } });
  });

  it("grows the near (viewer-facing) edge under perspective", () => {
    // rotateY by +20° swings the left edge toward the viewer (matching CSS
    // rotateY(θ): positive θ brings the -x side forward), so it projects
    // larger than the far edge.
    const q = projectTiltedRect(rect, 20, 0, 1000);
    const leftHeight = q.bl.y - q.tl.y;
    const rightHeight = q.br.y - q.tr.y;
    expect(leftHeight).toBeGreaterThan(rightHeight);
  });

  it("shrinks the projected width when tilting around Y", () => {
    const q = projectTiltedRect(rect, 25, 0);
    expect(q.tr.x - q.tl.x).toBeLessThan(rect.width);
  });
});

describe("tiltMatrixSvg", () => {
  const rect = { x: 0, y: 0, width: 400, height: 300 };

  it("returns an empty string without tilt", () => {
    expect(tiltMatrixSvg(scene(0, 0), rect)).toBe("");
  });

  it("returns a six-value matrix string when tilted", () => {
    expect(tiltMatrixSvg(scene(10, 0), rect)).toMatch(/^matrix\(/);
  });

  it("is identity-like for a zero tilt (matches unit square mapping)", () => {
    const m = tiltMatrixSvg(scene(0, 0), rect);
    expect(m).toBe("");
  });
});

describe("drawTiltedQuad", () => {
  it("skips empty sources", () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      transform: vi.fn(),
      drawImage: vi.fn()
    } as unknown as CanvasRenderingContext2D;
    drawTiltedQuad(ctx, { width: 0, height: 100 } as unknown as HTMLCanvasElement, {
      tl: { x: 0, y: 0 },
      tr: { x: 10, y: 0 },
      bl: { x: 0, y: 10 },
      br: { x: 10, y: 10 }
    });
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it("warps the source into a grid of tiles for a real quad", () => {
    const calls: Record<string, number> = {};
    const track = (name: string) => () => {
      calls[name] = (calls[name] ?? 0) + 1;
    };
    const ctx = {
      save: track("save"),
      restore: track("restore"),
      beginPath: track("beginPath"),
      moveTo: track("moveTo"),
      lineTo: track("lineTo"),
      closePath: track("closePath"),
      clip: track("clip"),
      transform: track("transform"),
      drawImage: track("drawImage")
    } as unknown as CanvasRenderingContext2D;

    const source = { width: 200, height: 100 } as unknown as HTMLCanvasElement;
    const quad = {
      tl: { x: 0, y: 0 },
      tr: { x: 100, y: 0 },
      bl: { x: 0, y: 100 },
      br: { x: 100, y: 100 }
    };

    drawTiltedQuad(ctx, source, quad);

    // Default TILT_SUBDIVISIONS = 20 → 20×20 = 400 tiles, each clipped +
    // transformed + drawn, wrapped in save/restore.
    expect(calls.transform).toBe(400);
    expect(calls.drawImage).toBe(400);
    expect(calls.clip).toBe(400);
    expect(calls.save).toBe(400);
    expect(calls.restore).toBe(400);
  });

  it("honors a custom subdivision count", () => {
    const calls: Record<string, number> = {};
    const track = (name: string) => () => {
      calls[name] = (calls[name] ?? 0) + 1;
    };
    const ctx = {
      save: track("save"),
      restore: track("restore"),
      beginPath: track("beginPath"),
      moveTo: track("moveTo"),
      lineTo: track("lineTo"),
      closePath: track("closePath"),
      clip: track("clip"),
      transform: track("transform"),
      drawImage: track("drawImage")
    } as unknown as CanvasRenderingContext2D;

    const source = { width: 50, height: 50 } as unknown as HTMLCanvasElement;
    const quad = {
      tl: { x: 0, y: 0 },
      tr: { x: 50, y: 0 },
      bl: { x: 0, y: 50 },
      br: { x: 50, y: 50 }
    };

    drawTiltedQuad(ctx, source, quad, 4);
    expect(calls.drawImage).toBe(16);
  });

  it("maps each tile transform to its destination quad", () => {
    const transforms: number[][] = [];
    const ctx = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      clip: () => {},
      transform: (...args: number[]) => transforms.push(args),
      drawImage: () => {}
    } as unknown as CanvasRenderingContext2D;

    const source = { width: 100, height: 100 } as unknown as HTMLCanvasElement;
    // Affine parallelogram: top edge spans (0,0)→(100,0), left edge (0,0)→(0,100).
    const quad = {
      tl: { x: 0, y: 0 },
      tr: { x: 100, y: 0 },
      bl: { x: 0, y: 100 },
      br: { x: 100, y: 100 }
    };
    drawTiltedQuad(ctx, source, quad, 2);

    // transform(a,b,c,d,e,f): a = (tr - tl).x / subW, e = tl.x of the tile.
    // Tiles overlap by half a cell (EPS_U = 0.5 / subdivisions), so the second
    // column starts at u0 = 0.5 - 0.25 = 0.25 → e = 25, not 50.
    const first = transforms[0]!;
    expect(first[0]).toBeCloseTo(1, 5); // a: horizontal scale (unit quad)
    expect(first[4]).toBeCloseTo(0, 5); // e: top-left corner starts at x=0
    const last = transforms[transforms.length - 1]!;
    expect(last[4]).toBeCloseTo(25, 3); // last column overlaps: starts at x=25
  });
});

describe("TILT_LIMIT", () => {
  it("caps sliders at ±25°", () => {
    expect(TILT_LIMIT).toBe(25);
  });
});
