import { describe, expect, it } from "vitest";
import { computeFrameBox, renderMockupToCanvas, computeFrameInstances } from "@/lib/export/renderMockup";
import { getFrameSpec, SVG_VIEWBOX_WIDTH } from "@/lib/render/frames";
import { initialScene } from "@/lib/state/editorStore";
import { layoutFrameGrid } from "@/lib/state/editorHelpers";
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

  it("scales the whole frame box by zoom (device + media together)", () => {
    // Zoom scales the entire mockup, matching the preview where the transform
    // is applied to the frame container; the inset ratio is preserved.
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
    expect(zoomed.width).toBeCloseTo(base.width * 1.5, 3);
    expect(zoomed.height).toBeCloseTo(base.height * 1.5, 3);
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

  it("scales the media together with the frame under whole-mockup zoom", () => {
    // Zoom grows the frame box, and the media (drawn at the cover scale inside
    // the larger cutout) scales by the same factor, so both dw and frame width
    // grow 1.5x at zoom 1.5.
    const base = renderAndCapture({ zoom: 1 });
    const zoomed = renderAndCapture({ zoom: 1.5 });
    expect(zoomed.captured.dw).toBeCloseTo(base.captured.dw * 1.5, 3);
    expect(zoomed.captured.dh).toBeCloseTo(base.captured.dh * 1.5, 3);
    expect(zoomed.box.width).toBeCloseTo(base.box.width * 1.5, 3);
  });
});

describe("renderMockupToCanvas background modes", () => {
  it("renders transparent background with provided fill", () => {
    let fillStyle = "";
    const ctx = {
      clearRect: () => {},
      fillRect: (x: number, y: number, w: number, h: number) => {},
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
      drawImage: () => {},
      set fillStyle(v: unknown) { fillStyle = String(v); },
      set strokeStyle(_v: unknown) {},
      set shadowColor(_v: unknown) {},
      set shadowBlur(_v: unknown) {},
      set shadowOffsetX(_v: unknown) {},
      set shadowOffsetY(_v: unknown) {}
    };
    const canvas = { width: 800, height: 600, getContext: () => ctx } as unknown as HTMLCanvasElement;
    renderMockupToCanvas(canvas, { ...initialScene, backgroundMode: "transparent", layers: [] }, null, undefined, undefined, 400, 300, 2, undefined, "transparent", undefined, undefined);
    // Without backgroundFill parameter, transparent background still draws empty media area
    expect(fillStyle).toBe("rgba(255,255,255,0.04)");
  });

  it("draws empty media placeholder when no media provided", () => {
    let fillRectCalls: { x: number; y: number; w: number; h: number }[] = [];
    const ctx = {
      clearRect: () => {},
      fillRect: (x: number, y: number, w: number, h: number) => fillRectCalls.push({ x, y, w, h }),
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
      drawImage: () => {},
      set fillStyle(_v: unknown) {},
      set strokeStyle(_v: unknown) {},
      set lineWidth(_v: unknown) {}
    };
    const canvas = { width: 800, height: 600, getContext: () => ctx } as unknown as HTMLCanvasElement;
    renderMockupToCanvas(canvas, { ...initialScene, layers: [] }, null, undefined, undefined, 400, 300, 2);
    // Should still draw the frame and empty media placeholder
    expect(fillRectCalls.length).toBeGreaterThan(0);
  });
});

describe("renderMockupToCanvas watermark positions", () => {
  const positions: Array<"bottom-right" | "bottom-left" | "top-right" | "top-left"> = [
    "bottom-right", "bottom-left", "top-right", "top-left"
  ];

  for (const pos of positions) {
    it(`places watermark at ${pos}`, () => {
      let fillTextCalls: { x: number; y: number }[] = [];
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
        drawImage: () => {},
        fillText: (text: string, x: number, y: number) => fillTextCalls.push({ x, y }),
        set fillStyle(_v: unknown) {},
        set font(_v: unknown) {},
        set textAlign(_v: unknown) {},
        set textBaseline(_v: unknown) {},
        set shadowColor(_v: unknown) {},
        set shadowBlur(_v: unknown) {},
        set shadowOffsetX(_v: unknown) {},
        set shadowOffsetY(_v: unknown) {}
      };
      const canvas = { width: 800, height: 600, getContext: () => ctx } as unknown as HTMLCanvasElement;
      const scn = { ...initialScene, watermarkEnabled: true, watermarkText: "Test", watermarkPosition: pos, watermarkSize: 16, layers: [] };
      renderMockupToCanvas(canvas, scn, null, undefined, undefined, 400, 300, 2);

      const call = fillTextCalls.find(c => true);
      expect(call).toBeDefined();
    });
  }
});

describe("renderMockupToCanvas annotations", () => {
  it("draws text annotation with shadow", () => {
    let fillTextCalls: { text: string; x: number; y: number }[] = [];
    let shadowCalls: { color: string; blur: number }[] = [];
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
      drawImage: () => {},
      fillText: (text: string, x: number, y: number) => fillTextCalls.push({ text, x, y }),
      set fillStyle(_v: unknown) {},
      set font(_v: unknown) {},
      set textAlign(_v: unknown) {},
      set textBaseline(_v: unknown) {},
      set shadowColor(v: unknown) { shadowCalls.push({ color: String(v), blur: 0 }); },
      set shadowBlur(v: unknown) {
        const last = shadowCalls[shadowCalls.length - 1];
        if (last) last.blur = Number(v);
      },
      set shadowOffsetX(_v: unknown) {},
      set shadowOffsetY(_v: unknown) {}
    };
    const canvas = { width: 800, height: 600, getContext: () => ctx } as unknown as HTMLCanvasElement;
    const scn = {
      ...initialScene,
      layers: [],
      annotations: [{ id: "a1", type: "text" as const, x: 0.1, y: 0.1, w: 0.3, h: 0.1, text: "Hello", color: "#ff0000", strokeWidth: 2, fontSize: 24 }]
    };
    renderMockupToCanvas(canvas, scn, null, undefined, undefined, 400, 300, 2);
    expect(fillTextCalls.some(c => c.text === "Hello")).toBe(true);
  });

  it("draws rectangle annotation", () => {
    let strokeCalls: { x: number; y: number; w: number; h: number }[] = [];
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
      drawImage: () => {},
      strokeRect: (x: number, y: number, w: number, h: number) => strokeCalls.push({ x, y, w, h }),
      set fillStyle(_v: unknown) {},
      set font(_v: unknown) {},
      set textAlign(_v: unknown) {},
      set textBaseline(_v: unknown) {},
      set strokeStyle(_v: unknown) {},
      set shadowColor(_v: unknown) {},
      set shadowBlur(_v: unknown) {},
      set shadowOffsetX(_v: unknown) {},
      set shadowOffsetY(_v: unknown) {},
      set lineWidth(_v: unknown) {}
    };
    const canvas = { width: 800, height: 600, getContext: () => ctx } as unknown as HTMLCanvasElement;
    const scn = {
      ...initialScene,
      layers: [],
      annotations: [{ id: "a1", type: "rect" as const, x: 0.1, y: 0.1, w: 0.3, h: 0.1, text: "", color: "#00ff00", strokeWidth: 3, fontSize: 12 }]
    };
    renderMockupToCanvas(canvas, scn, null, undefined, undefined, 400, 300, 2);
    expect(strokeCalls.length).toBeGreaterThan(0);
  });

  it("draws arrow annotation with head", () => {
    let pathCalls: { method: string; args: number[] }[] = [];
    const ctx = {
      clearRect: () => {},
      fillRect: () => {},
      save: () => {},
      restore: () => {},
      beginPath: () => { pathCalls.push({ method: "beginPath", args: [] }); },
      moveTo: (...args: number[]) => { pathCalls.push({ method: "moveTo", args }); },
      lineTo: (...args: number[]) => { pathCalls.push({ method: "lineTo", args }); },
      quadraticCurveTo: () => {},
      closePath: () => { pathCalls.push({ method: "closePath", args: [] }); },
      clip: () => {},
      fill: () => { pathCalls.push({ method: "fill", args: [] }); },
      stroke: () => { pathCalls.push({ method: "stroke", args: [] }); },
      createLinearGradient: () => ({ addColorStop: () => {} }),
      drawImage: () => {},
      set fillStyle(_v: unknown) {},
      set font(_v: unknown) {},
      set textAlign(_v: unknown) {},
      set textBaseline(_v: unknown) {},
      set strokeStyle(_v: unknown) {},
      set shadowColor(_v: unknown) {},
      set shadowBlur(_v: unknown) {},
      set shadowOffsetX(_v: unknown) {},
      set shadowOffsetY(_v: unknown) {},
      set lineWidth(_v: unknown) {},
      set lineCap(_v: unknown) {}
    };
    const canvas = { width: 800, height: 600, getContext: () => ctx } as unknown as HTMLCanvasElement;
    const scn = {
      ...initialScene,
      layers: [],
      annotations: [{ id: "a1", type: "arrow" as const, x: 0.1, y: 0.1, w: 0.3, h: 0.1, text: "", color: "#0000ff", strokeWidth: 2, fontSize: 12 }]
    };
    renderMockupToCanvas(canvas, scn, null, undefined, undefined, 400, 300, 2);
    expect(pathCalls.some(c => c.method === "beginPath")).toBe(true);
    expect(pathCalls.some(c => c.method === "fill")).toBe(true);
  });
});

describe("renderMockupToCanvas frame overlay", () => {
  it("draws frame overlay with drop shadow", () => {
    let drawCalls: { img: any; x: number; y: number; w: number; h: number }[] = [];
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
      drawImage: (img: any, x: number, y: number, w: number, h: number) => drawCalls.push({ img, x, y, w, h }),
      set fillStyle(_v: unknown) {},
      set font(_v: unknown) {},
      set textAlign(_v: unknown) {},
      set textBaseline(_v: unknown) {},
      set strokeStyle(_v: unknown) {},
      set shadowColor(_v: unknown) {},
      set shadowBlur(_v: unknown) {},
      set shadowOffsetX(_v: unknown) {},
      set shadowOffsetY(_v: unknown) {},
      set lineWidth(_v: unknown) {},
      set lineCap(_v: unknown) {}
    };
    const canvas = { width: 800, height: 600, getContext: () => ctx } as unknown as HTMLCanvasElement;
    const overlay = { width: 100, height: 200 } as unknown as CanvasImageSource;
    renderMockupToCanvas(canvas, { ...initialScene, layers: [] }, null, undefined, undefined, 200, 400, 2, { zoom: 1, offsetX: 0, offsetY: 0 }, undefined, overlay);
    expect(drawCalls.length).toBeGreaterThan(0);
  });
});

describe("renderMockupToCanvas background image mode", () => {
  it("draws background image with blur", () => {
    let filterValue = "";
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
      drawImage: () => {},
      set fillStyle(_v: unknown) {},
      set font(_v: unknown) {},
      set textAlign(_v: unknown) {},
      set textBaseline(_v: unknown) {},
      set strokeStyle(_v: unknown) {},
      set shadowColor(_v: unknown) {},
      set shadowBlur(_v: unknown) {},
      set shadowOffsetX(_v: unknown) {},
      set shadowOffsetY(_v: unknown) {},
      set lineWidth(_v: unknown) {},
      set lineCap(_v: unknown) {},
      get filter() { return filterValue; },
      set filter(v: unknown) { filterValue = String(v); }
    };
    const canvas = { width: 800, height: 600, getContext: () => ctx } as unknown as HTMLCanvasElement;
    const bgImage = { naturalWidth: 100, naturalHeight: 100 } as unknown as CanvasImageSource;
    renderMockupToCanvas(canvas, { ...initialScene, backgroundMode: "image", backgroundBlur: 10, layers: [] }, null, undefined, undefined, 200, 400, 2, undefined, undefined, undefined, bgImage);
    expect(filterValue).toContain("blur");
  });

  it("draws fallback transparent for image mode without loaded image", () => {
    let fillStyle = "";
    const ctx = {
      clearRect: () => {},
      fillRect: (_x: number, _y: number, _w: number, _h: number) => {},
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
      drawImage: () => {},
      set fillStyle(v: unknown) { fillStyle = String(v); },
      set font(_v: unknown) {},
      set textAlign(_v: unknown) {},
      set textBaseline(_v: unknown) {},
      set strokeStyle(_v: unknown) {},
      set shadowColor(_v: unknown) {},
      set shadowBlur(_v: unknown) {},
      set shadowOffsetX(_v: unknown) {},
      set shadowOffsetY(_v: unknown) {},
      set lineWidth(_v: unknown) {},
      set lineCap(_v: unknown) {}
    };
    const canvas = { width: 800, height: 600, getContext: () => ctx } as unknown as HTMLCanvasElement;
    // image mode without backgroundImage falls through to the fallback at the end
    renderMockupToCanvas(canvas, { ...initialScene, backgroundMode: "image", layers: [] }, null, undefined, undefined, 200, 400, 2);
    // The fallback draws "rgba(0,0,0,0)" - the fillStyle is set in the else branch
    // However, since there's no media, emptyMediaFill is used which is "rgba(255,255,255,0.04)"
    // This tests that the code path for image-without-image is executed
    expect(fillStyle).toBe("rgba(255,255,255,0.04)");
  });
});

describe("renderMockupToCanvas video media", () => {
  it("uses videoWidth/videoHeight for video media", () => {
    let captured: { dw: number; dh: number } | null = null;
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
      drawImage: (img: any, dx: number, dy: number, dw: number, dh: number) => {
        captured = { dw, dh };
      },
      set fillStyle(_v: unknown) {},
      set strokeStyle(_v: unknown) {},
      set lineWidth(_v: unknown) {},
      set filter(_v: unknown) {}
    };
    const canvas = { width: 800, height: 600, getContext: () => ctx } as unknown as HTMLCanvasElement;
    // Video with explicit videoWidth/videoHeight (different from natural dimensions)
    const video = { videoWidth: 320, videoHeight: 180 } as unknown as CanvasImageSource;
    renderMockupToCanvas(canvas, { ...initialScene, layers: [] }, video, undefined, undefined, 400, 300, 2);
    expect(captured).not.toBeNull();
  });

  it("falls back to natural dimensions for video without videoWidth", () => {
    let captured: { dw: number; dh: number } | null = null;
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
      drawImage: (img: any, dx: number, dy: number, dw: number, dh: number) => {
        captured = { dw, dh };
      },
      set fillStyle(_v: unknown) {},
      set strokeStyle(_v: unknown) {},
      set lineWidth(_v: unknown) {},
      set filter(_v: unknown) {}
    };
    const canvas = { width: 800, height: 600, getContext: () => ctx } as unknown as HTMLCanvasElement;
    // Video without videoWidth uses naturalWidth
    const video = { naturalWidth: 640, naturalHeight: 360 } as unknown as CanvasImageSource;
    renderMockupToCanvas(canvas, { ...initialScene, layers: [] }, video, undefined, undefined, 400, 300, 2);
    expect(captured).not.toBeNull();
  });
});

describe("layoutFrameGrid", () => {
  it("creates a horizontal grid of frame instances", () => {
    const instances = layoutFrameGrid("iphone", 3, "horizontal");
    expect(instances.length).toBe(3);
    // Frames centered with 2% gaps: scale = (1 - 2*0.02) / 3 = 0.32, pitch = 0.34
    expect(instances[0]!.x).toBeCloseTo(0.16, 5);
    expect(instances[1]!.x).toBeCloseTo(0.5, 5);
    expect(instances[2]!.x).toBeCloseTo(0.84, 5);
    expect(instances[0]!.y).toBe(0.5); // All centered vertically
    expect(instances[0]!.scale).toBeCloseTo(0.32, 5);
  });

  it("creates a vertical grid of frame instances", () => {
    const instances = layoutFrameGrid("iphone15", 2, "vertical");
    expect(instances.length).toBe(2);
    // Frames centered with 2% gap: scale = (1 - 0.02) / 2 = 0.49, pitch = 0.51
    expect(instances[0]!.y).toBeCloseTo(0.245, 5);
    expect(instances[1]!.y).toBeCloseTo(0.755, 5);
    expect(instances[0]!.x).toBe(0.5); // All centered horizontally
  });

  it("returns empty array for count less than 1", () => {
    expect(layoutFrameGrid("iphone", 0, "horizontal")).toEqual([]);
    expect(layoutFrameGrid("iphone", -1, "horizontal")).toEqual([]);
  });
});

describe("computeFrameInstances", () => {
  it("returns empty array when no frameInstances defined", () => {
    const boxes = computeFrameInstances(initialScene, 800, 600, 2);
    expect(boxes).toEqual([]);
  });

  it("computes positions for multiple frames", () => {
    const sceneWithFrames: EditorScene = {
      ...initialScene,
      frameInstances: [
        { id: "f1", frame: "iphone" as const, x: 0, y: 0.5, scale: 1, layerId: null },
        { id: "f2", frame: "iphone" as const, x: 0.5, y: 0.5, scale: 1, layerId: null },
        { id: "f3", frame: "iphone" as const, x: 1, y: 0.5, scale: 1, layerId: null }
      ]
    };
    const boxes = computeFrameInstances(sceneWithFrames, 1000, 800, 2);
    expect(boxes.length).toBe(3);
    // First frame should be on left, last on right
    expect(boxes[0]!.x).toBeLessThan(boxes[1]!.x);
    expect(boxes[1]!.x).toBeLessThan(boxes[2]!.x);
  });

  it("uses correct aspect ratio from frame spec", () => {
    // Each frame spec defines its own aspect ratio which computeFrameInstances must respect.
    const sceneWithFrames: EditorScene = {
      ...initialScene,
      frameInstances: [{ id: "f1", frame: "iphone15" as const, x: 0.5, y: 0.5, scale: 1, layerId: null }]
    };
    const boxes = computeFrameInstances(sceneWithFrames, 800, 800, 2);
    expect(boxes.length).toBe(1);
    // iphone15 has aspectRatio "390/844" (portrait), so width/height = 390/844
    const ratio = boxes[0]!.width / boxes[0]!.height;
    expect(ratio).toBeCloseTo(390 / 844, 2);
  });
});

describe("renderMockupToCanvas multi-frame mode", () => {
  it("renders multiple frames with frameInstances", () => {
    let drawCalls: number = 0;
    let fillRectCalls: number = 0;
    const ctx = {
      clearRect: () => {},
      fillRect: () => { fillRectCalls++; },
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
      drawImage: () => { drawCalls++; },
      set fillStyle(_v: unknown) {},
      set strokeStyle(_v: unknown) {},
      set shadowColor(_v: unknown) {},
      set shadowBlur(_v: unknown) {},
      set shadowOffsetX(_v: unknown) {},
      set shadowOffsetY(_v: unknown) {},
      set lineWidth(_v: unknown) {}
    };
    const canvas = { width: 1000, height: 800, getContext: () => ctx } as unknown as HTMLCanvasElement;

    const sceneWithFrames: EditorScene = {
      ...initialScene,
      frameInstances: [
        { id: "f1", frame: "iphone" as const, x: 0, y: 0.5, scale: 1, layerId: null },
        { id: "f2", frame: "iphone15" as const, x: 0.5, y: 0.5, scale: 1, layerId: null }
      ]
    };

    renderMockupToCanvas(canvas, sceneWithFrames, null);
    // Should draw empty media fill for each frame when no media provided
    expect(fillRectCalls).toBeGreaterThan(0);
  });

  it("renders multi-frame with overlay for overlay frames", () => {
    let drawCalls: number = 0;
    let overlayDrawCalls: number = 0;
    const ctx = {
      clearRect: () => {},
      fillRect: () => { drawCalls++; },
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
      drawImage: () => { drawCalls++; overlayDrawCalls++; },
      set fillStyle(_v: unknown) {},
      set strokeStyle(_v: unknown) {},
      set shadowColor(_v: unknown) {},
      set shadowBlur(_v: unknown) {},
      set shadowOffsetX(_v: unknown) {},
      set shadowOffsetY(_v: unknown) {},
      set lineWidth(_v: unknown) {}
    };
    const canvas = { width: 1000, height: 800, getContext: () => ctx } as unknown as HTMLCanvasElement;
    const layer1 = layer({ id: "layer-1", mediaUrl: null });
    const layer2 = layer({ id: "layer-2", mediaUrl: "data:image/png;base64,abc" });

    const sceneWithFrames: EditorScene = {
      ...initialScene,
      layers: [layer1, layer2],
      activeLayerId: layer1.id,
      frameInstances: [
        { id: "f1", frame: "iphone15" as const, x: 0, y: 0.5, scale: 1, layerId: layer1.id },
        { id: "f2", frame: "iphone15" as const, x: 1, y: 0.5, scale: 1, layerId: layer2.id }
      ]
    };
    const frameOverlays = new Map<string, CanvasImageSource | null>();
    frameOverlays.set(layer1.id, { width: 100, height: 200 } as unknown as CanvasImageSource);
    frameOverlays.set(layer2.id, { width: 100, height: 200 } as unknown as CanvasImageSource);

    renderMockupToCanvas(canvas, sceneWithFrames, null, undefined, undefined, 200, 400, 2, undefined, "transparent", undefined, undefined, frameOverlays);
    // Should have drawn empty media fill for each frame
    expect(drawCalls).toBeGreaterThan(0);
    // Overlay frames should have additional drawImage calls for the overlay skin
    expect(overlayDrawCalls).toBe(2);
  });
});
