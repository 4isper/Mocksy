import { describe, expect, it } from "vitest";
import { buildSvgMarkup } from "@/lib/export/exportSvg";
import { computeFrameBox } from "@/lib/export/renderMockup";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene } from "@/lib/types/editor";

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
        { id: "a1", type: "text", x: 0.1, y: 0.1, w: 0.3, h: 0, text: "Hi <there>", color: "#ffffff", strokeWidth: 0, fontSize: 24 },
        { id: "a2", type: "rect", x: 0.1, y: 0.2, w: 0.3, h: 0.2, text: "", color: "#ffff00", strokeWidth: 3, fontSize: 0 },
        { id: "a3", type: "arrow", x: 0.1, y: 0.3, w: 0.4, h: 0.2, text: "", color: "#00ff00", strokeWidth: 2, fontSize: 0 }
      ]
    });
    const markup = buildSvgMarkup(scene, { width: 800, height: 600, backgroundHref: null, groups: [] });
    expect(markup).toContain("Hi &lt;there&gt;");
    expect(markup).toContain('font-size="24" font-weight="600" fill="#ffffff"');
    expect(markup).toContain('fill="none" stroke="#ffff00" stroke-width="3"');
    expect(markup).toContain('<line x1="80" y1="180" x2="400" y2="300"');
    expect(markup).toContain('<polygon points="');
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
});
