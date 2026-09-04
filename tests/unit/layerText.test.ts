import { describe, expect, it, vi } from "vitest";
import {
  buildTextLayerSvg,
  drawTextLayer,
  isTextLayer,
  layoutTextLayer,
  TEXT_LAYER_FONT_FALLBACK,
  TEXT_LAYER_LINE_HEIGHT
} from "@/lib/render/layerText";
import { initialScene } from "@/lib/state/editorStore";
import type { MediaLayer } from "@/lib/types/editor";

function textLayer(overrides: Partial<MediaLayer> = {}): MediaLayer {
  return {
    ...initialScene.layers[0]!,
    id: "text-1",
    kind: "text",
    mediaUrl: null,
    mediaType: "none",
    mediaName: null,
    textContent: "Hello\nWorld",
    textColor: "#ff0000",
    textSize: 0.1,
    textAlign: "center",
    fontWeight: "bold",
    ...overrides
  };
}

describe("isTextLayer", () => {
  it("detects kind text and defaults everything else to false", () => {
    expect(isTextLayer(textLayer())).toBe(true);
    expect(isTextLayer({ ...initialScene.layers[0]!, kind: "media" })).toBe(false);
    expect(isTextLayer(initialScene.layers[0])).toBe(false);
    expect(isTextLayer(undefined)).toBe(false);
    expect(isTextLayer(null)).toBe(false);
  });
});

describe("layoutTextLayer", () => {
  it("derives the font size from the fraction of the viewBox height", () => {
    const L = layoutTextLayer(textLayer({ textSize: 0.25 }), 400);
    expect(L.fontSize).toBe(100);
    expect(L.lineHeight).toBeCloseTo(100 * TEXT_LAYER_LINE_HEIGHT);
  });

  it("vertically centers the text block", () => {
    // One line: the baseline must sit so that the line's visual box
    // (half-leading + ascent) starts exactly at (vbH - lineHeight) / 2.
    const L = layoutTextLayer(textLayer({ textContent: "One" }), 500);
    const boxTop = L.firstBaselineY - L.fontSize * 0.8 - (L.lineHeight - L.fontSize) / 2;
    expect(boxTop).toBeCloseTo((500 - L.lineHeight) / 2);
    expect(L.blockHeight).toBeCloseTo(L.lineHeight);
  });

  it("stacks multi-line blocks with even line spacing", () => {
    const L = layoutTextLayer(textLayer(), 600);
    expect(L.lines).toEqual(["Hello", "World"]);
    expect(L.blockHeight).toBeCloseTo(2 * L.lineHeight);
  });

  it("maps alignments to anchors with screen padding", () => {
    const L = layoutTextLayer(textLayer(), 600);
    expect(L.anchorX.start).toBeGreaterThan(0);
    expect(L.anchorX.middle).toBe(195);
    expect(L.anchorX.end).toBe(390 - L.anchorX.start);
    expect(L.anchorByAlign.left).toBe("start");
    expect(L.anchorByAlign.center).toBe("middle");
    expect(L.anchorByAlign.right).toBe("end");
  });
});

describe("buildTextLayerSvg", () => {
  it("returns null for media layers or empty text", () => {
    expect(buildTextLayerSvg(initialScene.layers[0], 390 / 844)).toBeNull();
    expect(buildTextLayerSvg(textLayer({ textContent: "" }), 2)).toBeNull();
    expect(buildTextLayerSvg(textLayer({ textContent: "   " }), 2)).toBeNull();
    expect(buildTextLayerSvg(undefined, 2)).toBeNull();
  });

  it("embeds an aspect-exact svg stretched over the screen", () => {
    const svg = buildTextLayerSvg(textLayer(), 2)!;
    expect(svg.startsWith("<svg")).toBe(true);
    // viewBox height derives from the aspect: 390 / 2 = 195.
    expect(svg).toContain('viewBox="0 0 390 195"');
    expect(svg).toContain('preserveAspectRatio="none"');
  });

  it("renders one tspan per line anchored by alignment", () => {
    const svg = buildTextLayerSvg(textLayer(), 2)!;
    expect(svg.match(/<tspan /g)).toHaveLength(2);
    expect(svg).toContain('text-anchor="middle"');
    const left = buildTextLayerSvg(textLayer({ textAlign: "left" }), 2)!;
    expect(left).toContain('text-anchor="start"');
  });

  it("applies color, weight and family, escaping markup", () => {
    const svg = buildTextLayerSvg(
      textLayer({ textContent: "a<b & c>", fontFamily: undefined }),
      2
    )!;
    expect(svg).toContain('fill="#ff0000"');
    expect(svg).toContain('font-weight="700"');
    expect(svg).toContain(`font-family="${TEXT_LAYER_FONT_FALLBACK.replace(/"/g, "&quot;")}"`);
    expect(svg).toContain("a&lt;b &amp; c&gt;");
  });

  it("escapes attribute-breaking colors so fill cannot break out", () => {
    const svg = buildTextLayerSvg(textLayer({ textColor: '#fff" onload="alert(1)' }), 2)!;
    expect(svg).toContain('fill="#fff&quot; onload=&quot;alert(1)"');
    expect(svg).not.toContain('" onload="');
  });
});

describe("drawTextLayer", () => {
  function mockCtx() {
    return {
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillStyle: "",
      font: "",
      textAlign: "",
      textBaseline: ""
    };
  }

  it("mirrors the svg layout through a uniform scale", () => {
    const ctx = mockCtx();
    // Screen box 390×780 → k = 1, vbH = 780; textSize 0.1 → fontSize 78.
    drawTextLayer(ctx as unknown as CanvasRenderingContext2D, textLayer(), 10, 20, 390, 780);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.fillStyle).toBe("#ff0000");
    expect(ctx.font).toBe(`700 ${78}px ${TEXT_LAYER_FONT_FALLBACK}`);
    // "middle" is not a valid CanvasTextAlign — the canvas equivalent is "center".
    expect(ctx.textAlign).toBe("center");
    // Centered anchor x: innerX + 390/2.
    const L = layoutTextLayer(textLayer(), 780);
    expect(ctx.fillText).toHaveBeenCalledTimes(2);
    const [firstLine, firstX, firstY] = ctx.fillText.mock.calls[0]!;
    expect(firstLine).toBe("Hello");
    expect(firstX).toBeCloseTo(10 + 195);
    expect(firstY).toBeCloseTo(20 + L.firstBaselineY);
    const [, , secondY] = ctx.fillText.mock.calls[1]!;
    expect(secondY).toBeCloseTo(20 + L.firstBaselineY + L.lineHeight);
  });

  it("skips media layers and empty content without touching the context", () => {
    const ctx = mockCtx();
    drawTextLayer(ctx as unknown as CanvasRenderingContext2D, initialScene.layers[0]!, 0, 0, 100, 100);
    drawTextLayer(ctx as unknown as CanvasRenderingContext2D, textLayer({ textContent: "" }), 0, 0, 100, 100);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("maps left/right alignment to valid CanvasTextAlign values", () => {
    const leftCtx = mockCtx();
    drawTextLayer(leftCtx as unknown as CanvasRenderingContext2D, textLayer({ textAlign: "left" }), 0, 0, 390, 780);
    expect(leftCtx.textAlign).toBe("start");
    const rightCtx = mockCtx();
    drawTextLayer(rightCtx as unknown as CanvasRenderingContext2D, textLayer({ textAlign: "right" }), 0, 0, 390, 780);
    expect(rightCtx.textAlign).toBe("end");
  });
});
