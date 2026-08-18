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
});

describe("TILT_LIMIT", () => {
  it("caps sliders at ±25°", () => {
    expect(TILT_LIMIT).toBe(25);
  });
});
