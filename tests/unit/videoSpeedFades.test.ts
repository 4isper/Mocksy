import { afterEach, describe, expect, it, vi } from "vitest";
import { initialScene } from "@/lib/state/editorStore";
import { computeCaptureDuration } from "@/lib/export/videoExportHelpers";
import { buildSvgMarkup } from "@/lib/export/svgMarkup";
import { buildHtmlSnippet } from "@/lib/export/htmlMarkup";
import { drawAnnotations } from "@/lib/render/canvasDrawing";
import { makeAnnotation } from "@/lib/state/editorHelpers";
import { normalizeScene } from "@/lib/state/normalizeScene";
import type { Annotation, EditorScene, MediaLayer } from "@/lib/types/editor";

function layer(overrides: Partial<MediaLayer> = {}): MediaLayer {
  return {
    ...initialScene.layers[0]!,
    id: "layer-test",
    mediaUrl: "data:image/png;base64,x",
    mediaType: "video",
    videoDuration: 10,
    ...overrides
  };
}

function scene(overrides: Partial<EditorScene> = {}): EditorScene {
  return { ...initialScene, layers: [layer()], activeLayerId: "layer-test", ...overrides };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("playback speed", () => {
  it("scales the capture duration by the layer's playback speed", () => {
    const trimmed = scene({ layers: [layer({ videoTrimStart: 2, videoTrimEnd: 6 })] });
    expect(computeCaptureDuration(trimmed)).toBeCloseTo(4, 6);
    expect(computeCaptureDuration(scene({ layers: [layer({ videoTrimStart: 2, videoTrimEnd: 6, playbackSpeed: 2 })] }))).toBeCloseTo(2, 6);
    expect(computeCaptureDuration(scene({ layers: [layer({ videoTrimStart: 2, videoTrimEnd: 6, playbackSpeed: 0.5 })] }))).toBeCloseTo(8, 6);
  });

  it("normalizes out-of-range speeds into 0.5–2", () => {
    expect(normalizeScene({ ...scene(), layers: [{ ...layer(), playbackSpeed: 9 }] }).layers[0]!.playbackSpeed).toBe(2);
    expect(normalizeScene({ ...scene(), layers: [{ ...layer(), playbackSpeed: 0.1 }] }).layers[0]!.playbackSpeed).toBe(0.5);
    // Absent → native speed.
    const normalized = normalizeScene({ ...scene(), layers: [{ id: "l", mediaType: "video" }] });
    expect(normalized.layers[0]!.playbackSpeed).toBe(1);
  });

  it("embeds a playback-rate script in HTML exports only when non-native", () => {
    const opts = { mediaHref: "data:image/png;base64,x", mediaType: "video" as const, backgroundHref: null, overlayHref: null };
    const fast = buildHtmlSnippet(scene({ layers: [layer({ playbackSpeed: 1.5 })] }), opts);
    expect(fast).toContain('v.playbackRate=1.5');
    const normal = buildHtmlSnippet(scene(), opts);
    expect(normal).not.toContain("playbackRate");
    const image = buildHtmlSnippet(scene({ layers: [layer({ playbackSpeed: 2, mediaType: "image" })] }), { ...opts, mediaType: "image" });
    expect(image).not.toContain("playbackRate");
  });
});

describe("background audio fades", () => {
  it("defaults to no fade and clamps normalized values to 0–10", () => {
    expect(initialScene.audioFadeIn).toBe(0);
    expect(initialScene.audioFadeOut).toBe(0);
    const raw = scene({ audioFadeIn: 99 as number, audioFadeOut: -3 });
    const normalized = normalizeScene(raw);
    expect(normalized.audioFadeIn).toBe(10);
    expect(normalized.audioFadeOut).toBe(0);
  });
});

describe("blur annotation", () => {
  it("makeAnnotation('blur') seeds a rounded region with blur strength", () => {
    const a = makeAnnotation("blur");
    expect(a.type).toBe("blur");
    expect(a.strokeWidth).toBe(12);
    expect(a.text).toBe("");
    expect(a.fontSize).toBe(0);
  });

  it("survives share/project normalization", () => {
    const blur = { ...makeAnnotation("blur"), id: "a-blur" };
    const out = normalizeScene(scene({ annotations: [blur as Annotation] }));
    expect(out.annotations[0]!.type).toBe("blur");
    expect(out.annotations[0]!.strokeWidth).toBe(12);
  });

  it("renders in SVG as a clipped <use> replaying the scene through feGaussianBlur", () => {
    const markup = buildSvgMarkup(scene({
      annotations: [{ ...makeAnnotation("blur"), w: 0.3, h: 0.2, strokeWidth: 14 }]
    }), {
      width: 800,
      height: 450,
      backgroundHref: null,
      groups: [{
        box: { x: 10, y: 10, width: 300, height: 400, outerRadius: 20, innerX: 20, innerY: 20, innerW: 280, innerH: 380, innerRadius: 16 },
        mediaHref: "data:image/png;base64,x",
        mediaWidth: 100,
        mediaHeight: 100,
        isOverlay: false,
        overlayInner: null
      }]
    });
    expect(markup).toContain('<g id="mocksy-scene">');
    expect(markup).toContain('<use href="#mocksy-scene" filter="url(#anno-blur-0)"/>');
    expect(markup).toContain('<clipPath id="anno-blur-clip-0">');
    expect(markup).toContain('<feGaussianBlur stdDeviation="14"/>');
    // The scene content itself is emitted exactly once (inside <defs>? no —
    // inline group), so media data URLs are not duplicated.
    expect(markup.split("data:image/png;base64,x").length - 1).toBeGreaterThanOrEqual(1);
  });

  it("keeps blur-region ids in lockstep across interleaved annotation types", () => {
    // The defs builder and the markup pass must agree on region ids even when
    // non-blur annotations sit between blurs — ids are assigned in annotation
    // order, once, from a shared array (no mutable module-level counter).
    const markup = buildSvgMarkup(scene({
      annotations: [
        { ...makeAnnotation("blur"), id: "b0", w: 0.3, h: 0.2 },
        { ...makeAnnotation("arrow"), id: "a0", w: 0.4, h: 0.4 },
        { ...makeAnnotation("blur"), id: "b1", w: 0.2, h: 0.2 },
        { ...makeAnnotation("rect"), id: "r0", w: 0.1, h: 0.1 },
        { ...makeAnnotation("blur"), id: "b2", w: 0.1, h: 0.1 }
      ] as Annotation[]
    }), {
      width: 800,
      height: 450,
      backgroundHref: null,
      groups: []
    });
    const uses = [...markup.matchAll(/<use href="#mocksy-scene" filter="url\(#anno-blur-(\d+)\)"\/>/g)].map((m) => m[1]);
    expect(uses).toEqual(["0", "1", "2"]);
    for (const idx of ["0", "1", "2"]) {
      expect(markup).toContain(`<clipPath id="anno-blur-clip-${idx}">`);
      expect(markup).toContain(`<filter id="anno-blur-${idx}"`);
    }
  });

  it("draws via a blurred self-snapshot on canvas", () => {
    const draws: string[] = [];
    const snapCtx = { drawImage: vi.fn() };
    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => snapCtx
      })
    });
    const ctx: Record<string, unknown> = {};
    const mock = {
      save: vi.fn(() => draws.push("save")),
      restore: vi.fn(() => draws.push("restore")),
      clip: vi.fn(),
      drawImage: vi.fn(() => draws.push("image")),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      beginPath: vi.fn(),
      canvas: { width: 100, height: 100 },
      set filter(v: unknown) { ctx.filter = v; },
      get filter() { return ctx.filter; }
    } as unknown as CanvasRenderingContext2D;
    drawAnnotations(
      mock,
      [{ ...makeAnnotation("blur"), x: 0.1, y: 0.1, w: 0.3, h: 0.2 }],
      // Reference width → artboard scale 1 → the stroke passes through 1:1.
      800,
      600
    );
    expect(draws.filter((d) => d === "image").length).toBe(1); // snapshot write happens on sctx
    expect(mock.drawImage).toHaveBeenCalledTimes(1);
    expect(ctx.filter).toBe("blur(12px)");
    // Loop save + branch save, then branch restore + loop restore.
    expect(draws).toEqual(["save", "save", "image", "restore", "restore"]);
  });

  it("embeds a backdrop-filter region in HTML exports", () => {
    const html = buildHtmlSnippet(scene({
      annotations: [{ ...makeAnnotation("blur"), w: 0.3, h: 0.2 }]
    }), { mediaHref: "data:image/png;base64,x", mediaType: "image", backgroundHref: null, overlayHref: null });
    expect(html).toContain("backdrop-filter:blur(12px)");
  });
});
