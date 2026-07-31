import { describe, expect, it, vi } from "vitest";
import { loadImage, loadVideoFrame, drawFrameMediaFromLayer } from "@/lib/render/canvasMedia";

describe("loadImage", () => {
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
    vi.unstubAllGlobals();
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
    vi.unstubAllGlobals();
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
});