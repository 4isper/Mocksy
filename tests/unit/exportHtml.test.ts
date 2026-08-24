import { afterEach, describe, expect, it, vi } from "vitest";
import { exportHtml } from "@/lib/export/exportHtml";
import { buildAnimationCss, buildGridHtmlSnippet, buildHtmlSnippet, serializeCssProperties } from "@/lib/export/htmlMarkup";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene, FrameInstance, MediaLayer } from "@/lib/types/editor";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const MEDIA = "data:image/png;base64,AAAA";
const BG = "data:image/png;base64,BG";
const SKIN = "data:image/svg+xml;utf8,<svg/>";

function sceneWith(overrides: Partial<EditorScene> = {}): EditorScene {
  return { ...initialScene, ...overrides };
}

function layerWith(overrides: Partial<MediaLayer> = {}): MediaLayer {
  const layer = sceneWith().layers[0];
  if (!layer) throw new Error("no layer");
  return { ...layer, ...overrides };
}

describe("serializeCssProperties", () => {
  it("adds px to numbers except unitless properties", () => {
    const css = serializeCssProperties({ width: 100, opacity: 0.5, zIndex: 2, fontWeight: 600, background: "linear-gradient(#1d4ed8, #7c3aed)" });
    expect(css).toContain("width: 100px;");
    expect(css).toContain("opacity: 0.5;");
    expect(css).toContain("z-index: 2;");
    expect(css).toContain("font-weight: 600;");
    expect(css).toContain("background: linear-gradient(#1d4ed8, #7c3aed);");
  });

  it("drops empty values and kebab-cases camelCase keys", () => {
    const css = serializeCssProperties({ marginLeft: 10, color: undefined, boxShadow: "", aspectRatio: "16 / 9" });
    expect(css).toContain("margin-left: 10px;");
    expect(css).toContain("aspect-ratio: 16 / 9;");
    expect(css).not.toContain("color:");
    expect(css).not.toContain("box-shadow: ;");
  });
});

describe("buildAnimationCss", () => {
  it("builds keyframes for an animated layer", () => {
    const css = buildAnimationCss(layerWith({ animationPreset: "zoomIn", zoom: 1 }));
    expect(css).toContain("@keyframes mockup-anim");
    expect(css).toContain("0% { transform: scale(1) translate(0px, 0px); }");
    expect(css).toContain("100% { transform: scale(1.12) translate(0px, 0px); }");
    expect(css).toContain("animation: mockup-anim 3s linear infinite;");
  });

  it("uses the scene animation duration", () => {
    const css = buildAnimationCss(layerWith({ animationPreset: "zoomIn" }), 5);
    expect(css).toContain("animation: mockup-anim 5s linear infinite;");
  });

  it("prepends the tilt prefix to keyframes and the reduced-motion static frame", () => {
    const css = buildAnimationCss(layerWith({ animationPreset: "zoomIn", zoom: 1 }), 3, "perspective(1200px) rotateY(10deg) rotateX(15deg) ");
    expect(css).toContain("0% { transform: perspective(1200px) rotateY(10deg) rotateX(15deg) scale(1) translate(0px, 0px); }");
    expect(css).toContain("100% { transform: perspective(1200px) rotateY(10deg) rotateX(15deg) scale(1.12) translate(0px, 0px); }");
    expect(css).toContain("transform: perspective(1200px) rotateY(10deg) rotateX(15deg) scale(1) translate(0px, 0px);");
  });

  it("pins a static frame under prefers-reduced-motion", () => {
    const css = buildAnimationCss(layerWith({ animationPreset: "zoomIn", zoom: 1 }));
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("  .frame {\n    animation: none;\n    transform: scale(1) translate(0px, 0px);");
  });

  it("bakes the easing into the sampled keyframes (spring overshoots past the endpoint)", () => {
    const css = buildAnimationCss(layerWith({ animationPreset: "zoomIn", zoom: 1, animationEasing: "spring" }));
    expect(css).toContain("@keyframes mockup-anim");
    expect(css).toContain("0% { transform: scale(1) translate(0px, 0px); }");
    expect(css).toContain("100% { transform: scale(1.12) translate(0px, 0px); }");
    const zooms = [...css.matchAll(/scale\(([0-9.]+)\)/g)].map((m) => Number(m[1]));
    expect(Math.max(...zooms)).toBeGreaterThan(1.12);
  });

  it("samples linear easing keyframes proportionally (midpoint at half the range)", () => {
    const css = buildAnimationCss(layerWith({ animationPreset: "zoomIn", zoom: 1, animationEasing: "linear" }));
    const zooms = [...css.matchAll(/scale\(([0-9.]+)\)/g)].map((m) => Number(m[1]));
    expect(zooms).toContain(1.06);
  });

  it("returns empty CSS for a static or missing layer", () => {
    expect(buildAnimationCss(layerWith({ animationPreset: "none" }))).toBe("");
    expect(buildAnimationCss(undefined)).toBe("");
  });
});

describe("buildHtmlSnippet", () => {
  it("renders a full standalone document", () => {
    const scene = sceneWith();
    const html = buildHtmlSnippet(scene, { mediaHref: MEDIA, mediaType: "image", backgroundHref: null, overlayHref: null });
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain("<title>Mocksy mockup</title>");
    expect(html).toContain("aspect-ratio: 16/9");
    expect(html).toContain(`<img class="media" src="data:image/png;base64,AAAA" alt="Mockup media"/>`);
  });

  it("embeds a video element for video layers", () => {
    const html = buildHtmlSnippet(sceneWith(), { mediaHref: MEDIA, mediaType: "video", backgroundHref: null, overlayHref: null });
    expect(html).toContain(`<video class="media" src="data:image/png;base64,AAAA" controls muted loop autoplay playsinline></video>`);
  });

  it("applies the frame geometry and static transform", () => {
    const scene = sceneWith({ frame: "none" });
    const html = buildHtmlSnippet(scene, { mediaHref: MEDIA, mediaType: "image", backgroundHref: null, overlayHref: null });
    expect(html).toContain("border-radius: 20px;");
    expect(html).toContain("object-fit: cover;");
    expect(html).toContain("transform: scale(1) translate(0px, 0px);");
  });

  it("prepends the tilt transform to the static frame", () => {
    const scene = sceneWith({ tiltX: 15, tiltY: 10 });
    const html = buildHtmlSnippet(scene, { mediaHref: MEDIA, mediaType: "image", backgroundHref: null, overlayHref: null });
    expect(html).toContain("transform: perspective(1200px) rotateY(15deg) rotateX(10deg) scale(1) translate(0px, 0px);");
  });

  it("embeds the background image and blur", () => {
    const scene = sceneWith({ backgroundMode: "image", backgroundImageUrl: "data:image/png;base64,IGNORED", backgroundBlur: 8 });
    const html = buildHtmlSnippet(scene, { mediaHref: null, mediaType: null, backgroundHref: BG, overlayHref: null });
    expect(html).toContain('<div class="bg"></div>');
    expect(html).toContain(`url("data:image/png;base64,BG")`);
    expect(html).toContain("filter: blur(8px);");
  });

  it("renders a pattern background through the shared CSS background", () => {
    const scene = sceneWith({ backgroundMode: "pattern", patternId: "dots" });
    const html = buildHtmlSnippet(scene, { mediaHref: MEDIA, mediaType: "image", backgroundHref: null, overlayHref: null });
    // The pattern comes from buildSceneCss -> buildCssBackground, so it matches
    // the live preview instead of the HTML export dropping it.
    expect(html).toContain("radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)");
  });

  it("inlines the overlay skin when present", () => {
    const scene = sceneWith({ frame: "iphone15" });
    const html = buildHtmlSnippet(scene, { mediaHref: MEDIA, mediaType: "image", backgroundHref: null, overlayHref: SKIN });
    expect(html).toContain(`<img class="overlay" src="data:image/svg+xml;utf8,<svg/>" alt=""/>`);
  });

  it("renders annotations and the watermark", () => {
    const scene = sceneWith({
      annotations: [{ id: "a1", type: "text", x: 0.1, y: 0.1, w: 0.3, h: 0, text: "Hi <there>", color: "#ffffff", strokeWidth: 0, fontSize: 24, fontFamily: "Inter" }],
      watermarkEnabled: true,
      watermarkText: "Mocksy",
      watermarkSize: 13
    });
    const html = buildHtmlSnippet(scene, { mediaHref: null, mediaType: null, backgroundHref: null, overlayHref: null });
     expect(html).toContain('<div class="anno anno-text" style="left:10%;top:10%;width:30%;font-size:24px;color:#ffffff;font-family:Inter;font-weight:bold;font-style:normal;text-align:left">Hi &lt;there&gt;</div>');
    expect(html).toContain('<span class="wm" style="right:16px;bottom:16px;font-size:13px">Mocksy</span>');
  });

  it("embeds the logo watermark image instead of text", () => {
    const scene = sceneWith({
      watermarkEnabled: true,
      watermarkText: "Mocksy",
      watermarkImageUrl: "data:image/png;base64,LOGO",
      watermarkSize: 20
    });
    const html = buildHtmlSnippet(scene, {
      mediaHref: null,
      mediaType: null,
      backgroundHref: null,
      overlayHref: null,
      watermarkHref: "data:image/png;base64,LOGO"
    });
     expect(html).toContain('<img class="wm wm-logo" src="data:image/png;base64,LOGO" alt="" style="right:16px;bottom:16px;height:20px"/>');
     expect(html).not.toContain('>Mocksy</span>');
   });

   it("renders text annotations with bold font weight by default", () => {
     const scene = sceneWith({
       annotations: [{ id: "a1", type: "text", x: 0.1, y: 0.1, w: 0.3, h: 0, text: "Hi", color: "#ffffff", strokeWidth: 0, fontSize: 24 }]
     });
     const html = buildHtmlSnippet(scene, { mediaHref: null, mediaType: null, backgroundHref: null, overlayHref: null });
     expect(html).toContain("font-weight:bold");
   });

   it("renders a background box behind text annotations when bgColor is set", () => {
     const scene = sceneWith({
       annotations: [{ id: "a1", type: "text", x: 0.1, y: 0.1, w: 0.3, h: 0, text: "Hi", color: "#ffffff", strokeWidth: 0, fontSize: 24, bgColor: "rgba(0,0,0,0.5)", bgPadding: 4, bgRadius: 2 }]
     });
     const html = buildHtmlSnippet(scene, { mediaHref: null, mediaType: null, backgroundHref: null, overlayHref: null });
     expect(html).toContain("background:rgba(0,0,0,0.5)");
     expect(html).toContain("padding:4px");
     expect(html).toContain("border-radius:2px");
   });

   it("applies typography styles to text annotations", () => {
    const scene = sceneWith({
      annotations: [
        {
          id: "a1", type: "text", x: 0.1, y: 0.1, w: 0.3, h: 0, text: "Hi", color: "#ffffff", strokeWidth: 0, fontSize: 24,
          fontWeight: "normal", fontStyle: "italic", textAlign: "center"
        }
      ]
    });
    const html = buildHtmlSnippet(scene, { mediaHref: null, mediaType: null, backgroundHref: null, overlayHref: null });
    expect(html).toContain("font-weight:400;font-style:italic;text-align:center");
  });

  it("renders rectangle annotations as bordered divs", () => {
    const scene = sceneWith({
      annotations: [
        { id: "a2", type: "rect", x: 0.1, y: 0.2, w: 0.3, h: 0.2, text: "", color: "#ffff00", strokeWidth: 3, fontSize: 0 }
      ]
    });
    const html = buildHtmlSnippet(scene, { mediaHref: null, mediaType: null, backgroundHref: null, overlayHref: null });
    expect(html).toContain('<div class="anno" style="left:10%;top:20%;width:30%;height:20%;border:3px solid #ffff00"></div>');
  });

  it("renders arrow annotations as an inline svg with a line and arrowhead", () => {
    const scene = sceneWith({
      annotations: [
        { id: "a3", type: "arrow", x: 0.1, y: 0.3, w: 0.4, h: 0.2, text: "", color: "#00ff00", strokeWidth: 2, fontSize: 0 }
      ]
    });
    const html = buildHtmlSnippet(scene, { mediaHref: null, mediaType: null, backgroundHref: null, overlayHref: null });
    expect(html).toContain('<svg class="anno" viewBox="0 0 16 9"');
    expect(html).toContain('<line x1="1.6" y1="2.7" x2="8" y2="4.5" stroke="#00ff00" stroke-width="2" stroke-linecap="round"/>');
    expect(html).toContain('<polygon points="8,4.5 ');
  });

  it("adds keyframe animation CSS for animated layers", () => {
    const scene = sceneWith({ animationDurationMs: 5000 });
    scene.layers[0] = layerWith({ animationPreset: "zoomIn" });
    const html = buildHtmlSnippet(scene, { mediaHref: MEDIA, mediaType: "image", backgroundHref: null, overlayHref: null });
    expect(html).toContain("@keyframes mockup-anim");
    expect(html).toContain("animation: mockup-anim 5s linear infinite;");
  });

  it("embeds font-face CSS in the head when provided", () => {
    const html = buildHtmlSnippet(sceneWith(), {
      mediaHref: MEDIA,
      mediaType: "image",
      backgroundHref: null,
      overlayHref: null,
      fontCss: '@font-face { font-family: "Roboto"; }'
    });
    expect(html).toContain('<style>\n@font-face { font-family: "Roboto"; }\n</style>');
  });

  it("omits font-face CSS when not provided", () => {
    const html = buildHtmlSnippet(sceneWith(), { mediaHref: MEDIA, mediaType: "image", backgroundHref: null, overlayHref: null });
    expect(html).not.toContain("@font-face");
  });

  it("embeds the screen chrome above the media when enabled", () => {
    const scene = sceneWith({ screen: { ...initialScene.screen, enabled: true } });
    const html = buildHtmlSnippet(scene, { mediaHref: MEDIA, mediaType: "image", backgroundHref: null, overlayHref: null });
    expect(html).toContain('<div class="chrome" style="');
    expect(html).toContain("9:41");
    expect(html).toContain("position: absolute;");
  });

  it("omits the screen chrome when disabled", () => {
    const html = buildHtmlSnippet(sceneWith(), { mediaHref: MEDIA, mediaType: "image", backgroundHref: null, overlayHref: null });
    expect(html).not.toContain('class="chrome"');
    expect(html).not.toContain("9:41");
  });
});

function instWith(overrides: Partial<FrameInstance> = {}): FrameInstance {
  return { id: "fi1", frame: "none", x: 0.25, y: 0.5, scale: 0.4, layerId: layerWith().id, ...overrides };
}

describe("buildGridHtmlSnippet", () => {
  const MEDIA2 = "data:image/png;base64,BBBB";

  it("renders one live frame-instance wrapper per item with preview geometry", () => {
    const scene = sceneWith({
      backgroundMode: "transparent",
      watermarkEnabled: false,
      frameInstances: [instWith({ id: "a", x: 0.25 }), instWith({ id: "b", x: 0.75 })]
    });
    const html = buildGridHtmlSnippet(
      scene,
      [
        { inst: scene.frameInstances[0]!, mediaHref: MEDIA, mediaType: "image", overlayHref: null },
        { inst: scene.frameInstances[1]!, mediaHref: MEDIA2, mediaType: "image", overlayHref: null }
      ]
    );
    expect(html.match(/class="frame-instance"/g)).toHaveLength(2);
    expect(html).toContain("left: 25%;");
    expect(html).toContain("left: 75%;");
    expect(html).toContain("top: 50%;");
    expect(html).toContain(`width: ${0.4 * 100}%;`);
    // A "none" instance shares the scene aspect (16:9 → native h/w = 0.5625).
    expect(html).toContain("aspect-ratio: 1 / 0.5625;");
    expect(html).toContain("transform: translate(-50%, -50%);");
    expect(html).toContain('<img class="media" src="data:image/png;base64,AAAA"');
    expect(html).toContain(`<img class="media" src="${MEDIA2}"`);
  });

  it("wraps a landscape instance in a rotate(90deg) rotor and swaps the aspect ratio", () => {
    const scene = sceneWith({
      backgroundMode: "transparent",
      frameInstances: [instWith({ orientation: "landscape" })]
    });
    const html = buildGridHtmlSnippet(scene, [
      { inst: scene.frameInstances[0]!, mediaHref: MEDIA, mediaType: "image", overlayHref: null }
    ]);
    expect(html).toContain("rotate(90deg)");
    // landscape box is wide: native (h/w) becomes the width multiplier
    expect(html).toMatch(/aspect-ratio: [\d.]+ \/ 1;/);
    expect(html).not.toMatch(/aspect-ratio: 1 \/ [\d.]+/);
  });

  it("applies the per-layer zoom and the shared tilt prefix to each frame", () => {
    const layer = layerWith({ zoom: 1.4 });
    const scene = sceneWith({
      tiltX: 12,
      tiltY: 8,
      backgroundMode: "transparent",
      layers: [layer],
      frameInstances: [instWith({ layerId: layer.id })]
    });
    const html = buildGridHtmlSnippet(scene, [
      { inst: scene.frameInstances[0]!, mediaHref: MEDIA, mediaType: "image", overlayHref: null }
    ]);
    expect(html).toContain("transform: perspective(1200px) rotateY(12deg) rotateX(8deg) scale(1.4);");
  });

  it("embeds the overlay skin and screen chrome inside each instance", () => {
    const scene = sceneWith({
      backgroundMode: "transparent",
      frame: "iphone15",
      screen: { ...initialScene.screen, enabled: true },
      frameInstances: [instWith({ frame: "iphone15" })]
    });
    const html = buildGridHtmlSnippet(scene, [
      { inst: scene.frameInstances[0]!, mediaHref: MEDIA, mediaType: "image", overlayHref: SKIN }
    ]);
    expect(html).toContain('<img class="overlay" src="data:image/svg+xml;utf8,<svg/>" alt=""/>');
    expect(html).toContain("9:41");
    expect(html).toContain('class="chrome"');
  });

  it("marks off-speed videos with data-rate and adds one boot script", () => {
    const layer = layerWith({ playbackSpeed: 1.5 });
    const scene = sceneWith({
      backgroundMode: "transparent",
      layers: [layer],
      frameInstances: [instWith({ layerId: layer.id })]
    });
    const html = buildGridHtmlSnippet(scene, [
      { inst: scene.frameInstances[0]!, mediaHref: MEDIA, mediaType: "video", overlayHref: null }
    ]);
    expect(html).toContain('<video class="media" src="data:image/png;base64,AAAA" controls muted loop autoplay playsinline style="object-fit: contain" data-rate="1.5">');
    expect(html).toContain('v.playbackRate=parseFloat(v.dataset.rate)');
  });

  it("renders annotations and the watermark once for the whole grid", () => {
    const scene = sceneWith({
      backgroundMode: "transparent",
      annotations: [{ id: "a1", type: "text", x: 0.1, y: 0.1, w: 0.3, h: 0, text: "Hi", color: "#fff", strokeWidth: 0, fontSize: 24 }],
      watermarkEnabled: true,
      watermarkText: "Mocksy",
      watermarkSize: 13,
      frameInstances: [instWith()]
    });
    const html = buildGridHtmlSnippet(scene, [
      { inst: scene.frameInstances[0]!, mediaHref: null, mediaType: null, overlayHref: null }
    ]);
    expect(html.match(/class="wm"/g)).toHaveLength(1);
    expect(html.match(/class="anno anno-text"/g)).toHaveLength(1);
  });
});

describe("exportHtml multi-frame", () => {
  it("downloads a live-CSS document for a multi-frame scene instead of a raster image", async () => {
    const l1 = layerWith({ id: "l1", mediaUrl: MEDIA });
    const l2 = layerWith({ id: "l2", mediaUrl: "data:image/png;base64,BBBB" });
    const scene = sceneWith({
      backgroundMode: "transparent",
      watermarkEnabled: false,
      layers: [l1, l2],
      frameInstances: [
        { id: "fi1", frame: "none", x: 0.3, y: 0.5, scale: 0.4, layerId: "l1" },
        { id: "fi2", frame: "none", x: 0.7, y: 0.5, scale: 0.4, layerId: "l2" }
      ]
    });
    const link = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("document", { createElement: (tag: string) => (tag === "a" ? link : undefined) });
    const createObjectURL = vi.fn((_blob: Blob) => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.useFakeTimers();

    await exportHtml(scene, "preview");
    await vi.advanceTimersByTimeAsync(300);

    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe("text/html;charset=utf-8");
    const html = await blob.text();
    expect(html.match(/class="frame-instance"/g)).toHaveLength(2);
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html).not.toContain('alt="Mocksy mockup"'); // no raster fallback image
    expect(link.download).toBe("mocksy-export.html");

    vi.useRealTimers();
  });
});

describe("exportHtml", () => {
  it("downloads a standalone HTML snippet for a single-frame scene", async () => {
    const scene = sceneWith({ frame: "none", backgroundMode: "transparent", watermarkEnabled: false });
    const link = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("document", { createElement: (tag: string) => (tag === "a" ? link : undefined) });
    const createObjectURL = vi.fn((_blob: Blob) => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.useFakeTimers();

    await exportHtml(scene, "preview");
    await vi.advanceTimersByTimeAsync(300);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe("text/html;charset=utf-8");
    const html = await blob.text();
    expect(html).toMatch(/^<!doctype html>/);
    // The demo media is a data: URL, so it embeds as-is without a fetch.
    expect(html).toContain('src="data:image/svg+xml');
    expect(link.href).toBe("blob:mock");
    expect(link.download).toBe("mocksy-export.html");
    expect(link.click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });
});
