import { describe, expect, it, vi } from "vitest";
import { renderMockupToCanvas } from "@/lib/render/renderMockup";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";

// The real `canvasFactory` creates OffscreenCanvas / real canvas elements whose
// 2D context is unavailable in Node. Mock it so the offscreen buffers used by
// `drawTiltedFrame` and `paintFloorReflection` get a working fake context and
// the full draw path (not just the early-return) is exercised.
vi.mock("@/lib/render/canvasFactory", () => {
  const baseMethods = () => ({
    clearRect() {},
    fillRect() {},
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    closePath() {},
    clip() {},
    fill() {},
    stroke() {},
    arc() {},
    rect() {},
    ellipse() {},
    strokeRect() {},
    fillText() {},
    drawImage() {},
    translate() {},
    rotate() {},
    transform() {},
    setTransform() {},
    scale() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: () => ({ width: 10 })
  });
  const makeCtx = (canvas: { width: number; height: number }) => {
    const target: Record<string, unknown> = baseMethods();
    target.canvas = canvas;
    return new Proxy(target, {
      get(t, p) {
        return p in t ? (t as Record<string | symbol, unknown>)[p] : "";
      },
      set() {
        return true;
      }
    });
  };
  return {
    createLayerCanvas: (w: number, h: number) => {
      const canvas = { width: w, height: h, getContext: () => makeCtx(canvas) };
      return canvas as unknown as HTMLCanvasElement;
    },
    layerContext: (c: { getContext: (s: string) => unknown }) => c.getContext("2d") as CanvasRenderingContext2D
  };
});

function spyCtx() {
  const drawImage = vi.fn();
  const rotate = vi.fn();
  const fillText = vi.fn();
  const canvas = { width: 0, height: 0 };
  const target: Record<string, unknown> = {
    ...{
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      rect: vi.fn(),
      ellipse: vi.fn(),
      strokeRect: vi.fn(),
      translate: vi.fn(),
      transform: vi.fn(),
      setTransform: vi.fn(),
      scale: vi.fn(),
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      measureText: () => ({ width: 10 })
    },
    drawImage,
    rotate,
    fillText,
    canvas
  };
  const proxy = new Proxy(target, {
    get(t, p) {
      return p in t ? (t as Record<string | symbol, unknown>)[p] : "";
    },
    set() {
      return true;
    }
  });
  return { ctx: proxy, drawImage, rotate, fillText };
}

const fakeCanvas = (ctx: unknown, width = 800, height = 600) =>
  ({ width, height, getContext: () => ctx } as unknown as HTMLCanvasElement);

describe("renderMockupToCanvas tilt", () => {
  it("uses drawTiltedFrame for a tilted single frame", async () => {
    const tilt = await import("@/lib/render/tilt");
    const spy = vi.spyOn(tilt, "drawTiltedQuad");
    const { ctx } = spyCtx();
    const scn = { ...initialScene, frame: "none", tiltX: 12, tiltY: 6, layers: [] } as EditorScene;
    renderMockupToCanvas(fakeCanvas(ctx), scn, null, undefined, undefined, 400, 300, 2);
    expect(spy).toHaveBeenCalled();
  });

  it("uses drawTiltedFrame for a tilted multi-frame scene", async () => {
    const tilt = await import("@/lib/render/tilt");
    const spy = vi.spyOn(tilt, "drawTiltedQuad");
    const { ctx } = spyCtx();
    const scn = {
      ...initialScene,
      tiltX: 8,
      tiltY: -4,
      frameInstances: [{ id: "f1", frame: "none" as const, x: 0.5, y: 0.5, scale: 1, layerId: null }]
    } as EditorScene;
    renderMockupToCanvas(fakeCanvas(ctx, 1000, 800), scn, null);
    expect(spy).toHaveBeenCalled();
  });
});

describe("renderMockupToCanvas floor reflection", () => {
  it("composites a reflection layer for a single frame", () => {
    const { ctx, drawImage } = spyCtx();
    const scn = { ...initialScene, frame: "none", floorReflection: true, layers: [] } as EditorScene;
    renderMockupToCanvas(fakeCanvas(ctx), scn, null, undefined, undefined, 400, 300, 2);
    expect(drawImage).toHaveBeenCalled();
    // The reflection buffer (an offscreen canvas) is drawn onto the main ctx.
    const usedCanvas = drawImage.mock.calls.some(([img]) => !!img && typeof (img as { getContext?: unknown }).getContext === "function");
    expect(usedCanvas).toBe(true);
  });

  it("composites a reflection layer for a multi-frame scene", () => {
    const { ctx, drawImage } = spyCtx();
    const scn = {
      ...initialScene,
      floorReflection: true,
      frameInstances: [{ id: "f1", frame: "none" as const, x: 0.5, y: 0.5, scale: 1, layerId: null }]
    } as EditorScene;
    renderMockupToCanvas(fakeCanvas(ctx, 1000, 800), scn, null);
    expect(drawImage).toHaveBeenCalled();
    const usedCanvas = drawImage.mock.calls.some(([img]) => !!img && typeof (img as { getContext?: unknown }).getContext === "function");
    expect(usedCanvas).toBe(true);
  });

  it("draws tilted reflections when both tilt and floorReflection are on", async () => {
    const tilt = await import("@/lib/render/tilt");
    const drawTiltedSpy = vi.spyOn(tilt, "drawTiltedQuad");
    const { ctx } = spyCtx();
    const scn = { ...initialScene, frame: "none", tiltX: 10, tiltY: 5, floorReflection: true, layers: [] } as EditorScene;
    renderMockupToCanvas(fakeCanvas(ctx), scn, null, undefined, undefined, 400, 300, 2);
    expect(drawTiltedSpy).toHaveBeenCalled();
  });

  it("draws tilted reflections for tilted multi-frame scenes", async () => {
    const tilt = await import("@/lib/render/tilt");
    const drawTiltedSpy = vi.spyOn(tilt, "drawTiltedQuad");
    const { ctx } = spyCtx();
    const scn = {
      ...initialScene,
      tiltX: 10,
      tiltY: 5,
      floorReflection: true,
      frameInstances: [{ id: "f1", frame: "none" as const, x: 0.5, y: 0.5, scale: 1, layerId: null }]
    } as EditorScene;
    renderMockupToCanvas(fakeCanvas(ctx, 1000, 800), scn, null);
    expect(drawTiltedSpy).toHaveBeenCalled();
  });
});

describe("renderMockupToCanvas instance rotation", () => {
  it("rotates landscape frame instances around the box center", () => {
    const { ctx, rotate } = spyCtx();
    const scn = {
      ...initialScene,
      frameInstances: [{ id: "f1", frame: "none" as const, x: 0.5, y: 0.5, scale: 1, layerId: null, orientation: "landscape" as const }]
    } as EditorScene;
    renderMockupToCanvas(fakeCanvas(ctx, 1000, 800), scn, null);
    expect(rotate).toHaveBeenCalled();
  });
});

describe("renderMockupToCanvas per-instance media and overlays", () => {
  it("reads media and overlay from the layer maps for an instance", () => {
    const media = { naturalWidth: 100, naturalHeight: 100 } as unknown as CanvasImageSource;
    const overlay = { naturalWidth: 100, naturalHeight: 100 } as unknown as CanvasImageSource;
    const layerMedias = new Map<string, CanvasImageSource | null>([["L1", media]]);
    const frameOverlays = new Map<string, CanvasImageSource | null>([["L1", overlay]]);
    const { ctx, drawImage } = spyCtx();
    const scn = {
      ...initialScene,
      layers: [{ ...initialScene.layers[0]!, id: "L1" }],
      activeLayerId: "L1",
      frameInstances: [{ id: "f1", frame: "macbook" as const, x: 0.5, y: 0.5, scale: 1, layerId: "L1" }]
    } as EditorScene;
    renderMockupToCanvas(
      fakeCanvas(ctx, 1000, 800),
      scn,
      null,
      undefined,
      undefined,
      400,
      400,
      2,
      undefined,
      undefined,
      undefined,
      undefined,
      layerMedias,
      frameOverlays
    );
    expect(drawImage).toHaveBeenCalled();
  });
});

describe("renderMockupToCanvas active layer fallback", () => {
  it("falls back to the first layer when activeLayerId is null", () => {
    const { ctx } = spyCtx();
    const scn = {
      ...initialScene,
      layers: [{ ...initialScene.layers[0]!, id: "A" }],
      activeLayerId: "A"
    } as EditorScene;
    // Pass an explicit null activeLayerId so the `?? scene.layers[0]` fallback runs.
    expect(() =>
      renderMockupToCanvas(fakeCanvas(ctx), scn, null, undefined, undefined, 400, 300, 2, undefined, undefined, undefined, undefined, undefined, undefined, null)
    ).not.toThrow();
  });
});

describe("renderMockupToCanvas single-frame watermark", () => {
  it("draws the watermark in single-frame mode when enabled", () => {
    const { ctx, fillText } = spyCtx();
    const scn = {
      ...initialScene,
      frame: "none",
      watermarkEnabled: true,
      watermarkText: "Mocksy",
      watermarkPosition: "top-left" as const,
      watermarkSize: 16,
      layers: []
    } as EditorScene;
    renderMockupToCanvas(fakeCanvas(ctx), scn, null, undefined, undefined, 400, 300, 2);
    expect(fillText).toHaveBeenCalledWith("Mocksy", expect.any(Number), expect.any(Number));
  });

  it("still renders when the watermark has an image but no text", () => {
    const { ctx } = spyCtx();
    const scn = {
      ...initialScene,
      frame: "none",
      watermarkEnabled: true,
      watermarkText: "",
      watermarkImageUrl: "data:image/png;base64,x",
      layers: []
    } as EditorScene;
    expect(() => renderMockupToCanvas(fakeCanvas(ctx), scn, null, undefined, undefined, 400, 300, 2)).not.toThrow();
  });
});

describe("renderMockupToCanvas remaining branch coverage", () => {
  it("draws annotations in multi-frame mode", () => {
    const { ctx } = spyCtx();
    const scn = {
      ...initialScene,
      frameInstances: [{ id: "f1", frame: "none" as const, x: 0.5, y: 0.5, scale: 1, layerId: null }],
      annotations: [
        { id: "a1", type: "rect" as const, x: 0.1, y: 0.1, w: 0.3, h: 0.1, text: "", color: "#00ff00", strokeWidth: 2, fontSize: 12 }
      ]
    } as EditorScene;
    renderMockupToCanvas(fakeCanvas(ctx, 1000, 800), scn, null);
    expect(ctx.strokeRect).toHaveBeenCalled();
  });

  it("uses the instance layer's own zoom for non-active instances", () => {
    const { ctx, drawImage } = spyCtx();
    const media = { naturalWidth: 100, naturalHeight: 100 } as unknown as CanvasImageSource;
    const scn = {
      ...initialScene,
      activeLayerId: "active",
      layers: [
        { ...initialScene.layers[0]!, id: "active", zoom: 2 },
        { id: "other", zoom: 3 } as unknown as MediaLayer
      ],
      frameInstances: [{ id: "f1", frame: "none" as const, x: 0.5, y: 0.5, scale: 1, layerId: "other" }]
    } as EditorScene;
    renderMockupToCanvas(fakeCanvas(ctx, 1000, 800), scn, media, undefined, undefined, 400, 400, 2, { zoom: 1.5, offsetX: 0, offsetY: 0 } as never);
    expect(drawImage).toHaveBeenCalled();
  });

  it("applies the render transform zoom to active multi-frame instances", () => {
    const { ctx, drawImage } = spyCtx();
    const scn = {
      ...initialScene,
      activeLayerId: "active",
      layers: [{ ...initialScene.layers[0]!, id: "active", zoom: 2 }],
      frameInstances: [{ id: "f1", frame: "none" as const, x: 0.5, y: 0.5, scale: 1, layerId: "active" }]
    } as EditorScene;
    renderMockupToCanvas(fakeCanvas(ctx, 1000, 800), scn, null, undefined, undefined, 400, 400, 2, { zoom: 1.5, offsetX: 0, offsetY: 0 } as never);
    expect(drawImage).toHaveBeenCalled();
  });

  it("falls back to the passed media when an instance resolves to no layer", () => {
    const { ctx, drawImage } = spyCtx();
    const media = { naturalWidth: 100, naturalHeight: 100 } as unknown as CanvasImageSource;
    const scn = {
      ...initialScene,
      layers: [],
      activeLayerId: null,
      frameInstances: [{ id: "f1", frame: "none" as const, x: 0.5, y: 0.5, scale: 1, layerId: null }]
    } as EditorScene;
    renderMockupToCanvas(fakeCanvas(ctx, 1000, 800), scn, media);
    expect(drawImage).toHaveBeenCalled();
  });
});
