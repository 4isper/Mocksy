import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initialScene } from "@/lib/state/editorStore";
import { readSceneFromUrl, readSharedSceneFromUrl, sceneToShareUrl } from "@/lib/state/shareState";
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

/** Builds a share link and feeds it back as the current location (the URL
 *  derives from window.location.href). */
async function publish(scene: EditorScene): Promise<string> {
  const url = await sceneToShareUrl(scene);
  stubLocation(url);
  return url;
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

  it("round-trips a scene through a compressed share URL", async () => {
    const scene: EditorScene = { ...initialScene, frame: "desktop", watermarkText: "Demo" };
    const url = await publish(scene);
    expect(url).toContain("scene=z.");
    const restored = await readSharedSceneFromUrl();
    expect(restored).not.toBeNull();
    expect(restored?.frame).toBe("desktop");
    expect(restored?.watermarkText).toBe("Demo");
  });

  it("returns null when no scene param is present", async () => {
    stubLocation("https://mocksy.test/?other=value");
    expect(await readSharedSceneFromUrl()).toBeNull();
  });

  it("returns null for malformed scene param", async () => {
    stubLocation("https://mocksy.test/?scene=not-json");
    expect(await readSharedSceneFromUrl()).toBeNull();
  });

  it("omits the demo data: media from the share URL but restores it on read", async () => {
    const scene = withLayer(initialScene, { mediaUrl: DEMO_MEDIA_URL, mediaType: "image", mediaName: "mocksy-demo.svg" });
    scene.frame = "desktop";
    const url = await publish(scene);
    const raw = new URL(url).searchParams.get("scene") ?? "";
    expect(raw).not.toContain(DEMO_MEDIA_URL);
    const restored = await readSharedSceneFromUrl();
    expect(restored?.layers[0]!.mediaUrl).toBe(DEMO_MEDIA_URL);
    expect(restored?.frame).toBe("desktop");
  });

  it("keeps a non-demo media URL in the share link", async () => {
    const scene = withLayer(initialScene, { mediaUrl: "blob:abc", mediaType: "image", mediaName: "shot.png" });
    const url = await publish(scene);
    // Compressed payloads are opaque base64 — verify via the reader instead.
    const restored = await readSharedSceneFromUrl();
    expect(new URL(url).searchParams.get("scene")).toMatch(/^z\./);
    expect(restored?.layers[0]!.mediaUrl).toBe("blob:abc");
  });

  it("embeds a data:-URL media so the share link works on another device", async () => {
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";
    const scene = withLayer(initialScene, { mediaUrl: dataUrl, mediaType: "image", mediaName: "shot.png" });
    await publish(scene);
    const restored = await readSharedSceneFromUrl();
    expect(restored?.layers[0]!.mediaUrl).toBe(dataUrl);
  });

  it("compresses repetitive scenes well below the raw JSON size", async () => {
    const scene: EditorScene = { ...initialScene, watermarkText: "Mocksy watermark".repeat(20) };
    const raw = JSON.stringify(scene);
    const url = await sceneToShareUrl(scene);
    const param = new URL(url).searchParams.get("scene") ?? "";
    expect(param.startsWith("z.")).toBe(true);
    // Deflate should crush the repetitive JSON to a fraction of its raw size
    // even after base64url's 4/3 overhead.
    expect(param.length).toBeLessThan(raw.length / 2);
  });

  it("falls back to the legacy raw-JSON link when CompressionStream is missing", async () => {
    const CS = globalThis.CompressionStream;
    // @ts-expect-error simulating an older browser without compression support
    delete globalThis.CompressionStream;
    try {
      const scene: EditorScene = { ...initialScene, frame: "desktop" };
      const url = await sceneToShareUrl(scene);
      const param = new URL(url).searchParams.get("scene") ?? "";
      // Raw JSON, encoded exactly once by URLSearchParams.
      expect(param).toContain('"frame":"desktop"');
      expect(param).not.toContain("%7B");
      stubLocation(url);
      const restored = await readSharedSceneFromUrl();
      expect(restored?.frame).toBe("desktop");
      // The legacy sync reader also handles this format.
      expect(readSceneFromUrl()?.frame).toBe("desktop");
    } finally {
      globalThis.CompressionStream = CS!;
    }
  });

  it("reads legacy double-encoded share links", () => {
    // Links created before the encoding fix carried encodeURIComponent(JSON).
    const legacy = encodeURIComponent(JSON.stringify({ ...initialScene, frame: "desktop" }));
    stubLocation(`https://mocksy.test/?scene=${encodeURIComponent(legacy)}`);
    const restored = readSceneFromUrl();
    expect(restored?.frame).toBe("desktop");
  });

  it("ignores compressed params in the legacy sync reader", async () => {
    const scene: EditorScene = { ...initialScene, frame: "tablet" };
    await publish(scene);
    // Sync reader predates compression; the bootstrap uses the async one.
    expect(readSceneFromUrl()).toBeNull();
    expect((await readSharedSceneFromUrl())?.frame).toBe("tablet");
  });

  it("throws when the share URL exceeds the practical length limit", async () => {
    // Random (incompressible) payload mimicking real image data: deflate can't
    // shrink it enough to fit the budget.
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const largePayload = Array.from({ length: 40000 }, () => alphabet[Math.floor(rand() * alphabet.length)]).join("");
    const scene = withLayer(initialScene, { mediaUrl: `data:image/png;base64,${largePayload}`, mediaType: "image", mediaName: "large.png" });
    await expect(sceneToShareUrl(scene)).rejects.toThrow("Share link is too large");
  });

  it("restores demo media when scene has no media layer", async () => {
    const scene = { ...initialScene, layers: [{ ...initialScene.layers[0]!, mediaUrl: null, mediaType: "none" as const }] };
    await publish(scene);
    const restored = await readSharedSceneFromUrl();
    expect(restored?.layers[0]!.mediaUrl).toContain("data:image/svg");
  });

  it("handles mixed demo and non-demo layers in share URL", async () => {
    const scene: EditorScene = {
      ...initialScene,
      layers: [
        { ...makeDemoLayer(), id: "a", mediaUrl: DEMO_MEDIA_URL, mediaType: "image" },
        { ...makeDemoLayer(), id: "b", mediaUrl: "blob:abc", mediaType: "image", mediaName: "shot.png" }
      ],
      activeLayerId: "a"
    };
    await publish(scene);
    const restored = await readSharedSceneFromUrl();
    expect(restored?.layers.find((l) => l.id === "a")!.mediaUrl).toBe(DEMO_MEDIA_URL);
    expect(restored?.layers.find((l) => l.id === "b")!.mediaUrl).toBe("blob:abc");
  });

  it("does not resurrect demo in a genuinely cleared layer next to real media", async () => {
    const scene: EditorScene = {
      ...initialScene,
      layers: [
        { ...makeDemoLayer(), id: "a", mediaUrl: DEMO_MEDIA_URL, mediaType: "image" },
        { ...makeDemoLayer(), id: "b", mediaUrl: "blob:abc", mediaType: "image", mediaName: "shot.png" },
        { ...makeDemoLayer(), id: "c", mediaUrl: null, mediaType: "none" as const, mediaName: null }
      ],
      activeLayerId: "a"
    };
    await publish(scene);
    const restored = await readSharedSceneFromUrl();
    expect(restored?.layers.find((l) => l.id === "a")!.mediaUrl).toBe(DEMO_MEDIA_URL);
    expect(restored?.layers.find((l) => l.id === "b")!.mediaUrl).toBe("blob:abc");
    expect(restored?.layers.find((l) => l.id === "c")!.mediaUrl).toBeNull();
  });
});
