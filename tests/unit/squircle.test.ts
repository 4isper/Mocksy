import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  squirclePathD,
  squirclePoints,
  squircleUnitD,
  overlayClipDefForSpec,
} from "@/lib/render/squircle";
import { getFrameSpec } from "@/lib/render/frames";

function parsePoints(d: string): Array<[number, number]> {
  const nums = d.match(/-?\d+\.?\d*/g)!.map(Number);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < nums.length; i += 2) pts.push([nums[i]!, nums[i + 1]!]);
  return pts;
}

describe("squircle geometry", () => {
  const W = 362;
  const H = 816;
  const R = 55;

  it("is tangent-continuous with the straight edges at the corners", () => {
    const pts = squirclePoints(W, H, R);
    // Direction-agnostic tangency: a horizontal tangent has |sin|≈0, a
    // vertical one |cos|≈0 (1° ≈ 0.0175).
    const horiz = (dx: number, dy: number) => Math.abs(dy / Math.hypot(dx, dy));
    const vert = (dx: number, dy: number) => Math.abs(dx / Math.hypot(dx, dy));
    // Top-right corner → right edge junction: last curve segment near-vertical.
    const trEnd = pts.findIndex(([x, y]) => x === W && y === H - R);
    const prev = pts[trEnd - 1]!;
    const end = pts[trEnd]!;
    expect(vert(end[0] - prev[0], end[1] - prev[1])).toBeLessThan(0.0175);
    // Bottom-left corner: first curve segment must leave the bottom edge
    // near-horizontally (regression guard for the diagonal-chord bug).
    const blStart = pts.findIndex(([x, y]) => x === R && y === H);
    const blNext = pts[blStart + 1]!;
    expect(horiz(blNext[0] - R, blNext[1] - H)).toBeLessThan(0.0175);
  });

  it("matches the closed-form superellipse point at 45°", () => {
    // Top-right corner center is (W−R, R); at θ=45° an n≈4 superellipse sits
    // at cos(45°)^0.5 from the center on each axis.
    const cx = W - R;
    const cy = R;
    const px = cx + R * Math.pow(Math.cos(Math.PI / 4), 0.5);
    const py = cy - R * Math.pow(Math.sin(Math.PI / 4), 0.5);
    const pts = squirclePoints(W, H, R);
    const nearest = pts.reduce((best, p) =>
      Math.hypot(p[0] - px, p[1] - py) < Math.hypot(best[0] - px, best[1] - py) ? p : best
    );
    expect(Math.hypot(nearest[0] - px, nearest[1] - py)).toBeLessThan(2);
  });

  it("keeps unit paths inside the unit box", () => {
    const d = squircleUnitD(R / W, R / H);
    const pts = parsePoints(d).slice(1);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(-0.001);
      expect(x).toBeLessThanOrEqual(1.001);
      expect(y).toBeGreaterThanOrEqual(-0.001);
      expect(y).toBeLessThanOrEqual(1.001);
    }
  });

  it("generates the committed iphone.svg screen cutout byte-for-byte", () => {
    const svg = fs.readFileSync(path.join(process.cwd(), "public/devices/iphone.svg"), "utf8");
    const actual = svg.match(/<path d="(M[^"]*)" fill="black"\/>/)?.[1];
    expect(actual).toBe(squirclePathD(14, 14, 362, 816, 55));
  });

  it("builds a stable clip def from an overlay spec", () => {
    const spec = getFrameSpec("iphone15", undefined);
    const def = overlayClipDefForSpec(spec);
    expect(def).not.toBeNull();
    expect(def!.id).toMatch(/^mocksy-sq-[a-z0-9]+$/i);
    expect(def!.d).toMatch(/^M [\d.]+ 0\.000000 L/);
    expect(def!.d).not.toMatch(/-?\d+\.\d{1,2}\b/);
  });
});
