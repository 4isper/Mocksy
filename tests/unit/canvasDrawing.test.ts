import { describe, expect, it, vi } from "vitest";
import { RENDER, roundedRectPath, drawAnnotations, drawWatermark, drawFrameAndMedia } from "@/lib/render/canvasDrawing";
import type { Annotation, EditorScene, MediaLayer } from "@/lib/types/editor";
import type { FrameBox } from "@/lib/render/frameGeometry";
import { getFrameSpec } from "@/lib/render/frames";
import { DEFAULT_SCREEN_CHROME } from "@/lib/state/editorScene";

function mockCtx(): CanvasRenderingContext2D {
  const state: Record<string, unknown> = {};
  const fillStyles: string[] = [];
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn(),
    fillText: vi.fn(),
    strokeRect: vi.fn(),
    translate: vi.fn(),
    measureText: (text: string) => ({ width: text.length * 10 }),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    set fillStyle(v: unknown) { fillStyles.push(String(v)); state.fillStyle = v; },
    get fillStyle() { return state.fillStyle; },
    /** Every fillStyle write, in order, so tests can assert intermediate paints. */
    _fillStyles: fillStyles,
    set strokeStyle(v: unknown) { state.strokeStyle = v; },
    get strokeStyle() { return state.strokeStyle; },
    set lineWidth(v: unknown) { state.lineWidth = v; },
    get lineWidth() { return state.lineWidth; },
    set font(v: unknown) { state.font = v; },
    get font() { return state.font; },
    set textAlign(v: unknown) { state.textAlign = v; },
    get textAlign() { return state.textAlign; },
    set textBaseline(v: unknown) { state.textBaseline = v; },
    get textBaseline() { return state.textBaseline; },
    set shadowColor(v: unknown) { state.shadowColor = v; },
    get shadowColor() { return state.shadowColor; },
    set shadowBlur(v: unknown) { state.shadowBlur = v; },
    get shadowBlur() { return state.shadowBlur; },
    set shadowOffsetX(v: unknown) { state.shadowOffsetX = v; },
    get shadowOffsetX() { return state.shadowOffsetX; },
    set shadowOffsetY(v: unknown) { state.shadowOffsetY = v; },
    get shadowOffsetY() { return state.shadowOffsetY; }
  } as unknown as CanvasRenderingContext2D;
}

function mediaLayer(overrides: Partial<MediaLayer> = {}): MediaLayer {
  return {
    id: "layer-test",
    mediaUrl: "",
    mediaType: "image",
    mediaName: null,
    hidden: false,
    mediaFit: "cover",
    mediaOffsetX: 0,
    mediaOffsetY: 0,
    zoom: 1,
    animationPreset: "none",
    videoMuted: false,
    videoLoop: false,
    videoAutoplay: false,
    videoPosterTime: 0,
    videoDuration: 0,
    videoTrimStart: 0,
    videoTrimEnd: 0,
    videoQuality: "high",
    ...overrides
  };
}

function scene(overrides: Partial<EditorScene> = {}): EditorScene {
  return {
    frame: "none",
    aspectRatio: "16 / 9",
    stylePreset: "default",
    borderRadius: 12,
    tiltX: 0,
    tiltY: 0,
    shadowOpacity: 0.3,
    watermarkEnabled: false,
    watermarkText: "",
    watermarkSize: 13,
    watermarkPosition: "bottom-right",
    watermarkImageUrl: null,
    layers: [mediaLayer()],
    activeLayerId: "layer-test",
    annotations: [],
    frameInstances: [],
    customFrame: null,
    backgroundMode: "solid",
    backgroundColor: "#09090b",
    backgroundImageUrl: null,
    backgroundBlur: 0,
    gradientFrom: "",
    gradientTo: "",
    gradientVia: null,
    gradientType: "linear",
    gradientAngle: 0,
    patternId: null,
    backgroundAudioUrl: null,
    backgroundAudioName: null,
    animationDurationMs: 3000,
    screen: { enabled: false, style: "lock", theme: "dark", showStatusBar: true, showClock: true, showDate: true, showDock: true, showHomeIndicator: true, time: "9:41", date: "Tuesday, August 4" },
    ...overrides
  };
}

describe("roundedRectPath", () => {
  it("draws a rectangle with rounded corners", () => {
    const ctx = mockCtx();
    roundedRectPath(ctx, 10, 10, 100, 80, 12);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledWith(22, 10);
    expect(ctx.lineTo).toHaveBeenCalledWith(98, 10);
    expect(ctx.quadraticCurveTo).toHaveBeenCalledWith(110, 10, 110, 22);
    expect(ctx.closePath).toHaveBeenCalled();
  });

  it("clamps radius to half the smallest dimension", () => {
    const ctx = mockCtx();
    roundedRectPath(ctx, 0, 0, 10, 10, 20);
    expect(ctx.quadraticCurveTo).toHaveBeenCalledWith(10, 0, 10, 5);
  });

  it("handles zero radius as a plain rectangle", () => {
    const ctx = mockCtx();
    roundedRectPath(ctx, 0, 0, 100, 80, 0);
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
    expect(ctx.lineTo).toHaveBeenCalledWith(100, 0);
  });

  it("handles negative radius by clamping to zero", () => {
    const ctx = mockCtx();
    roundedRectPath(ctx, 0, 0, 100, 80, -5);
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
  });

  it("draws the complete closed path", () => {
    const ctx = mockCtx();
    roundedRectPath(ctx, 0, 0, 100, 100, 10);
    expect(ctx.closePath).toHaveBeenCalled();
  });
});

describe("drawAnnotations", () => {
  it("draws text annotations with correct font and color", () => {
    const ctx = mockCtx();
    const annotations: Annotation[] = [
      { id: "a1", type: "text", x: 0.1, y: 0.1, w: 0.3, h: 0, text: "Hello", color: "#ff0000", strokeWidth: 0, fontSize: 16, fontFamily: "Inter" }
    ];
    drawAnnotations(ctx, annotations, 800, 600, 2);
    expect(ctx.fillText).toHaveBeenCalledWith("Hello", 80, 60);
    expect(ctx.fillStyle).toBe("#ff0000");
    expect(ctx.font).toBe("600 32px Inter");
    expect(ctx.textAlign).toBe("left");
  });

  it("applies italic weight and alignment to text annotations", () => {
    const ctx = mockCtx();
    const annotations: Annotation[] = [
      { id: "a1", type: "text", x: 0.1, y: 0.1, w: 0.3, h: 0, text: "Hi", color: "#000", strokeWidth: 0, fontSize: 16, fontWeight: "normal", fontStyle: "italic", textAlign: "center" }
    ];
    drawAnnotations(ctx, annotations, 800, 600, 2);
    expect(ctx.font).toBe("italic 400 32px Inter, system-ui, sans-serif");
    expect(ctx.textAlign).toBe("center");
    expect(ctx.fillText).toHaveBeenCalledWith("Hi", 80 + 240 / 2, 60);
  });

  it("right-aligns text at the box edge", () => {
    const ctx = mockCtx();
    const annotations: Annotation[] = [
      { id: "a1", type: "text", x: 0.1, y: 0.1, w: 0.3, h: 0, text: "Hi", color: "#000", strokeWidth: 0, fontSize: 16, textAlign: "right" }
    ];
    drawAnnotations(ctx, annotations, 800, 600, 2);
    expect(ctx.textAlign).toBe("right");
    expect(ctx.fillText).toHaveBeenCalledWith("Hi", 80 + 240, 60);
  });

  it("draws rectangle annotations with correct stroke", () => {
    const ctx = mockCtx();
    const annotations: Annotation[] = [
      { id: "a1", type: "rect", x: 0.2, y: 0.2, w: 0.3, h: 0.3, text: "", color: "#00ff00", strokeWidth: 2, fontSize: 0 }
    ];
    drawAnnotations(ctx, annotations, 800, 600, 2);
    expect(ctx.strokeStyle).toBe("#00ff00");
    expect(ctx.lineWidth).toBe(4);
    expect(ctx.strokeRect).toHaveBeenCalledWith(160, 120, 240, 180);
  });

  it("draws arrow annotations with correct line and head", () => {
    const ctx = mockCtx();
    const annotations: Annotation[] = [
      { id: "a1", type: "arrow", x: 0.1, y: 0.1, w: 0.2, h: 0.2, text: "", color: "#0000ff", strokeWidth: 1, fontSize: 0 }
    ];
    drawAnnotations(ctx, annotations, 800, 600, 2);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it("draws circle annotations with ellipse and stroke", () => {
    const ctx = mockCtx();
    const annotations: Annotation[] = [
      { id: "a1", type: "circle", x: 0.2, y: 0.2, w: 0.3, h: 0.3, text: "", color: "#00ff00", strokeWidth: 2, fontSize: 0 }
    ];
    drawAnnotations(ctx, annotations, 800, 600, 2);
    expect(ctx.ellipse).toHaveBeenCalledWith(280, 210, 120, 90, 0, 0, Math.PI * 2);
    expect(ctx.strokeStyle).toBe("#00ff00");
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("scales circle strokeWidth by dpiScale", () => {
    const ctx = mockCtx();
    const annotations: Annotation[] = [
      { id: "a1", type: "circle", x: 0.1, y: 0.1, w: 0.3, h: 0.3, text: "", color: "#000", strokeWidth: 0.5, fontSize: 0 }
    ];
    drawAnnotations(ctx, annotations, 800, 600, 2);
    expect(ctx.lineWidth).toBe(1);
  });

  it("draws a rounded background box behind text when bgColor is set", () => {
    const ctx = mockCtx();
    const annotations: Annotation[] = [
      { id: "a1", type: "text", x: 0.1, y: 0.1, w: 0.3, h: 0, text: "Hello", color: "#000", strokeWidth: 0, fontSize: 16, fontFamily: "Inter", bgColor: "rgba(0,0,0,0.5)", bgPadding: 4, bgRadius: 6 }
    ];
    drawAnnotations(ctx, annotations, 800, 600, 2);
    // textWidth 50 (5 chars), padding 8 and radius 12 at dpr 2; box hugs the text.
    expect(ctx.moveTo).toHaveBeenCalledWith(80 - 8 + 12, 60 - 8);
    expect(ctx.quadraticCurveTo).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect((ctx as any)._fillStyles).toContain("rgba(0,0,0,0.5)");
    // Foreground color is restored after the box so the text keeps its color.
    expect(ctx.fillStyle).toBe("#000");
  });

  it("scales background padding and radius by dpiScale", () => {
    const ctx = mockCtx();
    const annotations: Annotation[] = [
      { id: "a1", type: "text", x: 0.1, y: 0.1, w: 0.3, h: 0, text: "Hi", color: "#000", strokeWidth: 0, fontSize: 16, fontFamily: "Inter", bgColor: "#111", bgPadding: 4, bgRadius: 2 }
    ];
    drawAnnotations(ctx, annotations, 800, 600, 3);
    expect(ctx.moveTo).toHaveBeenCalledWith(80 - 12 + 6, 60 - 12);
  });

  it("handles multi-line text annotations", () => {
    const ctx = mockCtx();
    const annotations: Annotation[] = [
      { id: "a1", type: "text", x: 0.1, y: 0.1, w: 0.3, h: 0, text: "Line 1\nLine 2", color: "#000", strokeWidth: 0, fontSize: 16, fontFamily: "Inter" }
    ];
    drawAnnotations(ctx, annotations, 800, 600, 2);
    expect(ctx.fillText).toHaveBeenCalledTimes(2);
  });

  it("returns early for empty annotations array", () => {
    const ctx = mockCtx();
    drawAnnotations(ctx, [], 800, 600, 2);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it("applies shadow for text annotations", () => {
    const ctx = mockCtx();
    const annotations: Annotation[] = [
      { id: "a1", type: "text", x: 0.1, y: 0.1, w: 0.3, h: 0, text: "Test", color: "#000", strokeWidth: 0, fontSize: 16, fontFamily: "Inter" }
    ];
    drawAnnotations(ctx, annotations, 800, 600, 2);
    expect(ctx.shadowColor).toBe("rgba(0,0,0,0.5)");
  });

  it("scales font size and shadow by dpiScale", () => {
    const ctx = mockCtx();
    const annotations: Annotation[] = [
      { id: "a1", type: "text", x: 0.1, y: 0.1, w: 0.3, h: 0, text: "Test", color: "#000", strokeWidth: 0, fontSize: 16, fontFamily: "Inter" }
    ];
    drawAnnotations(ctx, annotations, 800, 600, 3);
    expect(ctx.font).toContain("48px");
    expect(ctx.shadowBlur).toBe(9);
  });

  it("scales strokeWidth by dpiScale for rect annotations", () => {
    const ctx = mockCtx();
    const annotations: Annotation[] = [
      { id: "a1", type: "rect", x: 0.1, y: 0.1, w: 0.3, h: 0.3, text: "", color: "#000", strokeWidth: 0.5, fontSize: 0 }
    ];
    drawAnnotations(ctx, annotations, 800, 600, 2);
    expect(ctx.lineWidth).toBe(1);
  });

  it("scales strokeWidth by dpiScale for arrow annotations", () => {
    const ctx = mockCtx();
    const annotations: Annotation[] = [
      { id: "a1", type: "arrow", x: 0.1, y: 0.1, w: 0.3, h: 0.3, text: "", color: "#000", strokeWidth: 0.5, fontSize: 0 }
    ];
    drawAnnotations(ctx, annotations, 800, 600, 2);
    expect(ctx.stroke).toHaveBeenCalled();
  });
});

describe("drawWatermark", () => {
  it("returns early when watermark is disabled", () => {
    const ctx = mockCtx();
    drawWatermark(ctx, { ...scene(), watermarkEnabled: false, watermarkText: "Test" } as any, 800, 600, 2);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("returns early when watermark text is empty", () => {
    const ctx = mockCtx();
    drawWatermark(ctx, { ...scene(), watermarkEnabled: true, watermarkText: "" } as any, 800, 600, 2);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("draws text at bottom-right position", () => {
    const ctx = mockCtx();
    drawWatermark(ctx, { ...scene(), watermarkEnabled: true, watermarkText: "Brand", watermarkPosition: "bottom-right", watermarkSize: 13 } as any, 800, 600, 2);
    expect(ctx.fillText).toHaveBeenCalledWith("Brand", expect.any(Number), expect.any(Number));
    expect(ctx.textAlign).toBe("right");
    expect(ctx.textBaseline).toBe("alphabetic");
  });

  it("draws text at bottom-left position", () => {
    const ctx = mockCtx();
    drawWatermark(ctx, { ...scene(), watermarkEnabled: true, watermarkText: "Brand", watermarkPosition: "bottom-left", watermarkSize: 13 } as any, 800, 600, 2);
    expect(ctx.textAlign).toBe("left");
    expect(ctx.textBaseline).toBe("alphabetic");
  });

  it("draws text at top-right position", () => {
    const ctx = mockCtx();
    drawWatermark(ctx, { ...scene(), watermarkEnabled: true, watermarkText: "Brand", watermarkPosition: "top-right", watermarkSize: 13 } as any, 800, 600, 2);
    expect(ctx.textAlign).toBe("right");
    expect(ctx.textBaseline).toBe("top");
  });

  it("draws text at top-left position", () => {
    const ctx = mockCtx();
    drawWatermark(ctx, { ...scene(), watermarkEnabled: true, watermarkText: "Brand", watermarkPosition: "top-left", watermarkSize: 13 } as any, 800, 600, 2);
    expect(ctx.textAlign).toBe("left");
    expect(ctx.textBaseline).toBe("top");
  });

  it("scales watermark size by dpiScale", () => {
    const ctx = mockCtx();
    drawWatermark(ctx, { ...scene(), watermarkEnabled: true, watermarkText: "Brand", watermarkPosition: "bottom-right", watermarkSize: 13 } as any, 800, 600, 3);
    expect(ctx.font).toContain("39px");
  });

  it("applies shadow styling", () => {
    const ctx = mockCtx();
    drawWatermark(ctx, { ...scene(), watermarkEnabled: true, watermarkText: "Brand", watermarkPosition: "bottom-right", watermarkSize: 13 } as any, 800, 600, 2);
    expect(ctx.shadowColor).toBe("rgba(0,0,0,0.6)");
    expect(ctx.shadowBlur).toBe(6);
  });
});

describe("drawFrameAndMedia screen chrome", () => {
  const box: FrameBox = { x: 0, y: 0, width: 400, height: 800, outerRadius: 20, innerX: 10, innerY: 10, innerW: 380, innerH: 780, innerRadius: 16 };

  it("draws no chrome text when the screen decoration is disabled", () => {
    const ctx = mockCtx();
    drawFrameAndMedia(ctx, scene({ screen: { ...DEFAULT_SCREEN_CHROME, enabled: false } }), getFrameSpec("iphone"), mediaLayer(), box, 1, 1, null, null);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("paints the status bar time when the screen decoration is enabled", () => {
    const ctx = mockCtx();
    drawFrameAndMedia(
      ctx,
      scene({ screen: { ...DEFAULT_SCREEN_CHROME, enabled: true } }),
      getFrameSpec("iphone"),
      mediaLayer(),
      box,
      1,
      1,
      null,
      null
    );
    expect(ctx.fillText).toHaveBeenCalledWith("9:41", expect.any(Number), expect.any(Number));
    expect(ctx.translate).toHaveBeenCalledWith(box.innerX, box.innerY);
    expect(ctx.clip).toHaveBeenCalled();
  });
});