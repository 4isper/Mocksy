import { describe, expect, it } from "vitest";
import { computeFrameBox, renderMockupToCanvas } from "@/lib/export/renderMockup";
import { getFrameSpec, SVG_VIEWBOX_WIDTH } from "@/lib/render/frames";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";

function layer(overrides: Partial<MediaLayer> = {}): MediaLayer {
  return { ...initialScene.layers[0]!, id: overrides.id ?? "layer-test", ...overrides };
}

function scene(overrides: { layer?: Partial<MediaLayer> } & Partial<EditorScene> = {}): EditorScene {
  const l = layer(overrides.layer ?? {});
  const { layer: _layer, ...sceneOverrides } = overrides;
  return { ...initialScene, layers: [l], activeLayerId: l.id, ...sceneOverrides };
}

// Inset ratio = horizontal gap between frame edge and media, over frame width.
const insetRatio = (box: ReturnType<typeof computeFrameBox>) => (box.innerX - box.x) / box.width;

describe("computeFrameBox geometry", () => {
  it("keeps the media inset ratio independent of pixelRatio (overlay cutout)", () => {
    const cssWidth = 700;
    const spec = getFrameSpec("iphone15");
    const expectedRatio = (spec.cutout?.x ?? 0) / SVG_VIEWBOX_WIDTH;

    const atDpr = (dpr: number) =>
      computeFrameBox(scene({ frame: "iphone15" }), 1400, 1400, dpr, cssWidth * dpr, cssWidth * dpr * (10 / 16));

    const low = atDpr(1);
    const high = atDpr(3);

    const ratioLow = insetRatio(low);
    const ratioHigh = insetRatio(high);

    expect(ratioLow).toBeCloseTo(expectedRatio, 5);
    expect(ratioHigh).toBeCloseTo(expectedRatio, 5);
    expect(ratioHigh).toBeCloseTo(ratioLow, 5);
  });

  it("matches the CSS preview inset ratio for a CSS-only frame", () => {
    const cssWidth = 640;
    const spec = getFrameSpec("iphone");
    const box = computeFrameBox(scene({ frame: "iphone" }), 1280, 1280, 2, cssWidth * 2, cssWidth * 2 * (10 / 16));
    expect(insetRatio(box)).toBeCloseTo(spec.padding / cssWidth, 5);
  });

  it("ignores zoom for the frame box (zoom scales the media, not the skin)", () => {
    // The frame stays at its rendered size regardless of layer zoom; zoom is
    // applied to the media inside the screen cutout in renderMockupToCanvas,
    // mirroring the preview where `scale()` acts on the media wrapper.
    const cssWidth = 600;
    const base = computeFrameBox(scene({ frame: "desktop" }), 1200, 1200, 2, cssWidth * 2, cssWidth * 2 * (10 / 16));
    const zoomed = computeFrameBox(
      scene({ frame: "desktop", layer: { zoom: 1.5 } }),
      1200,
      1200,
      2,
      cssWidth * 2,
      cssWidth * 2 * (10 / 16)
    );
    expect(zoomed.width).toBeCloseTo(base.width, 5);
    expect(zoomed.height).toBeCloseTo(base.height, 5);
    expect(insetRatio(zoomed)).toBeCloseTo(insetRatio(base), 5);
  });

  it("derives frameH from frameW with a 16:10 ratio when height is omitted", () => {
    const box = computeFrameBox(scene({ frame: "none" }), 2000, 2000, 2, 1000);
    expect(box.height).toBeCloseTo(box.width * (10 / 16), 5);
  });

  it("clips the watch frame to a full circle", () => {
    const box = computeFrameBox(scene({ frame: "watch" }), 1000, 1000, 2, 400, 400);
    expect(box.outerRadius).toBeCloseTo(200, 3);
    expect(box.innerRadius).toBeCloseTo((400 - 2 * (18 * 2)) / 2, 3);
  });

  it("keeps the explicit frame ratio instead of the 10/16 default fallback", () => {
    // The video export passes the on-screen frame box (offsetWidth/Height *
    // pixelRatio). When an explicit size is given it must be honored so the
    // iphone15/16pro skin keeps its native 390/844 ratio rather than being
    // stretched to the 10/16 default used when height is omitted.
    const fw = 380 * 2;
    const fh = 824 * 2;
    const box = computeFrameBox(scene({ frame: "iphone16pro" }), 1400, 1400, 2, fw, fh);
    expect(box.width / box.height).toBeCloseTo(fw / fh, 5);
    expect(box.width / box.height).not.toBeCloseTo(10 / 16, 2);
  });

  it("centers the frame when no explicit position is given", () => {
    const box = computeFrameBox(scene({ frame: "none" }), 1000, 500, 1, 400, 250);
    expect(box.x).toBeCloseTo((1000 - 400) / 2, 5);
    expect(box.y).toBeCloseTo((500 - 250) / 2, 5);
  });
});

describe("renderMockupToCanvas media geometry", () => {
  // Capture the drawImage call so we can assert where the media lands.
  function renderAndCapture(overrides: Partial<MediaLayer> = {}) {
    let captured: { dx: number; dy: number; dw: number; dh: number } | null = null;
    const ctx = {
      clearRect: () => {},
      fillRect: () => {},
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      quadraticCurveTo: () => {},
      closePath: () => {},
      clip: () => {},
      fill: () => {},
      stroke: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      drawImage: (img: CanvasImageSource, dx: number, dy: number, dw: number, dh: number) => {
        captured = { dx, dy, dw, dh };
      },
      set fillStyle(_v: unknown) {},
      set shadowColor(_v: unknown) {},
      set shadowBlur(_v: unknown) {},
      set shadowOffsetX(_v: unknown) {},
      set shadowOffsetY(_v: unknown) {},
      set strokeStyle(_v: unknown) {},
      set lineWidth(_v: unknown) {}
    };
    const canvas = {
      width: 1400,
      height: 1400,
      getContext: () => ctx
    } as unknown as HTMLCanvasElement;

    const scn = scene({ frame: "iphone15", layer: { mediaOffsetX: 0, mediaOffsetY: 0, zoom: 1, ...overrides } });
    const media = { naturalWidth: 1600, naturalHeight: 900 } as unknown as CanvasImageSource;
    renderMockupToCanvas(canvas, scn, media, undefined, undefined, 700 * 2, 700 * 2 * (10 / 16));
    return { captured: captured!, box: computeFrameBox(scn, 1400, 1400, 2, 700 * 2, 700 * 2 * (10 / 16)) };
  }

  it("centers the media for zero offset and zoom 1", () => {
    const { captured, box } = renderAndCapture();
    const expectedDx = box.innerX + (box.innerW - captured.dw) / 2;
    const expectedDy = box.innerY + (box.innerH - captured.dh) / 2;
    expect(captured.dx).toBeCloseTo(expectedDx, 3);
    expect(captured.dy).toBeCloseTo(expectedDy, 3);
    // cover scale: the wider media is fit by height, so it overflows width
    expect(captured.dw).toBeGreaterThan(box.innerW);
  });

  it("matches the preview object-position 75% for offsetX 0.5", () => {
    // The preview uses `object-position: 50% + offset * 50%`, i.e. 75% at
    // offset 0.5, which places the media's left edge at
    // `innerX + 0.75 * (innerW - dw)`. The export must land on the same px.
    const { captured, box } = renderAndCapture({ mediaOffsetX: 0.5 });
    const expectedDx = box.innerX + 0.75 * (box.innerW - captured.dw);
    expect(captured.dx).toBeCloseTo(expectedDx, 3);
  });

  it("scales the media by zoom without changing the frame box", () => {
    const base = renderAndCapture({ zoom: 1 });
    const zoomed = renderAndCapture({ zoom: 1.5 });
    expect(zoomed.captured.dw).toBeCloseTo(base.captured.dw * 1.5, 3);
    expect(zoomed.captured.dh).toBeCloseTo(base.captured.dh * 1.5, 3);
    // Frame geometry is untouched by zoom.
    expect(zoomed.box.width).toBeCloseTo(base.box.width, 5);
  });
});
