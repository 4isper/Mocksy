import { describe, expect, it } from "vitest";
import {
  PREVIEW_ZOOM_MAX,
  PREVIEW_ZOOM_MIN,
  clampPan,
  clampZoom,
  nextZoom,
  panForZoom,
  resolveZoomScale,
  sliderToZoom,
  snapZoom,
  stepZoomDirection,
  zoomAroundCenter,
  zoomFactorFromDelta,
  zoomToSlider
} from "@/lib/render/previewViewport";

describe("resolveZoomScale", () => {
  it("maps fit to exactly 1 and passes numbers through", () => {
    expect(resolveZoomScale("fit")).toBe(1);
    expect(resolveZoomScale(0.5)).toBe(0.5);
    expect(resolveZoomScale(2)).toBe(2);
  });
});

describe("zoomFactorFromDelta", () => {
  it("scrolling up (negative deltaY) zooms in, down zooms out", () => {
    expect(zoomFactorFromDelta(-100)).toBeGreaterThan(1);
    expect(zoomFactorFromDelta(100)).toBeLessThan(1);
  });

  it("is symmetric around 1 for opposite deltas", () => {
    const up = zoomFactorFromDelta(-100);
    const down = zoomFactorFromDelta(100);
    expect(up * down).toBeCloseTo(1, 12);
  });

  it("normalizes line delta mode to pixel-equivalent", () => {
    expect(zoomFactorFromDelta(1, 1)).toBeCloseTo(zoomFactorFromDelta(16), 12);
  });

  it("returns 1 when the wheel didn't move", () => {
    expect(zoomFactorFromDelta(0)).toBe(1);
  });
});

describe("clampZoom / nextZoom / snapZoom", () => {
  it("clamps to the supported range", () => {
    expect(clampZoom(0.01)).toBe(PREVIEW_ZOOM_MIN);
    expect(clampZoom(99)).toBe(PREVIEW_ZOOM_MAX);
  });

  it("applies a multiplicative factor", () => {
    expect(nextZoom(1, 2)).toBeCloseTo(2, 10);
  });

  it("never leaves the range after a step", () => {
    expect(nextZoom(PREVIEW_ZOOM_MAX, 2)).toBe(PREVIEW_ZOOM_MAX);
    expect(nextZoom(PREVIEW_ZOOM_MIN, 0.4)).toBe(PREVIEW_ZOOM_MIN);
  });

  it("snaps near familiar stops", () => {
    expect(snapZoom(0.97)).toBe(1);
    expect(snapZoom(1.03)).toBe(1);
    expect(snapZoom(0.8)).toBe(0.75);
    // Far from any stop: unchanged (beyond clamping).
    expect(snapZoom(1.1)).toBeCloseTo(1.1, 10);
  });

  it("cleans float dust around 100%", () => {
    expect(nextZoom(1, Math.sqrt(1.25) / Math.sqrt(1.25))).toBe(1);
    expect(nextZoom(1.0000000001, 1)).toBe(1);
  });

  it("can skip snapping for smooth pinch gestures", () => {
    expect(nextZoom(1, 1.05, false)).toBeCloseTo(1.05, 10);
  });
});

describe("panForZoom", () => {
  it("keeps the content point under the cursor fixed on screen", () => {
    // `pan`/`anchor` live in screen space relative to the viewport center;
    // q = pan + scale·content maps content points onto the screen.
    const pan = { x: 40, y: -20 };
    const cursor = { x: 100, y: 50 };
    const prev = 1;
    const next = 2;
    // Content point currently under the cursor…
    const content = { x: (cursor.x - pan.x) / prev, y: (cursor.y - pan.y) / prev };
    // …must land back on the cursor after rescaling.
    const nextPan = panForZoom(pan, cursor, prev, next);
    expect(nextPan.x + next * content.x).toBeCloseTo(cursor.x, 10);
    expect(nextPan.y + next * content.y).toBeCloseTo(cursor.y, 10);
  });

  it("is a no-op when the scale doesn't change", () => {
    expect(panForZoom({ x: 12, y: -3 }, { x: 5, y: 5 }, 1.5, 1.5)).toEqual({ x: 12, y: -3 });
  });

  it("scales pan proportionally when anchored at the center", () => {
    expect(panForZoom({ x: 30, y: -10 }, { x: 0, y: 0 }, 1, 2)).toEqual({ x: 60, y: -20 });
  });
});

describe("clampPan", () => {
  it("allows panning exactly across the overflow at >fit zooms", () => {
    // 800×600 viewport at 2×: overflow is 400 horizontally, 300 vertically.
    expect(clampPan({ x: 999, y: -999 }, 2, 800, 600)).toEqual({ x: 400, y: -300 });
  });

  it("keeps content centered below fit (nothing to pan)", () => {
    expect(clampPan({ x: 120, y: -80 }, 0.5, 800, 600)).toEqual({ x: 0, y: 0 });
  });

  it("keeps content centered exactly at fit", () => {
    expect(clampPan({ x: 5, y: 5 }, 1, 800, 600)).toEqual({ x: 0, y: 0 });
  });

  it("passes through in-range values untouched", () => {
    expect(clampPan({ x: 100, y: -50 }, 2, 800, 600)).toEqual({ x: 100, y: -50 });
  });
});

describe("zoomAroundCenter", () => {
  it("returns the stepped zoom and proportionally scaled pan", () => {
    const next = zoomAroundCenter(1, 2, { x: 30, y: 0 });
    expect(next.zoom).toBeCloseTo(2, 10);
    expect(next.pan).toEqual({ x: 60, y: 0 });
  });

  it("resets a fit view cleanly", () => {
    const next = zoomAroundCenter("fit", 0.5, { x: 0, y: 0 });
    expect(next.zoom).toBeCloseTo(0.5, 10);
    expect(next.pan).toEqual({ x: 0, y: 0 });
  });
});

describe("stepZoomDirection", () => {
  it("walks the stop list upward and downward", () => {
    expect(stepZoomDirection(1, 1)).toBeCloseTo(1.25, 10);
    expect(stepZoomDirection(1, -1)).toBeCloseTo(0.75, 10);
    expect(stepZoomDirection(0.9, 1)).toBeCloseTo(1, 10);
    expect(stepZoomDirection(1.1, -1)).toBeCloseTo(1, 10);
  });

  it("saturates at the range edges", () => {
    expect(stepZoomDirection(PREVIEW_ZOOM_MAX, 1)).toBe(PREVIEW_ZOOM_MAX);
    expect(stepZoomDirection(PREVIEW_ZOOM_MIN, -1)).toBe(PREVIEW_ZOOM_MIN);
  });
});

describe("zoomToSlider / sliderToZoom", () => {
  it("round-trips through the log scale", () => {
    for (const z of [0.25, 0.5, 1, 1.7, 2, 4]) {
      expect(sliderToZoom(zoomToSlider(z))).toBeCloseTo(z, 1);
    }
  });

  it("puts equal log distances at equal slider travel", () => {
    const half = zoomToSlider(1); // geometric middle of 0.25…4
    expect(half).toBeCloseTo(50, 0);
    expect(Math.abs(zoomToSlider(0.5) - 50)).toBeCloseTo(Math.abs(zoomToSlider(2) - 50), 6);
  });
});
