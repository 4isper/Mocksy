// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { renderMockupToCanvasMock } = vi.hoisted(() => ({ renderMockupToCanvasMock: vi.fn() }));

vi.mock("@/lib/render/renderMockup", () => ({ renderMockupToCanvas: renderMockupToCanvasMock }));

import { buildRenderWorkerPayload, type RenderWorkerPayload } from "@/lib/render/renderWorkerProtocol";
import { initialScene } from "@/lib/state/editorScene";
import "@/lib/render/mockupRenderWorker";

const baseScene = () => ({
  ...initialScene,
  layers: [
    { ...initialScene.layers[0]!, id: "l1", mediaUrl: "data:image/png;base64,AAA" },
    { ...initialScene.layers[0]!, id: "l2", mediaUrl: "data:image/png;base64,BBB" }
  ],
  activeLayerId: "l1"
});

type FakeBitmap = { __bitmapFor: string };
const bitmapFor = (url: string) => ({ __bitmapFor: url }) as unknown as ImageBitmap;

const makePayload = (
  build: Partial<Parameters<typeof buildRenderWorkerPayload>[0]> = {},
  overrides: Partial<RenderWorkerPayload> = {}
): RenderWorkerPayload => {
  const payload = buildRenderWorkerPayload({
    id: 7,
    scene: baseScene(),
    width: 800,
    height: 600,
    pixelRatio: 2,
    mimeType: "image/png",
    ...build
  })!;
  return { ...payload, ...overrides };
};

const runWorkerMessage = async (payload: RenderWorkerPayload) => {
  const handler = (self as unknown as { onmessage: ((event: { data: RenderWorkerPayload }) => Promise<void>) | null })
    .onmessage;
  expect(handler).toBeTypeOf("function");
  await handler!({ data: payload });
};

describe("mockupRenderWorker", () => {
  const originalOnmessage = self.onmessage;
  const originalPostMessage = self.postMessage;
  const posted: unknown[] = [];
  const convertCalls: Array<{ type?: string } | undefined> = [];

  beforeEach(() => {
    posted.length = 0;
    convertCalls.length = 0;
    renderMockupToCanvasMock.mockReset();
    (self as unknown as { postMessage: (msg: unknown) => void }).postMessage = (msg: unknown) => {
      posted.push(msg);
    };
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        width: number;
        height: number;
        constructor(width: number, height: number) {
          this.width = width;
          this.height = height;
        }
        async convertToBlob(options?: { type?: string }): Promise<Blob> {
          convertCalls.push(options);
          return new Blob(["encoded"], { type: options?.type ?? "image/png" });
        }
      }
    );
  });

  afterEach(() => {
    (self as unknown as { onmessage: unknown }).onmessage = originalOnmessage;
    (self as unknown as { postMessage: unknown }).postMessage = originalPostMessage;
    vi.unstubAllGlobals();
  });

  const stubRasterDecoder = (failingUrls: string[] = []) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (failingUrls.includes(url)) return { ok: false, blob: async () => new Blob([]) };
        return { ok: true, blob: async () => new Blob(["pixels"], { type: "image/png" }) };
      })
    );
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async (blob: Blob) => bitmapFor(`bitmap:${(blob as Blob & { _text?: string }).size}`))
    );
  };

  it("renders a single-frame scene and posts the encoded blob", async () => {
    stubRasterDecoder();
    const skin = bitmapFor("/devices/iphone.svg");
    const payload = makePayload({}, { bitmaps: [{ url: "/devices/iphone.svg", bitmap: skin }] });

    await runWorkerMessage(payload);

    expect(renderMockupToCanvasMock).toHaveBeenCalledTimes(1);
    const args = renderMockupToCanvasMock.mock.calls[0] as unknown[];
    const canvas = args[0] as { width: number; height: number };
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
    // Active media came through fetch+createImageBitmap; the skin through the
    // pre-decoded slot (workers cannot rasterize SVG themselves).
    expect(args[2]).toMatchObject({ __bitmapFor: expect.any(String) });
    expect(args[10]).toBe(skin);
    expect(args[14]).toBe("l1");
    const layerMedias = args[12] as Map<string, unknown>;
    // Single-frame slots are keyed by layer id; the `media` argument mirrors
    // the active layer's entry.
    expect(layerMedias.get("l1")).toBe(args[2]);
    expect(layerMedias.get("l2")).toBeTruthy();
    expect(args[13]).toBeUndefined();
    expect(convertCalls[0]).toEqual({ type: "image/png" });
    expect(posted).toEqual([expect.objectContaining({ id: 7, blob: expect.any(Blob) })]);
    // Both layers' media slots were fetched; the SVG skin arrived pre-decoded.
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("partitions multi-frame slots into per-layer media and skins", async () => {
    stubRasterDecoder();
    const s = baseScene();
    s.frameInstances = [
      { id: "f1", frame: "iphone16pro", x: 0.25, y: 0.5, scale: 0.4, layerId: "l1" },
      { id: "f2", frame: "macbook", x: 0.75, y: 0.5, scale: 0.4, layerId: "l2" }
    ];
    const skin1 = bitmapFor("/devices/iphone16pro.svg");
    const skin2 = bitmapFor("/devices/macbook.svg");
    const payload = makePayload(
      { scene: s as never },
      {
        bitmaps: [
          { url: "/devices/iphone16pro.svg", bitmap: skin1 },
          { url: "/devices/macbook.svg", bitmap: skin2 }
        ]
      }
    );

    await runWorkerMessage(payload);

    const args = renderMockupToCanvasMock.mock.calls[0] as unknown[];
    const layerMedias = args[12] as Map<string, FakeBitmap>;
    const frameOverlays = args[13] as Map<string, FakeBitmap>;
    expect(new Set(layerMedias.keys())).toEqual(new Set(["l1", "l2"]));
    expect(frameOverlays.get("f1")).toBe(skin1);
    expect(frameOverlays.get("f2")).toBe(skin2);
    // The `media` argument mirrors the active layer's map entry (l1 here).
    expect(args[2]).toBe(layerMedias.get("l1"));
  });

  it("degrades optional background/watermark decode failures to null", async () => {
    stubRasterDecoder(["data:image/jpeg;base64,CCC"]);
    const payload = makePayload(
      {},
      { backgroundImageUrl: "data:image/jpeg;base64,CCC", watermarkImageUrl: null }
    );

    await runWorkerMessage(payload);

    expect(posted).toEqual([expect.objectContaining({ id: 7, blob: expect.any(Blob) })]);
    const args = renderMockupToCanvasMock.mock.calls[0] as unknown[];
    expect(args[11]).toBeNull();
  });

  it("fails loudly when an SVG asset was not pre-decoded", async () => {
    stubRasterDecoder();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, blob: async () => new Blob(["<svg/>"], { type: "image/svg+xml" }) }))
    );
    const payload = makePayload();

    await runWorkerMessage(payload);

    expect(renderMockupToCanvasMock).not.toHaveBeenCalled();
    expect(posted).toEqual([{ id: 7, error: expect.stringContaining("not pre-decoded") }]);
  });

  it("fails loudly when an asset fetch fails", async () => {
    stubRasterDecoder(["data:image/png;base64,AAA"]);
    const payload = makePayload();

    await runWorkerMessage(payload);

    expect(renderMockupToCanvasMock).not.toHaveBeenCalled();
    expect(posted).toEqual([{ id: 7, error: expect.stringContaining("Failed to fetch render asset") }]);
  });

  it("posts a generic error for non-Error decode failures", async () => {
    stubRasterDecoder();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => Promise.reject("boom")));
    const payload = makePayload();

    await runWorkerMessage(payload);

    expect(renderMockupToCanvasMock).not.toHaveBeenCalled();
    expect(posted).toEqual([{ id: 7, error: "Render failed" }]);
  });
});
