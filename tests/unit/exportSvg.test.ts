import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSvgMarkup, exportSvg, inlineSvgAsset, mediaToDataUrl, videoToDataUrl } from "@/lib/export/exportSvg";
import { clearImageCache } from "@/lib/render/canvasMedia";
import { computeFrameBox } from "@/lib/render/frameGeometry";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene } from "@/lib/types/editor";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearImageCache();
});

/** Installs a fake global `Image` so `loadMediaElement` resolves deterministically. */
function stubImage({ naturalWidth = 100, naturalHeight = 50 } = {}) {
  const instances: Array<{ onload: (() => void) | null; onerror: (() => void) | null; src: string }> = [];
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = naturalWidth;
    naturalHeight = naturalHeight;
    width = naturalWidth;
    height = naturalHeight;
    complete = true;
    src = "";
    constructor() {
      instances.push(this);
    }
  }
  vi.stubGlobal("Image", FakeImage);
  return {
    resolve: () => instances.forEach((i) => i.onload?.()),
    reject: () => instances.forEach((i) => i.onerror?.())
  };
}

/** Installs a fake `document` whose createElement("canvas") returns a mock canvas. */
function stubCanvas(getCtx: () => unknown) {
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(getCtx),
    toDataURL: vi.fn(() => "data:image/png;base64,REENCODED")
  } as unknown as HTMLCanvasElement;
  vi.stubGlobal("document", {
    createElement: (tag: string) => (tag === "canvas" ? canvas : undefined)
  });
  return canvas;
}

const MEDIA = "data:image/png;base64,AAAA";
const BG = "data:image/png;base64,BG";

function sceneWith(overrides: Partial<EditorScene> = {}): EditorScene {
  return { ...initialScene, ...overrides };
}

function boxFor(scene: EditorScene, frameW = 400, frameH = 300) {
  return computeFrameBox(scene, 800, 600, 1, frameW, frameH);
}

describe("buildSvgMarkup", () => {
  it("emits an svg root sized to the canvas", () => {
    const scene = sceneWith({ backgroundMode: "transparent" });
    const markup = buildSvgMarkup(scene, { width: 800, height: 600, backgroundHref: null, groups: [] });
    expect(markup).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">');
    expect(markup).toMatch(/<\/svg>$/);
  });

  it("renders a solid background as a filled rect", () => {
    const scene = sceneWith({ backgroundMode: "solid", backgroundColor: "#111827" });
    const markup = buildSvgMarkup(scene, { width: 800, height: 600, backgroundHref: null, groups: [] });
    expect(markup).toContain('<rect width="800" height="600" fill="#111827"/>');
  });

  it("renders a gradient background with a linearGradient definition", () => {
    const scene = sceneWith({ backgroundMode: "gradient", gradientFrom: "#1d4ed8", gradientTo: "#7c3aed", gradientAngle: 120 });
    const markup = buildSvgMarkup(scene, { width: 800, height: 600, backgroundHref: null, groups: [] });
    expect(markup).toContain('<rect width="800" height="600" fill="url(#bg-gradient)"/>');
    expect(markup).toContain('<linearGradient id="bg-gradient"');
    expect(markup).toContain('stop-color="#1d4ed8"');
    expect(markup).toContain('stop-color="#7c3aed"');
  });

  it("renders no background when transparent", () => {
    const scene = sceneWith({ backgroundMode: "transparent" });
    const markup = buildSvgMarkup(scene, { width: 800, height: 600, backgroundHref: null, groups: [] });
    expect(markup).not.toContain("bg-gradient");
  });

  it.each(["dots", "grid", "diagonal", "noise", "plus", "cross", "triangle"] as const)(
    "renders a %s pattern background as a repeating <pattern>",
    (patternId) => {
      const scene = sceneWith({ backgroundMode: "pattern", patternId });
      const markup = buildSvgMarkup(scene, { width: 800, height: 600, backgroundHref: null, groups: [] });
      expect(markup).toContain('<pattern id="bg-pattern"');
      expect(markup).toContain('fill="url(#bg-pattern)"');
    }
  );

  it("renders a radial gradient with a radialGradient definition", () => {
    const scene = sceneWith({ backgroundMode: "gradient", gradientType: "radial", gradientFrom: "#1d4ed8", gradientTo: "#7c3aed" });
    const markup = buildSvgMarkup(scene, { width: 800, height: 600, backgroundHref: null, groups: [] });
    expect(markup).toContain('<radialGradient id="bg-gradient"');
    expect(markup).toContain('stop-color="#1d4ed8"');
    expect(markup).toContain('stop-color="#7c3aed"');
    expect(markup).not.toContain("<linearGradient");
  });

  it("renders a 3-stop gradient when a via color is set", () => {
    const scene = sceneWith({ backgroundMode: "gradient", gradientFrom: "#1d4ed8", gradientVia: "#22d3ee", gradientTo: "#7c3aed" });
    const markup = buildSvgMarkup(scene, { width: 800, height: 600, backgroundHref: null, groups: [] });
    expect(markup).toContain('stop-color="#22d3ee"');
    expect(markup).toContain('stop offset="0.5"');
  });

  it("embeds a background image with a blur filter when blur is set", () => {
    const scene = sceneWith({ backgroundMode: "image", backgroundBlur: 10, backgroundImageUrl: BG });
    const markup = buildSvgMarkup(scene, {
      width: 800,
      height: 600,
      backgroundHref: BG,
      backgroundWidth: 100,
      backgroundHeight: 100,
      groups: []
    });
    expect(markup).toContain('<rect width="800" height="600" fill="#0a0a0f"/>');
    expect(markup).toContain('filter="url(#bg-blur)"');
    expect(markup).toContain('<filter id="bg-blur"><feGaussianBlur stdDeviation="5"/></filter>');
  });

  it("positions a cover media exactly like the canvas renderer", () => {
    const scene = sceneWith({ frame: "none", backgroundMode: "transparent" });
    const box = boxFor(scene);
    const markup = buildSvgMarkup(scene, {
      width: 800,
      height: 600,
      backgroundHref: null,
      zoom: 1,
      groups: [{ box, mediaHref: MEDIA, mediaWidth: 400, mediaHeight: 100, isOverlay: false, overlayInner: null }]
    });
    // cover: scale = max(400/400, 300/100) = 3 -> dw=1200, dh=300
    // dx = 200 + (400-1200)/2 = -200, dy = 150
    expect(markup).toContain('<g clip-path="url(#clip-0)">');
    expect(markup).toContain('<image href="data:image/png;base64,AAAA" x="-200" y="150" width="1200" height="300"/>');
    expect(markup).toContain('<clipPath id="clip-0"><rect x="200" y="150" width="400" height="300" rx="20"/></clipPath>');
  });

  it("positions a contain media with letterboxing", () => {
    const scene = sceneWith({ frame: "none", backgroundMode: "transparent" });
    const box = boxFor(scene);
    const markup = buildSvgMarkup(scene, {
      width: 800,
      height: 600,
      backgroundHref: null,
      zoom: 1,
      groups: [{ box, mediaHref: MEDIA, mediaWidth: 400, mediaHeight: 100, isOverlay: false, overlayInner: null, mediaFit: "contain" }]
    });
    // contain: scale = min(400/400, 300/100) = 1 -> dw=400, dh=100
    // dx = 200, dy = 150 + (300-100)/2 = 250
    expect(markup).toContain('<image href="data:image/png;base64,AAAA" x="200" y="250" width="400" height="100"/>');
  });

  it("embeds the screen chrome inside the screen clip when enabled", () => {
    const scene = sceneWith({ frame: "none", backgroundMode: "transparent", screen: { ...initialScene.screen, enabled: true } });
    const box = boxFor(scene);
    const markup = buildSvgMarkup(scene, {
      width: 800,
      height: 600,
      backgroundHref: null,
      zoom: 1,
      groups: [{ box, mediaHref: null, mediaWidth: 0, mediaHeight: 0, isOverlay: false, overlayInner: null }]
    });
    // chrome is wrapped in a translate group at the screen origin, inside the clip
    expect(markup).toContain('<g clip-path="url(#clip-0)">');
    expect(markup).toContain(`<g transform="translate(${box.innerX} ${box.innerY})">`);
    expect(markup).toContain("9:41");
    expect(markup).toContain(`id="sc-0-top"`);
  });

  it("omits the screen chrome when disabled", () => {
    const scene = sceneWith({ frame: "none", backgroundMode: "transparent" });
    const box = boxFor(scene);
    const markup = buildSvgMarkup(scene, {
      width: 800,
      height: 600,
      backgroundHref: null,
      zoom: 1,
      groups: [{ box, mediaHref: MEDIA, mediaWidth: 400, mediaHeight: 100, isOverlay: false, overlayInner: null }]
    });
    expect(markup).not.toContain("9:41");
  });

  it("wraps a tilted frame group in an affine matrix with an inline clip", () => {
    const scene = sceneWith({ frame: "none", backgroundMode: "transparent", tiltX: 15, tiltY: 10 });
    const box = boxFor(scene);
    const markup = buildSvgMarkup(scene, {
      width: 800,
      height: 600,
      backgroundHref: null,
      zoom: 1,
      groups: [{ box, mediaHref: MEDIA, mediaWidth: 400, mediaHeight: 300, isOverlay: false, overlayInner: null }]
    });
    expect(markup).toMatch(/<g transform="matrix\(/);
    expect(markup).toContain('clip-path="url(#clip-t0)"');
    expect(markup).toContain('<clipPath id="clip-t0">');
    // the root-space clip stays unused when tilted
    expect(markup).not.toContain('clip-path="url(#clip-0)"');
  });

  it("keeps the plain clip when the scene is not tilted", () => {
    const scene = sceneWith({ frame: "none", backgroundMode: "transparent" });
    const box = boxFor(scene);
    const markup = buildSvgMarkup(scene, {
      width: 800,
      height: 600,
      backgroundHref: null,
      zoom: 1,
      groups: [{ box, mediaHref: MEDIA, mediaWidth: 400, mediaHeight: 300, isOverlay: false, overlayInner: null }]
    });
    expect(markup).toContain('clip-path="url(#clip-0)"');
    expect(markup).not.toContain("matrix(");
  });

  it("renders an empty media screen when no media is provided", () => {
    const scene = sceneWith({ frame: "none", backgroundMode: "transparent" });
    const box = boxFor(scene);
    const markup = buildSvgMarkup(scene, {
      width: 800,
      height: 600,
      backgroundHref: null,
      groups: [{ box, mediaHref: null, mediaWidth: 400, mediaHeight: 300, isOverlay: false, overlayInner: null }]
    });
    expect(markup).toContain('fill="rgba(255,255,255,0.04)"');
  });

  it("inlines an overlay skin scaled to the frame box", () => {
    const scene = sceneWith({ frame: "iphone15", backgroundMode: "transparent" });
    const box = computeFrameBox(scene, 800, 600, 1, 390, 844);
    const markup = buildSvgMarkup(scene, {
      width: 800,
      height: 600,
      backgroundHref: null,
      zoom: 1,
      groups: [{ box, mediaHref: null, mediaWidth: 362, mediaHeight: 816, isOverlay: true, overlayInner: '<rect fill="red"/>' }]
    });
    expect(markup).toContain('<g filter="url(#frame-shadow)"><g transform="translate(205 -122) scale(1 1)"><rect fill="red"/></g></g>');
  });

  it("adds a drop-shadow filter scaled by the frame zoom", () => {
    const scene = sceneWith({ frame: "none", backgroundMode: "transparent", shadowOpacity: 0.5 });
    const box = boxFor(scene);
    const markup = buildSvgMarkup(scene, {
      width: 800,
      height: 600,
      backgroundHref: null,
      zoom: 1.5,
      groups: [{ box, mediaHref: null, mediaWidth: 400, mediaHeight: 300, isOverlay: false, overlayInner: null }]
    });
    expect(markup).toContain('<feDropShadow dx="0" dy="42" stdDeviation="52.5" flood-color="#000" flood-opacity="0.5"/>');
  });

  it("renders text, rect and arrow annotations", () => {
    const scene = sceneWith({
      backgroundMode: "transparent",
      annotations: [
        { id: "a1", type: "text", x: 0.1, y: 0.1, w: 0.3, h: 0, text: "Hi <there>", color: "#ffffff", strokeWidth: 0, fontSize: 24, fontWeight: "normal", fontStyle: "italic", textAlign: "center" },
        { id: "a2", type: "rect", x: 0.1, y: 0.2, w: 0.3, h: 0.2, text: "", color: "#ffff00", strokeWidth: 3, fontSize: 0 },
        { id: "a3", type: "arrow", x: 0.1, y: 0.3, w: 0.4, h: 0.2, text: "", color: "#00ff00", strokeWidth: 2, fontSize: 0 }
      ]
    });
    const markup = buildSvgMarkup(scene, { width: 800, height: 600, backgroundHref: null, groups: [] });
    expect(markup).toContain("Hi &lt;there&gt;");
    expect(markup).toContain('font-size="24" font-weight="400" fill="#ffffff"');
    expect(markup).toContain('text-anchor="middle"');
    expect(markup).toContain('font-style="italic"');
    expect(markup).toContain('fill="none" stroke="#ffff00" stroke-width="3"');
    expect(markup).toContain('<line x1="80" y1="180" x2="400" y2="300"');
    expect(markup).toContain('<polygon points="');
  });

  it("embeds font-face CSS in the defs when provided", () => {
    const scene = sceneWith({ backgroundMode: "transparent" });
    const markup = buildSvgMarkup(scene, {
      width: 800,
      height: 600,
      backgroundHref: null,
      groups: [],
      fontCss: '@font-face { font-family: "Inter"; }'
    });
    expect(markup).toContain('<style>@font-face { font-family: "Inter"; }</style>');
  });

  it("omits font-face CSS when not provided", () => {
    const scene = sceneWith({ backgroundMode: "transparent" });
    const markup = buildSvgMarkup(scene, { width: 800, height: 600, backgroundHref: null, groups: [] });
    expect(markup).not.toContain("<style>");
  });

  it("renders the watermark when enabled", () => {
    const scene = sceneWith({ backgroundMode: "transparent", watermarkEnabled: true, watermarkText: "Mocksy", watermarkSize: 13 });
    const markup = buildSvgMarkup(scene, { width: 800, height: 600, backgroundHref: null, groups: [] });
    expect(markup).toContain('<text x="784" y="584" font-size="13" font-weight="500" fill="rgba(255,255,255,0.85)"');
    expect(markup).toContain(">Mocksy</text>");
  });

  it("omits the watermark when disabled", () => {
    const scene = sceneWith({ backgroundMode: "transparent", watermarkEnabled: false, watermarkText: "Mocksy" });
    const markup = buildSvgMarkup(scene, { width: 800, height: 600, backgroundHref: null, groups: [] });
    expect(markup).not.toContain(">Mocksy</text>");
  });

  it("embeds the logo watermark image instead of text", () => {
    const scene = sceneWith({
      backgroundMode: "transparent",
      watermarkEnabled: true,
      watermarkText: "Mocksy",
      watermarkImageUrl: "data:image/png;base64,AAAA",
      watermarkSize: 20
    });
    const markup = buildSvgMarkup(scene, {
      width: 800,
      height: 600,
      backgroundHref: null,
      groups: [],
      watermarkHref: "data:image/png;base64,AAAA",
      watermarkWidth: 200,
      watermarkHeight: 100
    });
    // height 20, width 40, anchored bottom-right with 16px inset.
     expect(markup).toContain(`<image href="data:image/png;base64,AAAA" x="744" y="564" width="40" height="20"`);
     expect(markup).not.toContain(">Mocksy</text>");
   });

   it("caps wide logos at 45% of the SVG width", () => {
     const scene = sceneWith({
       backgroundMode: "transparent",
       watermarkEnabled: true,
       watermarkText: "Mocksy",
       watermarkImageUrl: "data:image/png;base64,AAAA",
       watermarkSize: 20
     });
     const markup = buildSvgMarkup(scene, {
       width: 800,
       height: 600,
       backgroundHref: null,
       groups: [],
       watermarkHref: "data:image/png;base64,AAAA",
       watermarkWidth: 800,
       watermarkHeight: 40
     });
     // aspect = 20, drawW = 20*20 = 400, capped at 45% of 800 = 360
     expect(markup).toContain(`<image href="data:image/png;base64,AAAA" x="424" y="566" width="360" height="18"`);
   });

   it("renders text annotations with bold font weight by default", () => {
     const scene = sceneWith({
       backgroundMode: "transparent",
       annotations: [{ id: "a1", type: "text", x: 0.1, y: 0.1, w: 0.3, h: 0, text: "Hi", color: "#fff", strokeWidth: 0, fontSize: 16 }]
     });
     const markup = buildSvgMarkup(scene, { width: 800, height: 600, backgroundHref: null, groups: [] });
     expect(markup).toContain('font-weight="bold"');
   });

   it("renders a background box behind text annotations when bgColor is set", () => {
     const scene = sceneWith({
       backgroundMode: "transparent",
       annotations: [{ id: "a1", type: "text", x: 0.1, y: 0.1, w: 0.3, h: 0, text: "Hi", color: "#fff", strokeWidth: 0, fontSize: 16, bgColor: "rgba(0,0,0,0.5)", bgPadding: 4, bgRadius: 2 }]
     });
     const markup = buildSvgMarkup(scene, { width: 800, height: 600, backgroundHref: null, groups: [] });
     expect(markup).toContain('<rect');
     expect(markup).toContain('fill="rgba(0,0,0,0.5)"');
   });
 });

describe("mediaToDataUrl", () => {
  it("passes data URLs through unchanged with their intrinsic size", async () => {
    const image = stubImage({ naturalWidth: 320, naturalHeight: 240 });
    const src = "data:image/png;base64,AAAA";
    const promise = mediaToDataUrl(src);
    image.resolve();
    await expect(promise).resolves.toEqual({ href: src, width: 320, height: 240 });
  });

  it("re-encodes blob/http URLs through a canvas so the SVG is self-contained", async () => {
    const image = stubImage({ naturalWidth: 320, naturalHeight: 240 });
    const ctx = { drawImage: vi.fn() };
    const canvas = stubCanvas(() => ctx);
    const promise = mediaToDataUrl("https://example.com/media.png");
    image.resolve();
    await expect(promise).resolves.toEqual({ href: "data:image/png;base64,REENCODED", width: 320, height: 240 });
    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(240);
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0);
  });

  it("falls back to the raw URL when the canvas context is unavailable", async () => {
    const image = stubImage();
    stubCanvas(() => null);
    const src = "https://example.com/media.png";
    const promise = mediaToDataUrl(src);
    image.resolve();
    await expect(promise).resolves.toEqual({ href: src, width: 100, height: 50 });
  });

  it("returns null when the image fails to load", async () => {
    const image = stubImage();
    const promise = mediaToDataUrl("https://example.com/broken.png");
    image.reject();
    await expect(promise).resolves.toBeNull();
  });
});

describe("videoToDataUrl", () => {
  it("returns null for a video with no decoded dimensions", () => {
    const video = { videoWidth: 0, videoHeight: 0 } as HTMLVideoElement;
    expect(videoToDataUrl(video)).toBeNull();
  });

  it("captures the current frame as a PNG data URL", () => {
    const ctx = { drawImage: vi.fn() };
    const canvas = stubCanvas(() => ctx);
    const video = { videoWidth: 640, videoHeight: 360 } as HTMLVideoElement;
    expect(videoToDataUrl(video)).toEqual({ href: "data:image/png;base64,REENCODED", width: 640, height: 360 });
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(360);
    expect(ctx.drawImage).toHaveBeenCalledWith(video, 0, 0);
  });

  it("returns null when drawing the frame throws", () => {
    stubCanvas(() => ({
      drawImage: () => {
        throw new Error("tainted canvas");
      }
    }));
    const video = { videoWidth: 640, videoHeight: 360 } as HTMLVideoElement;
    expect(videoToDataUrl(video)).toBeNull();
  });
});

describe("inlineSvgAsset", () => {
  it("strips the xml prolog and svg root, wrapping inner markup in a group", async () => {
    const svg = `<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844"><rect fill="red"/><circle cx="5" cy="5" r="2"/></svg>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ text: async () => svg }));
    await expect(inlineSvgAsset("/devices/iphone.svg")).resolves.toBe(
      '<g><rect fill="red"/><circle cx="5" cy="5" r="2"/></g>'
    );
  });

  it("returns null when the asset cannot be fetched", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(inlineSvgAsset("/devices/iphone.svg")).resolves.toBeNull();
  });
});

describe("exportSvg", () => {
  it("downloads a standalone SVG built from the live preview", async () => {
    const scene = sceneWith({ frame: "none", backgroundMode: "transparent", watermarkEnabled: false });
    vi.stubGlobal("HTMLImageElement", class {});
    vi.stubGlobal("HTMLVideoElement", class {});

    const img = new (globalThis.HTMLImageElement as unknown as new () => HTMLImageElement)();
    Object.assign(img, { src: MEDIA, complete: true, naturalWidth: 400, naturalHeight: 300 });

    const node = {
      clientWidth: 800,
      clientHeight: 600,
      querySelector: (selector: string) => {
        if (selector === "img") return img;
        if (selector === "video") return null;
        if (selector === "[data-mockup-frame]") return null;
        return null;
      }
    } as unknown as HTMLElement;

    const link = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("document", {
      getElementById: () => node,
      createElement: (tag: string) => (tag === "a" ? link : undefined)
    });
    const createObjectURL = vi.fn((_blob: Blob) => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.useFakeTimers();

    await exportSvg(scene, "preview");
    await vi.advanceTimersByTimeAsync(300);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe("image/svg+xml");
    const markup = await blob.text();
    expect(markup).toMatch(/^<svg /);
    expect(markup).toMatch(/<\/svg>$/);
    expect(markup).toContain('<image href="data:image/png;base64,AAAA"');
    expect(link.href).toBe("blob:mock");
    expect(link.download).toBe("mocksy-export.svg");
    expect(link.click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");

    vi.useRealTimers();
  });

  it("reports an error when the preview area is missing", async () => {
    const scene = sceneWith({ frame: "none" });
    vi.stubGlobal("document", { getElementById: () => null });
    const onError = vi.fn();
    await exportSvg(scene, "missing", "out", onError);
    expect(onError).toHaveBeenCalledWith("Preview area not found.");
  });

  it("reports an error when the preview has no measurable size", async () => {
    const scene = sceneWith({ frame: "none" });
    const node = { clientWidth: 0, clientHeight: 0, querySelector: () => null } as unknown as HTMLElement;
    vi.stubGlobal("document", { getElementById: () => node });
    const onError = vi.fn();
    await exportSvg(scene, "preview", "out", onError);
    expect(onError).toHaveBeenCalledWith("Preview has no measurable size.");
  });
});
