import { describe, expect, it } from "vitest";
import {
  TILT_PERSPECTIVE,
  hasTilt,
  projectTiltedRect,
  tiltCss,
  tiltMatrixSvg,
  type Quad
} from "@/lib/render/tilt";
import type { EditorScene } from "@/lib/types/editor";

function scene(tiltX = 0, tiltY = 0): Pick<EditorScene, "tiltX" | "tiltY"> {
  return { tiltX, tiltY };
}

/** Parses an SVG `matrix(a b c d e f)` into its components. */
function parseMatrix(m: string): { a: number; b: number; c: number; d: number; e: number; f: number } {
  const nums = (m.match(/matrix\(([^)]+)\)/)?.[1] ?? "").trim().split(/\s+/).map(Number);
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = nums;
  return { a, b, c, d, e, f };
}

describe("tilt consistency across renderers", () => {
  it("only activates tilt when a non-trivial angle is present (all renderers agree)", () => {
    expect(hasTilt(scene(0, 0))).toBe(false);
    expect(tiltCss(scene(0, 0))).toBe("");
    expect(tiltMatrixSvg(scene(0, 0), { x: 0, y: 0, width: 100, height: 100 })).toBe("");
    // Canvas projection is identity without tilt.
    expect(projectTiltedRect({ x: 0, y: 0, width: 100, height: 100 }, 0, 0)).toEqual({
      tl: { x: 0, y: 0 },
      tr: { x: 100, y: 0 },
      bl: { x: 0, y: 100 },
      br: { x: 100, y: 100 }
    });
  });

  it("CSS and SVG both stay flat when there is no tilt", () => {
    const rect = { x: 50, y: 60, width: 400, height: 300 };
    expect(tiltCss(scene(0, 0))).toBe("");
    expect(tiltMatrixSvg(scene(0, 0), rect)).toBe("");
  });

  it("the SVG affine matrix pins the same three corners the canvas projects", () => {
    // The three renderers must agree on where the frame's corners land under
    // tilt, otherwise the preview (CSS), the PNG/video export (canvas warp)
    // and the SVG export visibly diverge. The SVG matrix is an affine best-fit
    // of the exact canvas projection through the top-left / top-right / bottom-
    // left corners (documented in tilt.ts), so those three corners must map
    // consistently. The bottom-right corner is the only one the perspective
    // trapezoid and the affine parallelogram can disagree on, and the gap stays
    // small within the ±25° tilt limit (SVG has no perspective).
    //
    // The SVG matrix is serialized to 2 decimals, so on a small rect the anchor
    // corners agree to that precision; on a full-size frame the rounding is
    // amplified by the rect size but stays within a tight tolerance.
    const angles: Array<[number, number]> = [[10, 0], [0, 15], [12, 18], [-20, -10]];
    for (const [tx, ty] of angles) {
      const small = { x: 10, y: 20, width: 40, height: 30 };
      const sQuad = projectTiltedRect(small, tx, ty);
      const sm = parseMatrix(tiltMatrixSvg(scene(tx, ty), small));
      const smap = (x: number, y: number) => ({ x: sm.a * x + sm.c * y + sm.e, y: sm.b * x + sm.d * y + sm.f });
      // The matrix maps the rect's ABSOLUTE corners (SVG content is drawn in
      // box coordinates): (rect.x, rect.y) must land on the projected tl.
      const stl = smap(small.x, small.y);
      const str = smap(small.x + small.width, small.y);
      const sbl = smap(small.x, small.y + small.height);
      // SVG serializes its matrix to 2 decimals, so anchor corners on this
      // 40px-wide rect stay within a quarter-pixel of the exact projection.
      expect(Math.abs(stl.x - sQuad.tl.x)).toBeLessThan(0.25);
      expect(Math.abs(stl.y - sQuad.tl.y)).toBeLessThan(0.25);
      expect(Math.abs(str.x - sQuad.tr.x)).toBeLessThan(0.25);
      expect(Math.abs(str.y - sQuad.tr.y)).toBeLessThan(0.25);
      expect(Math.abs(sbl.x - sQuad.bl.x)).toBeLessThan(0.25);
      expect(Math.abs(sbl.y - sQuad.bl.y)).toBeLessThan(0.25);

      const big = { x: 100, y: 200, width: 400, height: 300 };
      const quad = projectTiltedRect(big, tx, ty);
      const m = parseMatrix(tiltMatrixSvg(scene(tx, ty), big));
      const map = (x: number, y: number) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
      const tl = map(big.x, big.y);
      const tr = map(big.x + big.width, big.y);
      const bl = map(big.x, big.y + big.height);
      const br = map(big.x + big.width, big.y + big.height);

      // On a full-size frame the SVG affine matrix (2-decimal rounding plus the
      // inherent parallelogram approximation of the perspective trapezoid)
      // keeps the three anchor corners within a few px of the exact canvas
      // projection. The 2-decimal rounding is amplified by the absolute
      // coordinates the matrix multiplies (~500px × 0.005 ≈ 2.5px), hence the
      // 3px bound — visually consistent at export resolution.
      expect(Math.abs(tl.x - quad.tl.x)).toBeLessThan(3);
      expect(Math.abs(tl.y - quad.tl.y)).toBeLessThan(3);
      expect(Math.abs(tr.x - quad.tr.x)).toBeLessThan(3);
      expect(Math.abs(tr.y - quad.tr.y)).toBeLessThan(3);
      expect(Math.abs(bl.x - quad.bl.x)).toBeLessThan(3);
      expect(Math.abs(bl.y - quad.bl.y)).toBeLessThan(3);

      // The fourth corner is an affine approximation of the perspective
      // trapezoid: SVG has no perspective, so it can only match three corners
      // exactly. Within the ±25° tilt limit the residual stays bounded to a
      // fraction of the frame size (here <10% of the 400px width), visually
      // close rather than a wild divergence.
      expect(Math.abs(br.x - quad.br.x)).toBeLessThan(big.width * 0.12);
      expect(Math.abs(br.y - quad.br.y)).toBeLessThan(big.height * 0.12);
    }
  });

  it("a tilted scene emits a CSS perspective transform matching the shared perspective constant", () => {
    expect(tiltCss(scene(8, 14))).toBe(
      `perspective(${TILT_PERSPECTIVE}px) rotateY(8deg) rotateX(14deg) `
    );
  });

  it("ties the SVG matrix to the same perspective constant as the CSS/canvas projections", () => {
    const rect = { x: 0, y: 0, width: 300, height: 200 };
    const quad = projectTiltedRect(rect, 18, 22, TILT_PERSPECTIVE);
    const m = parseMatrix(tiltMatrixSvg(scene(18, 22), rect, TILT_PERSPECTIVE));
    const map = (x: number, y: number) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
    const tl = map(0, 0);
    expect(tl.x).toBeCloseTo(quad.tl.x, 1);
    expect(tl.y).toBeCloseTo(quad.tl.y, 1);
  });
});
