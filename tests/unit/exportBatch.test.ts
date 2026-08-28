import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { batchEntryName, exportVideoBatchZip, padIndex } from "@/lib/export/exportBatch";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene, FrameInstance, MediaLayer } from "@/lib/types/editor";

describe("padIndex", () => {
  it("pads to the width of the total count", () => {
    expect(padIndex(1, 9)).toBe("1");
    expect(padIndex(3, 10)).toBe("03");
    expect(padIndex(12, 100)).toBe("012");
    expect(padIndex(7, 7)).toBe("7");
  });

  it("never returns an empty string", () => {
    expect(padIndex(1, 0)).toBe("1");
  });
});

describe("batchEntryName", () => {
  it("combines the prefix, padded index and frame id", () => {
    expect(batchEntryName("iphone15", 2, 12)).toBe("mocksy-export-02-iphone15.png");
    expect(batchEntryName("macbook", 1, 4)).toBe("mocksy-export-1-macbook.png");
  });

  it("strips non ascii-safe characters from the frame id", () => {
    // @ts-expect-error exercising the sanitizer with a hostile value
    expect(batchEntryName("we!rd@frame", 1, 2)).toBe("mocksy-export-1-werdframe.png");
  });

  it("honors the extension override for video entries", () => {
    expect(batchEntryName("iphone15", 2, 12, "mp4")).toBe("mocksy-export-02-iphone15.mp4");
    expect(batchEntryName("watch", 1, 3, "webm")).toBe("mocksy-export-1-watch.webm");
  });
});

const captureWebmWithRetry = vi.fn();
vi.mock("@/lib/export/exportVideoCore", () => ({
  captureWebmWithRetry: (...args: unknown[]) => captureWebmWithRetry(...args),
  getFfmpegInstance: vi.fn(),
  cleanupFfmpegTempFiles: vi.fn(),
  QUALITY: { low: { qscale: 10 }, medium: { qscale: 5 }, high: { qscale: 2 } },
  activeLayerOf: (scene: EditorScene, id?: string | null) =>
    scene.layers.find((l) => l.id === (id ?? scene.activeLayerId)) ?? scene.layers[0] ?? null
}));

const downloadBlob = vi.fn();
vi.mock("@/lib/export/downloadBlob", () => ({
  downloadBlob: (...args: unknown[]) => downloadBlob(...args)
}));

const zipEntries: Array<{ name: string; blob: Blob }> = [];
const generateAsync = vi.fn(async () => new Blob(["zip"], { type: "application/zip" }));
vi.mock("jszip", () => ({
  default: class {
    file(name: string, data: Blob | Uint8Array) {
      zipEntries.push({
        name,
        blob: data instanceof Blob ? data : new Blob([data as unknown as BlobPart])
      });
    }
    generateAsync = generateAsync;
  }
}));

function sceneWithInstances(): EditorScene {
  const base = initialScene;
  const layerA = base.layers[0] as MediaLayer;
  const layerB: MediaLayer = { ...layerA, id: "l2" };
  const inst = (id: string, frame: FrameInstance["frame"], layerId: string): FrameInstance => ({
    id,
    frame,
    x: 0.25,
    y: 0.5,
    scale: 0.4,
    layerId
  });
  return {
    ...base,
    layers: [layerA, layerB],
    frameInstances: [inst("a", "iphone15", "l1"), inst("b", "macbook", "l2")]
  };
}

describe("exportVideoBatchZip", () => {
  beforeEach(() => {
    zipEntries.length = 0;
    generateAsync.mockClear();
    captureWebmWithRetry.mockReset();
    downloadBlob.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports an error when the scene has no frame instances", async () => {
    const onError = vi.fn();
    await exportVideoBatchZip(initialScene, "out", onError);
    expect(onError).toHaveBeenCalledWith("Multi-frame mode is off — there is nothing to batch.");
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("archives one WebM per instance with stable entry names", async () => {
    captureWebmWithRetry.mockResolvedValue(new Blob(["webm"], { type: "video/webm" }));
    const onProgress = vi.fn();
    await exportVideoBatchZip(sceneWithInstances(), "out", undefined, "webm", undefined, null, onProgress);

    expect(captureWebmWithRetry).toHaveBeenCalledTimes(2);
    expect(zipEntries.map((e) => e.name)).toEqual([
      "mocksy-export-1-iphone15.webm",
      "mocksy-export-2-macbook.webm"
    ]);
    // Each instance is captured as a single-frame scene variant scoped to its
    // own layer.
    const firstCall = captureWebmWithRetry.mock.calls[0] as unknown[];
    const variant = firstCall[0] as EditorScene;
    expect(variant.frameInstances).toHaveLength(1);
    expect(variant.frameInstances[0]!.id).toBe("a");
    expect(onProgress).toHaveBeenCalledWith(1, 2);
    expect(onProgress).toHaveBeenCalledWith(2, 2);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [, archiveName] = downloadBlob.mock.calls[0] as unknown[];
    expect(archiveName).toBe("out-webm.zip");
  });

  it("aborts the remaining captures when the signal fires", async () => {
    captureWebmWithRetry.mockImplementation(async (_scene, _scale, _s, _p, _c, _a, signal) => {
      signal?.throwIfAborted();
      return new Blob(["webm"], { type: "video/webm" });
    });
    const controller = new AbortController();
    controller.abort();

    await exportVideoBatchZip(sceneWithInstances(), "out", undefined, "webm", undefined, null, undefined, controller.signal);

    expect(captureWebmWithRetry).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("surfaces capture failures through onError", async () => {
    captureWebmWithRetry.mockResolvedValue(new Blob([""]));
    const onError = vi.fn();
    await exportVideoBatchZip(sceneWithInstances(), "out", onError);
    expect(onError).toHaveBeenCalledWith("Recording produced no frames.");
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
