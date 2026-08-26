import { afterEach, describe, expect, it, vi } from "vitest";
import { loadImage, clearImageCache, loadVideoFrame, drawFrameMediaFromLayer } from "@/lib/render/canvasMedia";
import { IMAGE_CACHE_LIMIT } from "@/lib/render/canvasMedia";

describe("loadImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearImageCache();
  });

  it("resolves with the image element on successful load", async () => {
    const loadCallbacks: Array<() => void> = [];
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        loadCallbacks.push(() => this.onload?.());
      }
    }
    vi.stubGlobal("Image", MockImage);
    const promise = loadImage("test.png");
    loadCallbacks[loadCallbacks.length - 1]?.();
    const img = await promise;
    expect(img).toBeDefined();
  });

  it("rejects with descriptive error on load failure", async () => {
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        this.onerror?.();
      }
    }
    vi.stubGlobal("Image", MockImage);
    await expect(loadImage("broken.png")).rejects.toThrow("Failed to load image: broken.png");
  });

  it("reuses the cached element for the same source", async () => {
    const instances: unknown[] = [];
    let fired = false;
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        instances.push(this);
      }
      set src(_v: string) {
        if (!fired) {
          fired = true;
          this.onload?.();
        }
      }
    }
    vi.stubGlobal("Image", MockImage);
    const first = await loadImage("shared.png");
    const second = await loadImage("shared.png");
    expect(second).toBe(first);
    expect(instances).toHaveLength(1);
  });

  it("evicts failed loads so they can be retried", async () => {
    let shouldFail = true;
    const callbacks: Array<() => void> = [];
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        callbacks.push(() => (shouldFail ? this.onerror?.() : this.onload?.()));
      }
    }
    vi.stubGlobal("Image", MockImage);
    const first = loadImage("flaky.png");
    callbacks[0]!();
    await expect(first).rejects.toThrow("Failed to load image: flaky.png");
    shouldFail = false;
    const second = loadImage("flaky.png");
    callbacks[1]!();
    await expect(second).resolves.toBeDefined();
    expect(callbacks).toHaveLength(2);
  });

  it("evicts the oldest entry when the cache exceeds its limit", async () => {
    const instances: unknown[] = [];
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        instances.push(this);
      }
      set src(_v: string) {
        // Auto-resolve: each load completes immediately.
        this.onload?.();
      }
    }
    vi.stubGlobal("Image", MockImage);

    // Overflow the cache by one so the very first entry (img-0) gets evicted.
    for (let i = 0; i <= IMAGE_CACHE_LIMIT; i++) {
      await loadImage(`img-${i}.png`);
    }

    // The evicted URL constructs a fresh Image when requested again.
    const before = instances.length;
    await loadImage("img-0.png");
    expect(instances.length).toBe(before + 1);
    // The most recent entry is still cached — no new instance.
    const recentBefore = instances.length;
    await loadImage(`img-${IMAGE_CACHE_LIMIT}.png`);
    expect(instances.length).toBe(recentBefore);
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
    const promise = loadVideoFrame("blob:vid");
    (video.onloadedmetadata as () => void)();
    expect(video.currentTime).toBe(0.001);
    (video.onseeked as () => void)();
    await expect(promise).resolves.toBe(video);
  });

  it("falls back to a small seek when the poster time is past the end", async () => {
    const video = mockVideo({ duration: 5 });
    stubDocumentWithVideo(video);
    const promise = loadVideoFrame("blob:vid", 99);
    (video.onloadedmetadata as () => void)();
    expect(video.currentTime).toBe(0.001);
    (video.onseeked as () => void)();
    await expect(promise).resolves.toBe(video);
  });

  it("rejects on load error", async () => {
    const video = mockVideo();
    stubDocumentWithVideo(video);
    const promise = loadVideoFrame("blob:bad");
    (video.onerror as () => void)();
    await expect(promise).rejects.toThrow("Failed to load video: blob:bad");
  });

  it("seeks near the start when the duration is unknown", async () => {
    const video = mockVideo({ duration: undefined });
    stubDocumentWithVideo(video);
    const promise = loadVideoFrame("blob:vid", 3);
    (video.onloadedmetadata as () => void)();
    expect(video.currentTime).toBe(0.001);
    (video.onseeked as () => void)();
    await expect(promise).resolves.toBe(video);
  });

  it("ignores a duplicate seeked event after settling", async () => {
    const video = mockVideo();
    stubDocumentWithVideo(video);
    const promise = loadVideoFrame("blob:vid");
    (video.onloadedmetadata as () => void)();
    (video.onseeked as () => void)();
    await expect(promise).resolves.toBe(video);
    expect(() => (video.onseeked as () => void)()).not.toThrow();
  });

  it("ignores a duplicate error event after settling", async () => {
    const video = mockVideo();
    stubDocumentWithVideo(video);
    const promise = loadVideoFrame("blob:bad");
    (video.onerror as () => void)();
    await expect(promise).rejects.toThrow("Failed to load video: blob:bad");
    expect(() => (video.onerror as () => void)()).not.toThrow();
  });

  it("rejects when metadata never loads instead of hanging forever", async () => {
    vi.useFakeTimers();
    try {
      const video = mockVideo({ remove: vi.fn() });
      stubDocumentWithVideo(video);
      const promise = loadVideoFrame("blob:stuck");
      const assertion = expect(promise).rejects.toThrow("Timed out loading video: blob:stuck");
      await vi.advanceTimersByTimeAsync(10_000);
      await assertion;
      expect(video.remove).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("sets crossOrigin to anonymous", async () => {
    const video = mockVideo();
    stubDocumentWithVideo(video);
    const promise = loadVideoFrame("blob:vid");
    (video.onloadedmetadata as () => void)();
    expect(video.crossOrigin).toBe("anonymous");
    (video.onseeked as () => void)();
    await promise;
  });

  it("sets muted and playsInline", async () => {
    const video = mockVideo();
    stubDocumentWithVideo(video);
    const promise = loadVideoFrame("blob:vid");
    (video.onloadedmetadata as () => void)();
    expect(video.muted).toBe(true);
    expect(video.playsInline).toBe(true);
    (video.onseeked as () => void)();
    await promise;
  });
});

describe("drawFrameMediaFromLayer", () => {
  function mockCtx(): CanvasRenderingContext2D {
    return {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      set fillStyle(_v: unknown) {}
    } as unknown as CanvasRenderingContext2D;
  }

  it("returns early when layer has no mediaUrl", async () => {
    const ctx = mockCtx();
    const box = { x: 0, y: 0, width: 400, height: 300, outerRadius: 0, innerX: 0, innerY: 0, innerW: 400, innerH: 300, innerRadius: 10 };
    await drawFrameMediaFromLayer(ctx, { id: "l1" } as any, box, 2);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it("returns early when layer is undefined", async () => {
    const ctx = mockCtx();
    const box = { x: 0, y: 0, width: 400, height: 300, outerRadius: 0, innerX: 0, innerY: 0, innerW: 400, innerH: 300, innerRadius: 10 };
    await drawFrameMediaFromLayer(ctx, undefined, box, 2);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it("loads and draws media for a layer with mediaUrl", async () => {
    vi.stubGlobal("Image", class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 800;
      height = 600;
      set src(_v: string) {
        this.onload?.();
      }
    } as any);
    const ctx = mockCtx();
    const box = { x: 0, y: 0, width: 400, height: 300, outerRadius: 0, innerX: 10, innerY: 10, innerW: 400, innerH: 300, innerRadius: 10 };
    await drawFrameMediaFromLayer(ctx, { id: "l1", mediaUrl: "test.png", mediaFit: "cover", mediaOffsetX: 0, mediaOffsetY: 0 } as any, box, 2);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.clip).toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("catches load failure without throwing", async () => {
    vi.stubGlobal("Image", class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        this.onerror?.();
      }
    } as any);
    const ctx = mockCtx();
    const box = { x: 0, y: 0, width: 400, height: 300, outerRadius: 0, innerX: 10, innerY: 10, innerW: 400, innerH: 300, innerRadius: 10 };
    await expect(drawFrameMediaFromLayer(ctx, { id: "l1", mediaUrl: "broken.png" } as any, box, 2)).resolves.toBeUndefined();
    vi.unstubAllGlobals();
  });

  it("uses contain fit mode", async () => {
    vi.stubGlobal("Image", class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 800;
      height = 600;
      set src(_v: string) {
        this.onload?.();
      }
    } as any);
    const ctx = mockCtx();
    const box = { x: 0, y: 0, width: 400, height: 300, outerRadius: 0, innerX: 10, innerY: 10, innerW: 400, innerH: 300, innerRadius: 10 };
    await drawFrameMediaFromLayer(ctx, { id: "l1", mediaUrl: "test.png", mediaFit: "contain", mediaOffsetX: 0, mediaOffsetY: 0 } as any, box, 2);
    expect(ctx.drawImage).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("applies mediaOffset for panning", async () => {
    vi.stubGlobal("Image", class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 800;
      height = 600;
      set src(_v: string) {
        this.onload?.();
      }
    } as any);
    const ctx = mockCtx();
    const box = { x: 0, y: 0, width: 400, height: 300, outerRadius: 0, innerX: 10, innerY: 10, innerW: 400, innerH: 300, innerRadius: 10 };
    await drawFrameMediaFromLayer(ctx, { id: "l1", mediaUrl: "test.png", mediaFit: "cover", mediaOffsetX: 0.5, mediaOffsetY: -0.5 } as any, box, 2);
    expect(ctx.drawImage).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("falls back to the box size for a zero-dimension image", async () => {
    vi.stubGlobal("Image", class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 0;
      height = 0;
      set src(_v: string) {
        this.onload?.();
      }
    } as any);
    const ctx = mockCtx();
    const box = { x: 0, y: 0, width: 400, height: 300, outerRadius: 0, innerX: 10, innerY: 10, innerW: 400, innerH: 300, innerRadius: 10 };
    await drawFrameMediaFromLayer(ctx, { id: "l1", mediaUrl: "zero-dim.png", mediaFit: "cover" } as any, box, 2);
    expect(ctx.drawImage).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("rotates the media when a rotation is set", async () => {
    vi.stubGlobal("Image", class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 800;
      height = 600;
      set src(_v: string) {
        this.onload?.();
      }
    } as any);
    const ctx = mockCtx();
    const box = { x: 0, y: 0, width: 400, height: 300, outerRadius: 0, innerX: 10, innerY: 10, innerW: 400, innerH: 300, innerRadius: 10 };
    await drawFrameMediaFromLayer(ctx, { id: "l1", mediaUrl: "test.png", mediaFit: "cover", rotation: 45 } as any, box, 2);
    expect(ctx.translate).toHaveBeenCalled();
    expect(ctx.rotate).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("defaults offsets to zero when omitted", async () => {
    vi.stubGlobal("Image", class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 800;
      height = 600;
      set src(_v: string) {
        this.onload?.();
      }
    } as any);
    const ctx = mockCtx();
    const box = { x: 0, y: 0, width: 400, height: 300, outerRadius: 0, innerX: 10, innerY: 10, innerW: 400, innerH: 300, innerRadius: 10 };
    await drawFrameMediaFromLayer(ctx, { id: "l1", mediaUrl: "test.png", mediaFit: "cover" } as any, box, 2);
    expect(ctx.drawImage).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("defaults the fit mode to cover when mediaFit is omitted", async () => {
    vi.stubGlobal("Image", class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 800;
      height = 600;
      set src(_v: string) {
        this.onload?.();
      }
    } as any);
    const ctx = mockCtx();
    const box = { x: 0, y: 0, width: 400, height: 300, outerRadius: 0, innerX: 10, innerY: 10, innerW: 400, innerH: 300, innerRadius: 10 };
    await drawFrameMediaFromLayer(ctx, { id: "l1", mediaUrl: "test.png" } as any, box, 2);
    expect(ctx.drawImage).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});