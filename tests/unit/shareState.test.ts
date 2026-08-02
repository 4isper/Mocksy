import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initialScene } from "@/lib/state/editorStore";
import { readSceneFromUrl, sceneToShareUrl } from "@/lib/state/shareState";
import { makeDemoLayer } from "@/lib/state/editorHelpers";
import { DEMO_MEDIA_URL } from "@/lib/media/demoMedia";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";

const ORIGINAL_WINDOW = globalThis.window;
let currentHref = "https://mocksy.test/";

function stubLocation(href: string) {
  currentHref = href;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { get href() { return currentHref; } } }
  });
}

function withLayer(scene: EditorScene, layer: Partial<MediaLayer>): EditorScene {
  const base: MediaLayer = { ...initialScene.layers[0]!, id: layer.id ?? "layer-test", ...layer };
  return { ...scene, layers: [base], activeLayerId: base.id };
}

describe("shareState", () => {
  beforeEach(() => {
    stubLocation("https://mocksy.test/");
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: ORIGINAL_WINDOW
    });
  });

  it("round-trips a scene through a share URL", () => {
    const scene: EditorScene = { ...initialScene, frame: "desktop", watermarkText: "Demo" };
    const url = sceneToShareUrl(scene);
    expect(url).toContain("scene=");
    // sceneToShareUrl derives the URL from window.location.href, so the
    // produced URL must be fed back as the current location for readSceneFromUrl.
    stubLocation(url);
    const restored = readSceneFromUrl();
    expect(restored).not.toBeNull();
    expect(restored?.frame).toBe("desktop");
    expect(restored?.watermarkText).toBe("Demo");
  });

  it("returns null when no scene param is present", () => {
    stubLocation("https://mocksy.test/?other=value");
    expect(readSceneFromUrl()).toBeNull();
  });

  it("returns null for malformed scene param", () => {
    stubLocation("https://mocksy.test/?scene=not-json");
    expect(readSceneFromUrl()).toBeNull();
  });

  it("omits the demo data: media from the share URL but restores it on read", () => {
    const scene = withLayer(initialScene, { mediaUrl: DEMO_MEDIA_URL, mediaType: "image", mediaName: "mocksy-demo.svg" });
    scene.frame = "desktop";
    const url = sceneToShareUrl(scene);
    const raw = new URL(url).searchParams.get("scene") ?? "";
    expect(raw).not.toContain(DEMO_MEDIA_URL);
    stubLocation(url);
    const restored = readSceneFromUrl();
    expect(restored?.layers[0]!.mediaUrl).toBe(DEMO_MEDIA_URL);
    expect(restored?.frame).toBe("desktop");
  });

  it("keeps a non-demo media URL in the share link", () => {
    const scene = withLayer(initialScene, { mediaUrl: "blob:abc", mediaType: "image", mediaName: "shot.png" });
    const url = sceneToShareUrl(scene);
    const raw = new URL(url).searchParams.get("scene") ?? "";
    expect(raw).toContain("blob:abc");
    stubLocation(url);
    const restored = readSceneFromUrl();
    expect(restored?.layers[0]!.mediaUrl).toBe("blob:abc");
  });

  it("embeds a data:-URL media so the share link works on another device", () => {
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";
    const scene = withLayer(initialScene, { mediaUrl: dataUrl, mediaType: "image", mediaName: "shot.png" });
    const url = sceneToShareUrl(scene);
    const raw = new URL(url).searchParams.get("scene") ?? "";
    expect(raw).toContain(dataUrl);
    stubLocation(url);
    const restored = readSceneFromUrl();
    expect(restored?.layers[0]!.mediaUrl).toBe(dataUrl);
  });

  it("encodes the scene payload only once", () => {
    const scene: EditorScene = { ...initialScene, frame: "desktop" };
    const url = sceneToShareUrl(scene);
    const raw = new URL(url).searchParams.get("scene") ?? "";
    // The decoded param is raw JSON — URLSearchParams did the only encoding.
    expect(raw).toContain('"frame":"desktop"');
    expect(raw).not.toContain("%7B");
    expect(raw).not.toContain("%22");
  });

  it("reads legacy double-encoded share links", () => {
    // Links created before the encoding fix carried encodeURIComponent(JSON).
    const legacy = encodeURIComponent(JSON.stringify({ ...initialScene, frame: "desktop" }));
    stubLocation(`https://mocksy.test/?scene=${encodeURIComponent(legacy)}`);
    const restored = readSceneFromUrl();
    expect(restored?.frame).toBe("desktop");
  });

  it("throws when the share URL exceeds the practical length limit", () => {
    // A large uploaded image that can't meaningfully travel in a URL.
    const largePayload = "a".repeat(20000);
    const dataUrl = `data:image/png;base64,${largePayload}`;
    const scene = withLayer(initialScene, { mediaUrl: dataUrl, mediaType: "image", mediaName: "large.png" });
    expect(() => sceneToShareUrl(scene)).toThrow("Share link is too large");
  });

  it("restores demo media when scene has no media layer", () => {
    const scene = { ...initialScene, layers: [{ ...initialScene.layers[0]!, mediaUrl: null, mediaType: "none" as const }] };
    const url = sceneToShareUrl(scene);
    stubLocation(url);
    const restored = readSceneFromUrl();
    expect(restored?.layers[0]!.mediaUrl).toContain("data:image/svg");
  });

  it("handles mixed demo and non-demo layers in share URL", () => {
    const scene: EditorScene = {
      ...initialScene,
      layers: [
        { ...makeDemoLayer(), id: "a", mediaUrl: DEMO_MEDIA_URL, mediaType: "image" },
        { ...makeDemoLayer(), id: "b", mediaUrl: "blob:abc", mediaType: "image", mediaName: "shot.png" }
      ],
      activeLayerId: "a"
    };
    const url = sceneToShareUrl(scene);
    const raw = new URL(url).searchParams.get("scene") ?? "";
    expect(raw).not.toContain(DEMO_MEDIA_URL);
    expect(raw).toContain("blob:abc");
    stubLocation(url);
    const restored = readSceneFromUrl();
    expect(restored?.layers.find((l) => l.id === "a")!.mediaUrl).toBe(DEMO_MEDIA_URL);
    expect(restored?.layers.find((l) => l.id === "b")!.mediaUrl).toBe("blob:abc");
  });
});
