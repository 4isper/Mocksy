// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_CREATE_BITMAP = globalThis.createImageBitmap;
const ORIGINAL_OFFSCREEN = (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: Array<{ data: Record<string, unknown>; transfer: Transferable[] }> = [];

  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(data: Record<string, unknown>, transfer?: Transferable[]) {
    this.sent.push({ data, transfer: transfer ?? [] });
  }
  /** Test hook: emulate the worker's reply. */
  respond(id: number, payload: { blob?: Blob; error?: string }) {
    this.onmessage?.({ data: { id, ...payload } } as MessageEvent);
  }
  terminate(): void {}
}

function makeCanvas(pixels: number): HTMLCanvasElement {
  const side = Math.ceil(Math.sqrt(pixels));
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  return canvas;
}

function stubGlobals({ bitmap }: { bitmap?: unknown }) {
  vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap ?? { width: 10, height: 10, close: () => {} }));
  (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = class {};
  vi.stubGlobal("Worker", FakeWorker);
}

// The helper caches its worker handle at module scope; a fresh module per test
// keeps the detection state isolated (e.g. after the no-Worker case).
let encodeCanvasToBlob: typeof import("@/lib/export/offthreadEncode").encodeCanvasToBlob;

beforeEach(async () => {
  FakeWorker.instances = [];
  vi.resetModules();
  ({ encodeCanvasToBlob } = await import("@/lib/export/offthreadEncode"));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal("createImageBitmap", ORIGINAL_CREATE_BITMAP);
  (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = ORIGINAL_OFFSCREEN;
  delete (globalThis as { Worker?: unknown }).Worker;
  vi.restoreAllMocks();
});

describe("encodeCanvasToBlob", () => {
  it("falls back to canvas.toBlob when workers are unavailable", async () => {
    // No Worker global at all.
    const blob = new Blob(["png"]);
    const canvas = makeCanvas(4_000_000);
    const toBlob = vi.fn((cb: (b: Blob | null) => void) => cb(blob));
    Object.defineProperty(canvas, "toBlob", { value: toBlob });

    const result = await encodeCanvasToBlob(canvas, "image/png");
    expect(result).toBe(blob);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png", undefined);
  });

  it("keeps small canvases on the main thread even with a worker available", async () => {
    stubGlobals({});
    const blob = new Blob(["small"]);
    const canvas = makeCanvas(250_000); // below the ~1MP threshold
    const toBlob = vi.fn((cb: (b: Blob | null) => void) => cb(blob));
    Object.defineProperty(canvas, "toBlob", { value: toBlob });

    const result = await encodeCanvasToBlob(canvas, "image/png");
    expect(result).toBe(blob);
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it("routes large canvases through the worker protocol and returns the blob", async () => {
    const expected = new Blob(["big-png"]);
    stubGlobals({});
    const canvas = makeCanvas(2_000_000);
    Object.defineProperty(canvas, "toBlob", {
      value: vi.fn(() => {
        throw new Error("must not use main-thread path");
      })
    });

    const promise = encodeCanvasToBlob(canvas, "image/png");
    // Let createImageBitmap resolve, then answer the worker message.
    await Promise.resolve();
    await Promise.resolve();
    const worker = FakeWorker.instances[0]!;
    expect(worker.sent).toHaveLength(1);
    const { id, mimeType } = worker.sent[0]!.data as { id: number; mimeType: string };
    expect(mimeType).toBe("image/png");
    // The bitmap must be transferred, not copied.
    expect(worker.sent[0]!.transfer.length).toBe(1);

    worker.respond(id, { blob: expected });
    await expect(promise).resolves.toBe(expected);
  });

  it("falls back to the main thread when the worker reports an error", async () => {
    const fallbackBlob = new Blob(["fallback"]);
    stubGlobals({});
    const canvas = makeCanvas(2_000_000);
    const toBlob = vi.fn((cb: (b: Blob | null) => void) => cb(fallbackBlob));
    Object.defineProperty(canvas, "toBlob", { value: toBlob });

    const promise = encodeCanvasToBlob(canvas, "image/webp");
    await Promise.resolve();
    await Promise.resolve();
    const worker = FakeWorker.instances[0]!;
    worker.respond(worker.sent[0]!.data.id as number, { error: "convert failed" });

    await expect(promise).resolves.toBe(fallbackBlob);
    expect(toBlob).toHaveBeenCalled();
  });
});
