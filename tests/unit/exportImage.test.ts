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

  vi.stubGlobal("window", { devicePixelRatio: 2 });
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
    vi.stubGlobal("window", { devicePixelRatio: 2 });
    vi.stubGlobal("HTMLCanvasElement", class {});
    vi.stubGlobal("HTMLVideoElement", class {});
    vi.stubGlobal("HTMLImageElement", class {});
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

  it("returns early when ClipboardItem is undefined", async () => {
    vi.stubGlobal("navigator", { clipboard: { write: vi.fn() } });
    vi.stubGlobal("ClipboardItem", undefined);
    const { copyPngToClipboard } = await import("@/lib/export/exportImage");
    const onError = vi.fn();
    await copyPngToClipboard(initialScene, "preview", onError);
    expect(onError).toHaveBeenCalledWith("Clipboard isn't available here (open over https or localhost).");
  });

  it("copies PNG to clipboard when APIs are available", async () => {
    let writtenBlob: Blob | null = null;
    vi.stubGlobal("window", { devicePixelRatio: 2 });
    vi.stubGlobal("HTMLCanvasElement", class {});
    vi.stubGlobal("HTMLVideoElement", class {});
    vi.stubGlobal("HTMLImageElement", class {});
    vi.stubGlobal("navigator", {
      clipboard: {
        write: vi.fn().mockImplementation((items: Array<{ items: Record<string, Blob> }>) => {
          writtenBlob = items[0]?.items?.["image/png"] as Blob;
          return Promise.resolve();
        })
      }
    });
    vi.stubGlobal("ClipboardItem", class {
      items: Record<string, Blob>;
      constructor(data: Record<string, Blob>) {
        this.items = data;
        for (const [k, v] of Object.entries(data)) {
          (this as Record<string, unknown>)[k] = v;
        }
      }
    });
    vi.stubGlobal("URL", { createObjectURL: () => "", revokeObjectURL: vi.fn() });
    const ctx: Record<string, unknown> = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
      drawImage: vi.fn(),
    };
    const setters = ["fillStyle", "font", "textAlign", "textBaseline", "strokeStyle", "shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY", "lineWidth", "lineCap", "filter"];
    for (const s of setters) {
      Object.defineProperty(ctx, s, { set: vi.fn(), get: () => "" });
    }
    vi.stubGlobal("document", {
      getElementById: () => ({
        clientWidth: 800,
        clientHeight: 600,
        querySelector: (sel: string) => {
          if (sel === "[data-mockup-frame]") return { offsetWidth: 400, offsetHeight: 300 };
          return null;
        }
      }),
      createElement: (tag: string) => {
        if (tag === "canvas") return {
          width: 1600,
          height: 1200,
          getContext: () => ctx,
          toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(["png"]))
        } as unknown as HTMLCanvasElement;
        return null;
      }
    });
    vi.stubGlobal("Image", class {
      onload: (() => void) | null = null;
      set src(_v: string) { setTimeout(() => this.onload?.(), 0); }
      naturalWidth = 100;
      naturalHeight = 100;
    });
    const { copyPngToClipboard } = await import("@/lib/export/exportImage");
    const onStatus = vi.fn();
    const onError = vi.fn();
    await copyPngToClipboard(initialScene, "preview", onError, onStatus);
    if (onError.mock.calls.length > 0) {
      throw new Error(`copyPngToClipboard onError: ${onError.mock.calls[0]![0]}`);
    }
    expect(writtenBlob).toBeInstanceOf(Blob);
    expect(onStatus).toHaveBeenCalledWith("Copied PNG to clipboard");
  });

  it("reports clipboard write failure through onError", async () => {
    vi.stubGlobal("window", { devicePixelRatio: 2 });
    vi.stubGlobal("HTMLCanvasElement", class {});
    vi.stubGlobal("HTMLVideoElement", class {});
    vi.stubGlobal("HTMLImageElement", class {});
    vi.stubGlobal("navigator", {
      clipboard: {
        write: vi.fn().mockRejectedValue(new Error("Permission denied"))
      }
    });
    vi.stubGlobal("ClipboardItem", class {
      items: Record<string, Blob>;
      constructor(data: Record<string, Blob>) { this.items = data; }
    });
    vi.stubGlobal("URL", { createObjectURL: () => "", revokeObjectURL: vi.fn() });
    const ctx: Record<string, unknown> = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
      drawImage: vi.fn(),
    };
    const setters = ["fillStyle", "font", "textAlign", "textBaseline", "strokeStyle", "shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY", "lineWidth", "lineCap", "filter"];
    for (const s of setters) {
      Object.defineProperty(ctx, s, { set: vi.fn(), get: () => "" });
    }
    vi.stubGlobal("document", {
      getElementById: () => ({
        clientWidth: 800,
        clientHeight: 600,
        querySelector: (sel: string) => {
          if (sel === "[data-mockup-frame]") return { offsetWidth: 400, offsetHeight: 300 };
          return null;
        }
      }),
      createElement: (tag: string) => {
        if (tag === "canvas") return {
          width: 1600,
          height: 1200,
          getContext: () => ctx,
          toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(["png"]))
        } as unknown as HTMLCanvasElement;
        return null;
      }
    });
    vi.stubGlobal("Image", class {
      onload: (() => void) | null = null;
      set src(_v: string) { setTimeout(() => this.onload?.(), 0); }
      naturalWidth = 100;
      naturalHeight = 100;
    });
    const { copyPngToClipboard } = await import("@/lib/export/exportImage");
    const onError = vi.fn();
    await copyPngToClipboard(initialScene, "preview", onError);
    expect(onError).toHaveBeenCalledWith("Permission denied");
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
    const { loadImage } = await import("@/lib/render/canvasMedia");
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
    const { loadImage } = await import("@/lib/render/canvasMedia");
    await expect(loadImage("broken.png")).rejects.toThrow("Failed to load image: broken.png");
  });
});

describe("loadVideoFrame", () => {
  function mockVideo(extra: Record<string, unknown> = {}) {
    const video: Record<string, unknown> = {
      src: "",
      crossOrigin: "",
      muted: false,
      playsInline: false,
      duration: 10,
      pause: vi.fn(),
      ...extra
    };
    return video;
  }

  function stubDocumentWithVideo(video: Record<string, unknown>) {
    vi.stubGlobal("document", {
      createElement: (tag: string) => (tag === "video" ? video : null)
    });
  }

  it("seeks to the requested poster time and resolves when the frame is ready", async () => {
    const video = mockVideo();
    stubDocumentWithVideo(video);
    const { loadVideoFrame } = await import("@/lib/render/canvasMedia");
    const promise = loadVideoFrame("blob:vid", 3);
    (video.onloadedmetadata as () => void)();
    expect(video.currentTime).toBe(3);
    (video.onseeked as () => void)();
    await expect(promise).resolves.toBe(video);
    expect(video.pause).toHaveBeenCalled();
  });

  it("seeks near the start when no poster time is set", async () => {
    const video = mockVideo();
    stubDocumentWithVideo(video);
    const { loadVideoFrame } = await import("@/lib/render/canvasMedia");
    const promise = loadVideoFrame("blob:vid");
    (video.onloadedmetadata as () => void)();
    expect(video.currentTime).toBe(0.001);
    (video.onseeked as () => void)();
    await expect(promise).resolves.toBe(video);
  });

  it("falls back to a small seek when the poster time is past the end", async () => {
    const video = mockVideo({ duration: 5 });
    stubDocumentWithVideo(video);
    const { loadVideoFrame } = await import("@/lib/render/canvasMedia");
    const promise = loadVideoFrame("blob:vid", 99);
    (video.onloadedmetadata as () => void)();
    expect(video.currentTime).toBe(0.001);
    (video.onseeked as () => void)();
    await expect(promise).resolves.toBe(video);
  });

  it("rejects on load error", async () => {
    const video = mockVideo();
    stubDocumentWithVideo(video);
    const { loadVideoFrame } = await import("@/lib/render/canvasMedia");
    const promise = loadVideoFrame("blob:bad");
    (video.onerror as () => void)();
    await expect(promise).rejects.toThrow("Failed to load video: blob:bad");
  });
});

describe("renderSceneToPngBlob multi-frame video", () => {
  it("loads a video frame element for video layers instead of decoding as an image", async () => {
    const videoEl: Record<string, unknown> = {
      src: "",
      crossOrigin: "",
      muted: false,
      playsInline: false,
      videoWidth: 320,
      videoHeight: 240,
      duration: 5,
      pause: vi.fn()
    };
    const autoFire = (name: string) =>
      Object.defineProperty(videoEl, name, {
        configurable: true,
        get: () => videoEl[`_${name}`],
        set(fn: unknown) {
          (videoEl as Record<string, unknown>)[`_${name}`] = fn;
          if (fn) queueMicrotask(() => (fn as () => void)());
        }
      });
    // Async load/seek events fire once attached; onerror must NOT auto-fire
    // (assigning the handler is what we're mimicking, not an actual failure).
    autoFire("onloadedmetadata");
    autoFire("onloadeddata");
    autoFire("onseeked");
    Object.defineProperty(videoEl, "onerror", {
      configurable: true,
      get: () => videoEl._onerror,
      set(fn: unknown) {
        (videoEl as Record<string, unknown>)._onerror = fn;
      }
    });

    const container = {
      clientWidth: 800,
      clientHeight: 600,
      querySelector: (sel: string) => (sel === "[data-mockup-frame]" ? { offsetWidth: 400, offsetHeight: 300 } : null)
    };
    const mockCanvas = {
      width: 800,
      height: 600,
      getContext: () => null,
      toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(["png"]))
    } as unknown as HTMLCanvasElement;
    vi.stubGlobal("document", {
      getElementById: (id: string) => (id === "preview" ? container : null),
      createElement: (tag: string) => (tag === "canvas" ? mockCanvas : tag === "video" ? videoEl : null)
    });
    vi.stubGlobal("window", { devicePixelRatio: 2 });
    vi.stubGlobal("HTMLVideoElement", class {});
    vi.stubGlobal("HTMLImageElement", class {});

    const videoLayer = {
      ...initialScene.layers[0]!,
      id: "vlayer",
      mediaUrl: "blob:vid",
      mediaType: "video",
      mediaName: "clip.mp4",
      videoPosterTime: 2
    } as MediaLayer;
    const scene: EditorScene = {
      ...initialScene,
      layers: [videoLayer],
      activeLayerId: "vlayer",
      frameInstances: [
        { id: "inst1", layerId: "vlayer", frame: "iphone15", x: 0.25, y: 0.5, scale: 0.4 },
        { id: "inst2", layerId: null, frame: "iphone15", x: 0.75, y: 0.5, scale: 0.4 }
      ]
    };

    const { renderSceneToPngBlob } = await import("@/lib/export/exportImage");
    const errors: string[] = [];
    const blob = await renderSceneToPngBlob(scene, "preview", (m) => errors.push(m));
    expect(errors, errors.join(" | ")).toEqual([]);
    expect(blob).toBeInstanceOf(Blob);
    expect(videoEl.currentTime).toBe(2);
    expect(videoEl.pause).toHaveBeenCalled();
  });
});

describe("renderSceneToPngBlob single-frame video fallback", () => {
  it("loads a video frame when the preview video is not decoded yet", async () => {
    const videoEl: Record<string, unknown> = {
      src: "",
      crossOrigin: "",
      muted: false,
      playsInline: false,
      videoWidth: 320,
      videoHeight: 240,
      duration: 5,
      pause: vi.fn()
    };
    const autoFire = (name: string) =>
      Object.defineProperty(videoEl, name, {
        configurable: true,
        get: () => videoEl[`_${name}`],
        set(fn: unknown) {
          (videoEl as Record<string, unknown>)[`_${name}`] = fn;
          if (fn) queueMicrotask(() => (fn as () => void)());
        }
      });
    autoFire("onloadedmetadata");
    autoFire("onloadeddata");
    autoFire("onseeked");
    Object.defineProperty(videoEl, "onerror", {
      configurable: true,
      get: () => videoEl._onerror,
      set(fn: unknown) {
        (videoEl as Record<string, unknown>)._onerror = fn;
      }
    });

    vi.stubGlobal("HTMLVideoElement", class {});
    vi.stubGlobal("HTMLImageElement", class {});
    // The preview <video> exists but hasn't decoded a frame yet (readyState < 2).
    const undecoded = Object.assign(new (vi.mocked(globalThis.HTMLVideoElement))(), { readyState: 1 });
    const container = {
      clientWidth: 800,
      clientHeight: 600,
      querySelector: (sel: string) => {
        if (sel === "video") return undecoded;
        if (sel === "[data-mockup-frame]") return { offsetWidth: 400, offsetHeight: 300 };
        return null;
      }
    };
    const mockCanvas = {
      width: 800,
      height: 600,
      getContext: () => null,
      toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(["png"]))
    } as unknown as HTMLCanvasElement;
    vi.stubGlobal("document", {
      getElementById: (id: string) => (id === "preview" ? container : null),
      createElement: (tag: string) => (tag === "canvas" ? mockCanvas : tag === "video" ? videoEl : null)
    });
    vi.stubGlobal("window", { devicePixelRatio: 2 });

    const videoLayer = {
      ...initialScene.layers[0]!,
      id: "vlayer",
      mediaUrl: "blob:vid",
      mediaType: "video",
      mediaName: "clip.mp4",
      videoPosterTime: 2
    } as MediaLayer;
    const scene: EditorScene = { ...initialScene, layers: [videoLayer], activeLayerId: "vlayer" };

    const { renderSceneToPngBlob } = await import("@/lib/export/exportImage");
    const errors: string[] = [];
    const blob = await renderSceneToPngBlob(scene, "preview", (m) => errors.push(m));
    expect(errors, errors.join(" | ")).toEqual([]);
    expect(blob).toBeInstanceOf(Blob);
    // The fallback decoded a frame through loadVideoFrame (seek + pause).
    expect(videoEl.currentTime).toBe(2);
    expect(videoEl.pause).toHaveBeenCalled();
  });
});
