import { describe, expect, it } from "vitest";
import { buildAnimationCss, buildHtmlSnippet, buildRasterHtmlSnippet, serializeCssProperties } from "@/lib/export/exportHtml";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";

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
    const scene = sceneWith();
    const html = buildHtmlSnippet(scene, { mediaHref: MEDIA, mediaType: "image", backgroundHref: null, overlayHref: null });
    expect(html).toContain("border-radius: 38px;");
    expect(html).toContain("object-fit: cover;");
    expect(html).toContain("transform: scale(1) translate(0px, 0px);");
  });

  it("embeds the background image and blur", () => {
    const scene = sceneWith({ backgroundMode: "image", backgroundImageUrl: "data:image/png;base64,IGNORED", backgroundBlur: 8 });
    const html = buildHtmlSnippet(scene, { mediaHref: null, mediaType: null, backgroundHref: BG, overlayHref: null });
    expect(html).toContain('<div class="bg"></div>');
    expect(html).toContain(`url("data:image/png;base64,BG")`);
    expect(html).toContain("filter: blur(8px);");
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
    expect(html).toContain('<div class="anno anno-text" style="left:10%;top:10%;width:30%;font-size:24px;color:#ffffff;font-family:Inter;font-weight:600;font-style:normal;text-align:left">Hi &lt;there&gt;</div>');
    expect(html).toContain('<span class="wm" style="right:16px;bottom:16px;font-size:13px">Mocksy</span>');
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
});

describe("buildRasterHtmlSnippet", () => {
  it("embeds the rasterized image", () => {
    const html = buildRasterHtmlSnippet(MEDIA);
    expect(html).toContain('<img src="data:image/png;base64,AAAA" alt="Mocksy mockup"/>');
  });
});
