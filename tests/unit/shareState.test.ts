import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initialScene } from "@/lib/state/editorStore";
import { readSceneFromUrl, sceneToShareUrl } from "@/lib/state/shareState";
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
    const raw = decodeURIComponent(new URL(url).searchParams.get("scene") ?? "");
    expect(raw).not.toContain(DEMO_MEDIA_URL);
    stubLocation(url);
    const restored = readSceneFromUrl();
    expect(restored?.layers[0]!.mediaUrl).toBe(DEMO_MEDIA_URL);
    expect(restored?.frame).toBe("desktop");
  });

  it("keeps a non-demo media URL in the share link", () => {
    const scene = withLayer(initialScene, { mediaUrl: "blob:abc", mediaType: "image", mediaName: "shot.png" });
    const url = sceneToShareUrl(scene);
    const raw = decodeURIComponent(new URL(url).searchParams.get("scene") ?? "");
    expect(raw).toContain("blob:abc");
    stubLocation(url);
    const restored = readSceneFromUrl();
    expect(restored?.layers[0]!.mediaUrl).toBe("blob:abc");
  });
});
