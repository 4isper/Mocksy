import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { batchEntryName, exportBatchZip, exportVideoBatchZip, padIndex } from "@/lib/export/exportBatch";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene, FrameInstance, MediaLayer } from "@/lib/types/editor";

const renderPng = vi.fn();
vi.mock("@/lib/export/exportImage", () => ({
  renderSceneToPngBlob: (...args: unknown[]) => renderPng(...args)
}));

const downloadBlob = vi.fn();
vi.mock("@/lib/export/downloadBlob", () => ({
  downloadBlob: (...args: unknown[]) => downloadBlob(...args)
}));

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
const getFfmpegInstance = vi.fn();
const cleanupFfmpegTempFiles = vi.fn();
vi.mock("@/lib/export/exportVideoCore", () => ({
  captureWebmWithRetry: (...args: unknown[]) => captureWebmWithRetry(...args),
  getFfmpegInstance: (...args: unknown[]) => getFfmpegInstance(...args),
  cleanupFfmpegTempFiles: (...args: unknown[]) => cleanupFfmpegTempFiles(...args),
  QUALITY: { low: { crf: 26 }, medium: { crf: 20 }, high: { crf: 16 } },
  activeLayerOf: (scene: EditorScene, id?: string | null) =>
    scene.layers.find((l) => l.id === (id ?? scene.activeLayerId)) ?? scene.layers[0] ?? null
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
    getFfmpegInstance.mockReset();
    cleanupFfmpegTempFiles.mockReset();
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

  function fakeFfmpeg({
    exec = 0,
    readFileBytes = new Uint8Array([1, 2, 3])
  }: { exec?: number; readFileBytes?: Uint8Array | string } = {}) {
    return {
      writeFile: vi.fn().mockResolvedValue(undefined),
      exec: vi.fn().mockResolvedValue(exec),
      readFile: vi.fn().mockResolvedValue(readFileBytes),
      deleteFile: vi.fn().mockResolvedValue(undefined)
    };
  }

  it("transcodes each clip to MP4 through FFmpeg and archives the bytes", async () => {
    getFfmpegInstance.mockResolvedValue(fakeFfmpeg());
    captureWebmWithRetry.mockResolvedValue(new Blob(["webm"], { type: "video/webm" }));
    const onError = vi.fn();
    await exportVideoBatchZip(sceneWithInstances(), "out", onError, "mp4");

    expect(onError, onError.mock.calls.map((c) => c[0]).join(" | ")).not.toHaveBeenCalled();
    expect(zipEntries.map((e) => e.name)).toEqual([
      "mocksy-export-1-iphone15.mp4",
      "mocksy-export-2-macbook.mp4"
    ]);
    // The singleton is loaded once and shared across both instances.
    expect(getFfmpegInstance).toHaveBeenCalledTimes(1);
    const ffmpeg = await getFfmpegInstance();
    expect(ffmpeg.writeFile).toHaveBeenCalledTimes(2);
    // Each clip transcodes webm -> h264 with the layer's quality CRF
    // (medium -> 20) and faststart for progressive playback.
    const firstArgs = ffmpeg.exec.mock.calls[0]![0] as string[];
    expect(firstArgs).toContain("-i");
    expect(firstArgs).toContain("-c:v");
    expect(firstArgs).toContain("libx264");
    expect(firstArgs).toContain("-crf");
    expect(firstArgs[firstArgs.indexOf("-crf") + 1]).toBe("20");
    expect(firstArgs).toContain("-movflags");
    expect(ffmpeg.readFile).toHaveBeenCalledTimes(2);
    const [, files] = cleanupFfmpegTempFiles.mock.calls[0] as unknown as [unknown, string[]];
    expect(files).toEqual([expect.stringMatching(/^input-.*\.webm$/), expect.stringMatching(/^mocksy-batch-.*\.mp4$/)]);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [, archiveName] = downloadBlob.mock.calls[0] as unknown[];
    expect(archiveName).toBe("out-mp4.zip");
  });

  it("reuses the loaded FFmpeg instance across instances", async () => {
    getFfmpegInstance.mockResolvedValue(fakeFfmpeg());
    captureWebmWithRetry.mockResolvedValue(new Blob(["webm"], { type: "video/webm" }));
    await exportVideoBatchZip(sceneWithInstances(), "out", undefined, "mp4");
    expect(getFfmpegInstance).toHaveBeenCalledTimes(1);
  });

  it("handles ffmpeg readFile returning a string", async () => {
    getFfmpegInstance.mockResolvedValue(fakeFfmpeg({ readFileBytes: "abc" }));
    captureWebmWithRetry.mockResolvedValue(new Blob(["webm"], { type: "video/webm" }));
    await exportVideoBatchZip(sceneWithInstances(), "out", undefined, "mp4");
    expect(zipEntries.map((e) => e.name)).toEqual([
      "mocksy-export-1-iphone15.mp4",
      "mocksy-export-2-macbook.mp4"
    ]);
  });

  it("reports a non-zero ffmpeg exit through onError", async () => {
    getFfmpegInstance.mockResolvedValue(fakeFfmpeg({ exec: 1 }));
    captureWebmWithRetry.mockResolvedValue(new Blob(["webm"], { type: "video/webm" }));
    const onError = vi.fn();
    await exportVideoBatchZip(sceneWithInstances(), "out", onError, "mp4");
    expect(onError).toHaveBeenCalledWith("Video encoding failed.");
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("reports empty ffmpeg output through onError", async () => {
    getFfmpegInstance.mockResolvedValue(fakeFfmpeg({ readFileBytes: new Uint8Array(0) }));
    captureWebmWithRetry.mockResolvedValue(new Blob(["webm"], { type: "video/webm" }));
    const onError = vi.fn();
    await exportVideoBatchZip(sceneWithInstances(), "out", onError, "mp4");
    expect(onError).toHaveBeenCalledWith("Video encoding produced no output.");
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});

describe("exportBatchZip", () => {
  beforeEach(() => {
    zipEntries.length = 0;
    generateAsync.mockClear();
    renderPng.mockReset();
    downloadBlob.mockReset();
  });

  it("reports an error when the scene has no frame instances", async () => {
    const onError = vi.fn();
    await exportBatchZip(initialScene, "preview", "out", onError);
    expect(onError).toHaveBeenCalledWith("Multi-frame mode is off — there is nothing to batch.");
    expect(renderPng).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("renders every instance as a single-frame scene and packs a ZIP", async () => {
    renderPng.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
    const onProgress = vi.fn();
    const onError = vi.fn();
    await exportBatchZip(sceneWithInstances(), "preview", "out", onError, undefined, null, onProgress);

    expect(onError, onError.mock.calls.map((c) => c[0]).join(" | ")).not.toHaveBeenCalled();
    expect(zipEntries.map((e) => e.name)).toEqual([
      "mocksy-export-1-iphone15.png",
      "mocksy-export-2-macbook.png"
    ]);
    // Each instance is rendered as a scene variant scoped to that instance,
    // sharing the regular PNG pipeline's transform/watermark/annotations.
    expect(renderPng).toHaveBeenCalledTimes(2);
    const firstCall = renderPng.mock.calls[0] as unknown[];
    const variant = firstCall[0] as EditorScene;
    expect(variant.frameInstances).toHaveLength(1);
    expect(variant.frameInstances[0]!.id).toBe("a");
    expect(firstCall[1]).toBe("preview");
    expect(onProgress).toHaveBeenCalledWith(1, 2);
    expect(onProgress).toHaveBeenCalledWith(2, 2);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [, archiveName] = downloadBlob.mock.calls[0] as unknown[];
    expect(archiveName).toBe("out.zip");
  });

  it("stops when a render yields no blob", async () => {
    renderPng.mockResolvedValue(null);
    const onError = vi.fn();
    await exportBatchZip(sceneWithInstances(), "preview", "out", onError);
    expect(renderPng).toHaveBeenCalledTimes(1);
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("routes render failures through onError", async () => {
    renderPng.mockRejectedValue(new Error("render exploded"));
    const onError = vi.fn();
    await exportBatchZip(sceneWithInstances(), "preview", "out", onError);
    expect(onError).toHaveBeenCalledWith("render exploded");
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("falls back to a generic message for a non-Error throw", async () => {
    renderPng.mockRejectedValue("boom");
    const onError = vi.fn();
    await exportBatchZip(sceneWithInstances(), "preview", "out", onError);
    expect(onError).toHaveBeenCalledWith("Batch export failed.");
  });
});
