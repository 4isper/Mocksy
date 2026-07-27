import { describe, expect, it, vi } from "vitest";
import { resolveExportTransform, waitForImage } from "@/lib/export/exportImage";
import { sampleVideoTransform } from "@/lib/render/videoComposer";
import { initialScene } from "@/lib/state/editorStore";
import type { AnimationPreset, EditorScene, MediaLayer } from "@/lib/types/editor";

function layer(overrides: Partial<MediaLayer> = {}): MediaLayer {
  return { ...initialScene.layers[0]!, id: overrides.id ?? "layer-test", ...overrides };
}

function sceneWith(preset: AnimationPreset, zoom = 1): EditorScene {
  const l = layer({ animationPreset: preset, zoom });
  return { ...initialScene, layers: [l], activeLayerId: l.id };
}

describe("resolveExportTransform", () => {
  it("uses the base zoom and media offset for a static (none) scene", () => {
    const scene = sceneWith("none", 1.4);
    scene.layers[0]!.mediaOffsetX = 0.5;
    scene.layers[0]!.mediaOffsetY = -0.25;
    expect(resolveExportTransform(scene)).toEqual({ zoom: 1.4, offsetX: 0.5, offsetY: -0.25 });
  });

  it("samples the mid-animation frame for zoomIn", () => {
    // zoomIn: 1 -> 1.12, so progress 0.5 lands between.
    const t = resolveExportTransform(sceneWith("zoomIn"));
    expect(t.zoom).toBeGreaterThan(1);
    expect(t.zoom).toBeLessThan(1.12);
  });

  it("samples the mid-animation frame for parallax (non-zero offset)", () => {
    const t = resolveExportTransform(sceneWith("parallax"));
    expect(t.offsetX).not.toBe(0);
    expect(t.offsetY).not.toBe(0);
  });

  it("matches the live preview transform at progress 0.5", () => {
    // The exported frame should coincide with the preview's mid-animation
    // sample so PNG and preview don't diverge in composition.
    const scene = sceneWith("zoomOut");
    const expected = sampleVideoTransform(scene.layers[0]!, 0.5);
    expect(resolveExportTransform(scene)).toEqual({
      zoom: expected.zoom,
      offsetX: expected.x,
      offsetY: expected.y
    });
  });
});

describe("waitForImage", () => {
  it("resolves immediately for an already-loaded image", async () => {
    const img = { complete: true, naturalWidth: 100 } as unknown as HTMLImageElement;
    await expect(waitForImage(img)).resolves.toBeUndefined();
  });

  it("resolves when the image loads", async () => {
    const img = {} as HTMLImageElement & { onload?: () => void };
    const promise = waitForImage(img);
    img.onload?.();
    await expect(promise).resolves.toBeUndefined();
  });

  it("rejects when the image errors", async () => {
    const img = {} as HTMLImageElement & { onerror?: () => void };
    const promise = waitForImage(img);
    img.onerror?.();
    await expect(promise).rejects.toThrow("Image load failed");
  });

  it("rejects on timeout if the image never loads", async () => {
    const img = {} as HTMLImageElement;
    const promise = waitForImage(img, 10);
    await expect(promise).rejects.toThrow("Image load timed out");
  });
});

// Mock DOM helpers for renderSceneToPngBlob tests
function setupDOMMocks({
  frameElement = true,
  containerSize = true,
  hasMedia = false,
  mediaType = "image",
  overlayPath = null,
  backgroundImageUrl = null
}: {
  frameElement?: boolean;
  containerSize?: boolean;
  hasMedia?: boolean;
  mediaType?: "image" | "video";
  overlayPath?: string | null;
  backgroundImageUrl?: string | null;
} = {}) {
  const elements = new Map<string, HTMLElement>();
  const container = {
    clientWidth: containerSize ? 800 : 0,
    clientHeight: containerSize ? 600 : 0,
    querySelector: (selector: string) => {
      if (selector === "video") return hasMedia && mediaType === "video" ? ({ readyState: 2 } as HTMLVideoElement) : null;
      if (selector === "img")
        return hasMedia && mediaType === "image"
          ? ({ complete: true, naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement)
          : null;
      if (selector === "[data-mockup-frame]")
        return frameElement ? ({ offsetWidth: 400, offsetHeight: 300 } as HTMLElement) : null;
      return null;
    }
  };

  const mockCanvas = {
    width: 800,
    height: 600,
    getContext: () => null,
    toBlob: (cb: (b: Blob | null) => void) => {
      const blob = new Blob(["test"], { type: "image/png" });
      cb(blob);
    }
  } as unknown as HTMLCanvasElement;

  vi.stubGlobal("document", {
    getElementById: (id: string) => (id === "preview" ? container : null),
    createElement: (tag: string) => {
      if (tag === "canvas") return mockCanvas;
      return null;
    }
  });

  vi.stubGlobal("Image", class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 100;
    naturalHeight = 100;
    width = 100;
    height = 100;
    set src(_v: string) {
      setTimeout(() => this.onload?.(), 0);
    }
  });
}

describe("renderSceneToPngBlob", () => {
  it("returns null when container not found", async () => {
    vi.stubGlobal("document", { getElementById: () => null, createElement: () => null });
    const { renderSceneToPngBlob } = await import("@/lib/export/exportImage");
    const result = await renderSceneToPngBlob(initialScene, "nonexistent");
    expect(result).toBeNull();
  });

  it("returns null when frame element not found", async () => {
    setupDOMMocks({ frameElement: false });
    const { renderSceneToPngBlob } = await import("@/lib/export/exportImage");
    const result = await renderSceneToPngBlob(initialScene, "preview");
    expect(result).toBeNull();
  });

  it("returns null when container has no size", async () => {
    setupDOMMocks({ containerSize: false, hasMedia: true });
    const { renderSceneToPngBlob } = await import("@/lib/export/exportImage");
    const result = await renderSceneToPngBlob(initialScene, "preview");
    expect(result).toBeNull();
  });

  it("returns null when canvas cannot produce blob", async () => {
    vi.stubGlobal("document", {
      getElementById: () => ({ clientWidth: 800, clientHeight: 600, querySelector: () => null }),
      createElement: () => ({
        width: 800,
        height: 600,
        getContext: () => null,
        toBlob: (cb: (b: Blob | null) => void) => cb(null)
      })
    });
    const { renderSceneToPngBlob } = await import("@/lib/export/exportImage");
    const result = await renderSceneToPngBlob({ ...initialScene, layers: [] } as any, "preview");
    expect(result).toBeNull();
  });
});

describe("copyPngToClipboard", () => {
  it("returns early when clipboard API unavailable", async () => {
    vi.stubGlobal("navigator", { clipboard: undefined });
    vi.stubGlobal("ClipboardItem", undefined);
    const { copyPngToClipboard } = await import("@/lib/export/exportImage");
    const onError = vi.fn();
    await copyPngToClipboard(initialScene, "preview", onError);
    expect(onError).toHaveBeenCalledWith("Clipboard isn't available here (open over https or localhost).");
  });
});

describe("loadImage", () => {
  it("resolves with image on successful load", async () => {
    const loadCallbacks: Array<() => void> = [];
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        const cb = () => this.onload?.();
        loadCallbacks.push(cb);
      }
    }
    vi.stubGlobal("Image", MockImage);
    const { loadImage } = await import("@/lib/export/renderMockup");
    const promise = loadImage("test.png");
    loadCallbacks[loadCallbacks.length - 1]?.();
    const img = await promise;
    expect(img).toBeDefined();
  });

  it("rejects on image load error", async () => {
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        this.onerror?.();
      }
    }
    vi.stubGlobal("Image", MockImage);
    const { loadImage } = await import("@/lib/export/renderMockup");
    await expect(loadImage("broken.png")).rejects.toThrow("Failed to load image: broken.png");
  });
});
