import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialScene } from "@/lib/state/editorStore";
import { loadImage } from "@/lib/render/canvasMedia";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";

// renderMockup pulls in canvas APIs we don't need for the export orchestration
// test; stub it so the suite runs under node.
vi.mock("@/lib/render/renderMockup", () => ({
  renderMockupToCanvas: vi.fn(function () {}),
}));
vi.mock("@/lib/render/canvasMedia", () => ({
  loadImage: vi.fn().mockResolvedValue(null),
  loadVideoFrame: vi.fn().mockResolvedValue(null),
}));

// FFmpeg WASM can't run in node; stub the heavy lifetime.
const ffmpegHarness = vi.hoisted(() => ({
  execCode: 0,
  loadCalls: 0,
  instances: [] as Array<{ deleteFile: (path: string) => Promise<void> }>
}));
vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: class {
    writeFile = vi.fn().mockResolvedValue(undefined);
    deleteFile = vi.fn().mockResolvedValue(undefined);
    exec = vi.fn().mockImplementation(function () { return Promise.resolve(ffmpegHarness.execCode); });
    readFile = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
    load = vi.fn().mockImplementation(function () {
      ffmpegHarness.loadCalls += 1;
      return Promise.resolve(undefined);
    });
    constructor() {
      ffmpegHarness.instances.push(this);
    }
  }
}));

import { exportVideo, exportWebm, exportWebpAnim, exportGif, exportBaseName, sanitizeFilename, resolvePixelRatio, computeCaptureDuration, chooseWebmMimeType, terminateFfmpeg } from "@/lib/export/exportVideo";
import { toEvenDimension } from "@/lib/export/videoExportHelpers";
import { getFfmpegInstance } from "@/lib/export/ffmpegLoader";

const ORIGINAL_WINDOW = globalThis.window;

function layer(overrides: Partial<MediaLayer> = {}): MediaLayer {
  return { ...initialScene.layers[0]!, id: overrides.id ?? "layer-test", ...overrides };
}

function sceneWithLayer(overrides: Partial<MediaLayer> = {}): EditorScene {
  const l = layer(overrides);
  return { ...initialScene, layers: [l], activeLayerId: l.id };
}

beforeEach(() => {
  // reset the shared FFmpeg harness so a prior test's failure code can't
  // leak into the next one (the instance is module-level).
  ffmpegHarness.execCode = 0;
  // minimal window so resolvePixelRatio / chooseWebmMimeType behave
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { devicePixelRatio: 2 }
  });
  // node has no rAF; fire the tick once with a large elapsed time so the
  // recording loop stops immediately (elapsed >= duration) instead of looping.
  let rafCalls = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => {
    if (rafCalls++ < 1) queueMicrotask(() => cb(0));
    return 0;
  });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  let clock = 0;
  vi.stubGlobal("performance", { now: () => (clock += 10000) });
  // DOM element classes used by instanceof checks in exportVideo
  vi.stubGlobal("HTMLImageElement", class {});
  vi.stubGlobal("HTMLVideoElement", class {});
  vi.stubGlobal("HTMLCanvasElement", class {});
});

afterEach(() => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: ORIGINAL_WINDOW });
  // clearAllMocks (not restoreAllMocks): the export module caches a singleton
  // FFmpeg instance across tests, and restoreAllMocks would strip its
  // mockImplementation, leaving later exports with an exec that returns
  // undefined.
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("exportVideo pure helpers", () => {
  it("sanitizeFilename strips unsafe characters", () => {
    expect(sanitizeFilename("My Shot (1).png")).toBe("My_Shot__1_.png");
    expect(sanitizeFilename("a/b\\c:d*e")).toBe("a_b_c_d_e");
  });

  it("resolvePixelRatio scales by quality tier from devicePixelRatio", () => {
    // floor of 2 applies to dpr before scaling: max(2, 2) * scale
    expect(resolvePixelRatio("medium")).toBe(2 * 0.75); // 1.5
    expect(resolvePixelRatio("high")).toBe(2 * 1); // 2
    expect(resolvePixelRatio("low")).toBe(2 * 0.5); // 1
  });

  it("resolvePixelRatio falls back to 1 when no window", () => {
    Object.defineProperty(globalThis, "window", { configurable: true, value: undefined });
    // high: max(2, 1*1) = 2
    expect(resolvePixelRatio("high")).toBe(2);
  });

  it("computeCaptureDuration uses the animation length for still images", () => {
    const scene = sceneWithLayer({ mediaUrl: null, mediaType: "none" });
    expect(computeCaptureDuration(scene)).toBe(3);
  });

  it("computeCaptureDuration honors a custom animation duration", () => {
    const scene = { ...sceneWithLayer({ mediaUrl: null, mediaType: "none" }), animationDurationMs: 6000 };
    expect(computeCaptureDuration(scene)).toBe(6);
  });

  it("computeCaptureDuration uses trimmed video length", () => {
    const scene = sceneWithLayer({
      mediaUrl: "blob:vid",
      mediaType: "video",
      videoDuration: 10,
      videoTrimStart: 2,
      videoTrimEnd: 6
    });
    expect(computeCaptureDuration(scene)).toBe(4);
  });

  it("computeCaptureDuration falls back to the loop length when duration is unknown", () => {
    const scene = sceneWithLayer({ mediaUrl: "blob:vid", mediaType: "video", videoDuration: undefined });
    expect(computeCaptureDuration(scene)).toBe(3);
  });

  it("computeCaptureDuration falls back to the loop length when duration is 0 (not yet measured)", () => {
    // videoDuration stays 0 until the preview <video> reports metadata; a zero
    // length must not collapse the recording to an empty capture.
    const scene = sceneWithLayer({ mediaUrl: "blob:vid", mediaType: "video", videoDuration: 0, videoTrimStart: 0, videoTrimEnd: 0 });
    expect(computeCaptureDuration(scene)).toBe(3);
  });

  it("chooseWebmMimeType prefers vp8 when supported", () => {
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: { isTypeSupported: (t: string) => t.includes("vp8") }
    });
    expect(chooseWebmMimeType()).toBe("video/webm;codecs=vp8");
  });

  it("chooseWebmMimeType falls back to vp9", () => {
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: { isTypeSupported: (t: string) => t === "video/webm;codecs=vp9" }
    });
    expect(chooseWebmMimeType()).toBe("video/webm;codecs=vp9");
  });

  it("chooseWebmMimeType returns null when no WebM codec is supported (Safari)", () => {
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: { isTypeSupported: () => false }
    });
    expect(chooseWebmMimeType()).toBeNull();
  });

  it("exportBaseName strips the media extension and sanitizes", () => {
    expect(exportBaseName(sceneWithLayer({ mediaName: "My Shot (1).png" }))).toBe("My_Shot__1_");
    expect(exportBaseName(sceneWithLayer({ mediaName: null }))).toBe("mocksy-export");
  });

  it("exportBaseName falls back to the default when the stripped name is empty", () => {
    // ".hidden" has no basename before the extension; an empty fallback would
    // produce downloads named ".png" (hidden dotfiles on Unix).
    expect(exportBaseName(sceneWithLayer({ mediaName: ".hidden" }))).toBe("mocksy-export");
  });
});

describe("exportVideo orchestration", () => {
  function fakePreview() {
    const node = {
      clientWidth: 800,
      clientHeight: 600,
      querySelector: vi.fn().mockReturnValue(null),
      appendChild: vi.fn(),
      removeChild: vi.fn()
    };
    return node as unknown as HTMLElement;
  }

  function fakeCanvas() {
    const canvas = {
      width: 0,
      height: 0,
      style: {},
      captureStream: vi.fn().mockReturnValue({ getTracks: () => [], getVideoTracks: () => [] }),
      remove: vi.fn(),
      getContext: vi.fn().mockReturnValue({})
    };
    return canvas as unknown as HTMLCanvasElement;
  }

  function installDom(preview: HTMLElement, canvas: HTMLCanvasElement) {
    const doc = {
      getElementById: vi.fn().mockReturnValue(preview),
      createElement: vi.fn().mockImplementation((tag: string) => {
        if (tag === "canvas") return canvas;
        if (tag === "a") return { click: vi.fn(), set href(_v: string) {}, get href() { return ""; } };
        if (tag === "video") return { src: "", crossOrigin: "", muted: false, playsInline: false, onloadedmetadata: null, onerror: null, play: vi.fn(), pause: vi.fn(), remove: vi.fn(), captureStream: vi.fn().mockReturnValue({ getAudioTracks: () => [], getVideoTracks: () => [] }) };
        if (tag === "audio") return { src: "", crossOrigin: "", loop: false, play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), remove: vi.fn(), captureStream: vi.fn().mockReturnValue({ getAudioTracks: () => [] }) };
        return {};
      }),
      body: { appendChild: vi.fn(), removeChild: vi.fn() }
    };
    vi.stubGlobal("document", doc);
  }

  function installMediaRecorder() {
    const recorder = {
      ondataavailable: null as ((e: { data: { size: number } }) => void) | null,
      onstop: null as (() => void) | null,
      onerror: null as (() => void) | null,
      start: vi.fn(function (this: { ondataavailable: ((e: { data: { size: number } }) => void) | null; onstop: (() => void) | null }) {
        // simulate a chunk then stop on the next tick
        queueMicrotask(() => {
          this.ondataavailable?.({ data: { size: 8 } });
          this.onstop?.();
        });
      }),
      stop: vi.fn()
    };
    const MR = vi.fn().mockImplementation(function () { return recorder; });
    (MR as unknown as { isTypeSupported: (t: string) => boolean }).isTypeSupported = (t: string) => t.includes("vp9");
    vi.stubGlobal("MediaRecorder", MR);
    return recorder;
  }

  it("exports an MP4 for a still-image scene (happy path)", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    const recorder = installMediaRecorder();

    const scene = sceneWithLayer({ mediaUrl: null, mediaType: "none" });
    const statuses: string[] = [];
    const progress: number[] = [];
    await exportVideo(
      scene,
      undefined,
      (m) => statuses.push(m),
      (p) => progress.push(p)
    );

    // recorder was started/stopped and the canvas captured a stream
    expect(recorder.start).toHaveBeenCalled();
    expect(recorder.stop).toHaveBeenCalled();
    expect(canvas.captureStream).toHaveBeenCalled();
    // progress reaches 100 and a Done status is emitted
    expect(progress[progress.length - 1]).toBe(100);
    expect(statuses).toContain("Done");
  });

  it("reports an error when the preview node is missing", async () => {
    const canvas = fakeCanvas();
    const doc = {
      getElementById: vi.fn().mockReturnValue(null),
      createElement: vi.fn().mockReturnValue(canvas),
      body: { appendChild: vi.fn(), removeChild: vi.fn() }
    };
    vi.stubGlobal("document", doc);
    installMediaRecorder();

    const errors: string[] = [];
    await exportVideo(sceneWithLayer({ mediaUrl: null, mediaType: "none" }), undefined, undefined, undefined, (m) => errors.push(m));
    expect(errors).toContain("Preview area not found.");
  });

  it("surfaces a FFmpeg failure instead of producing an empty MP4", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();
    ffmpegHarness.execCode = 1;

    const errors: string[] = [];
    await exportVideo(sceneWithLayer({ mediaUrl: null, mediaType: "none" }), undefined, undefined, undefined, (m) => errors.push(m));
    expect(errors).toContain("Video encoding failed.");
    ffmpegHarness.execCode = 0;
  });

  it("reloads FFmpeg after terminateFfmpeg releases the cached instance", async () => {
    terminateFfmpeg();
    const before = ffmpegHarness.loadCalls;
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();
    await exportVideo(sceneWithLayer({ mediaUrl: null, mediaType: "none" }));
    expect(ffmpegHarness.loadCalls).toBe(before + 1);

    terminateFfmpeg();
    await exportVideo(sceneWithLayer({ mediaUrl: null, mediaType: "none" }));
    expect(ffmpegHarness.loadCalls).toBe(before + 2);
  });

  it("exports a GIF for a still-image scene (palette pipeline)", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();

    const statuses: string[] = [];
    await exportGif(sceneWithLayer({ mediaUrl: null, mediaType: "none" }), undefined, (m) => statuses.push(m));
    expect(statuses).toContain("Done");
  });

  it("reports Done for a GIF even when post-download temp-file cleanup fails", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();
    // The real worker rejects deleteFile for a path that doesn't exist
    // (ENOENT from FS.unlink); cleanup after the download must swallow it.
    const ffmpeg = await getFfmpegInstance();
    ffmpeg.deleteFile = vi.fn().mockRejectedValueOnce(new Error("ENOENT"));

    const statuses: string[] = [];
    const progress: number[] = [];
    const errors: string[] = [];
    await exportGif(
      sceneWithLayer({ mediaUrl: null, mediaType: "none" }),
      undefined,
      (m) => statuses.push(m),
      (p) => progress.push(p),
      (m) => errors.push(m)
    );
    expect(errors).toEqual([]);
    expect(statuses).toContain("Done");
  });

  it("reports Done for an MP4 even when post-download temp-file cleanup fails", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();
    const ffmpeg = await getFfmpegInstance();
    ffmpeg.deleteFile = vi.fn().mockRejectedValueOnce(new Error("ENOENT"));

    const statuses: string[] = [];
    const progress: number[] = [];
    const errors: string[] = [];
    await exportVideo(
      sceneWithLayer({ mediaUrl: null, mediaType: "none" }),
      undefined,
      (m) => statuses.push(m),
      (p) => progress.push(p),
      (m) => errors.push(m)
    );
    expect(errors).toEqual([]);
    expect(statuses).toContain("Done");
  });

  it("exports a WebM directly from the MediaRecorder capture", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    const recorder = installMediaRecorder();

    const statuses: string[] = [];
    await exportWebm(sceneWithLayer({ mediaUrl: null, mediaType: "none" }), undefined, (m) => statuses.push(m));
    expect(recorder.start).toHaveBeenCalled();
    expect(recorder.stop).toHaveBeenCalled();
    expect(statuses).toContain("Done");
  });

  it("aborts a WebM export mid-recording without downloading the file", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();

    const controller = new AbortController();
    // Abort while the capture loop is running (the rAF tick fires on a
    // microtask): the export must surface the abort instead of delivering
    // a file that was recorded after the user hit cancel.
    controller.abort();

    const statuses: string[] = [];
    const errors: string[] = [];
    await exportWebm(
      sceneWithLayer({ mediaUrl: null, mediaType: "none" }),
      undefined,
      (m) => statuses.push(m),
      undefined,
      (m) => errors.push(m),
      undefined,
      undefined,
      controller.signal
    );
    expect(statuses).not.toContain("Done");
    // A user-initiated cancel is not a failure: no error toast, no file.
    expect(errors).toEqual([]);
  });

  it("plays detached videos so multi-frame captures render the media", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    const videos: Array<Record<string, unknown>> = [];
    const doc = {
      getElementById: vi.fn().mockReturnValue(preview),
      createElement: vi.fn().mockImplementation((tag: string) => {
        if (tag === "canvas") return canvas;
        if (tag === "a") return { click: vi.fn(), set href(_v: string) {}, get href() { return ""; } };
        if (tag === "video") {
          const v: Record<string, unknown> = {
            src: "",
            crossOrigin: "",
            muted: false,
            playsInline: false,
            play: vi.fn().mockResolvedValue(undefined),
            pause: vi.fn(),
            remove: vi.fn(),
            captureStream: vi.fn().mockReturnValue({ getAudioTracks: () => [], getVideoTracks: () => [] })
          };
          // Simulate the async metadata/seek events: metadata fires on a
          // microtask once attached; seeking resolves once the handler is in
          // place (mirrors the real event ordering in both call sites).
          Object.defineProperty(v, "currentTime", {
            configurable: true,
            get() { return v._currentTime ?? 0; },
            set(t) {
              v._currentTime = t;
              queueMicrotask(() => (v.onseeked as (() => void) | null)?.());
            }
          });
          Object.defineProperty(v, "onloadedmetadata", {
            configurable: true,
            get() { return v._onLoadedMetadata; },
            set(fn) { v._onLoadedMetadata = fn; if (fn) queueMicrotask(() => (fn as () => void)()); }
          });
          Object.defineProperty(v, "onseeked", {
            configurable: true,
            get() { return v._onSeeked; },
            set(fn) { v._onSeeked = fn; }
          });
          Object.defineProperty(v, "onerror", {
            configurable: true,
            get() { return v._onError; },
            set(fn) { v._onError = fn; }
          });
          videos.push(v);
          return v;
        }
        if (tag === "audio") return { src: "", crossOrigin: "", loop: false, play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), remove: vi.fn(), captureStream: vi.fn().mockReturnValue({ getAudioTracks: () => [] }) };
        return {};
      }),
      body: { appendChild: vi.fn(), removeChild: vi.fn() }
    };
    vi.stubGlobal("document", doc);
    installMediaRecorder();

    const videoLayer = layer({
      id: "vlayer",
      mediaUrl: "blob:vid",
      mediaType: "video",
      mediaName: "clip.mp4",
      videoDuration: 10,
      videoTrimStart: 2,
      videoTrimEnd: 8
    });
    const scene: EditorScene = {
      ...sceneWithLayer(videoLayer),
      frameInstances: [
        { id: "inst1", layerId: "vlayer", frame: "iphone15", x: 0.25, y: 0.5, scale: 0.4 },
        { id: "inst2", layerId: "other", frame: "iphone15", x: 0.75, y: 0.5, scale: 0.4 }
      ]
    };

    await exportWebm(scene);

    // The frame instance's detached video must be seeked to its trim start and
    // played (an unplayed video stays undecoded and draws nothing in the frame).
    const gridVideo = videos[videos.length - 1]!;
    expect(gridVideo._currentTime).toBe(2);
    expect(gridVideo.play).toHaveBeenCalled();
  });

  it("stops and detaches every instance video once the capture ends", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    const videos: Array<Record<string, unknown>> = [];
    const makeVideoStub = (): Record<string, unknown> => {
      const v: Record<string, unknown> = {
        src: "",
        crossOrigin: "",
        muted: false,
        playsInline: false,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        remove: vi.fn(),
        captureStream: vi.fn().mockReturnValue({ getAudioTracks: () => [], getVideoTracks: () => [] })
      };
      Object.defineProperty(v, "currentTime", {
        configurable: true,
        get() { return v._currentTime ?? 0; },
        set(t) {
          v._currentTime = t;
          queueMicrotask(() => (v.onseeked as (() => void) | null)?.());
        }
      });
      Object.defineProperty(v, "onloadedmetadata", {
        configurable: true,
        get() { return v._onLoadedMetadata; },
        set(fn) { v._onLoadedMetadata = fn; if (fn) queueMicrotask(() => (fn as () => void)()); }
      });
      Object.defineProperty(v, "onseeked", {
        configurable: true,
        get() { return v._onSeeked; },
        set(fn) { v._onSeeked = fn; }
      });
      Object.defineProperty(v, "onerror", {
        configurable: true,
        get() { return v._onError; },
        set(fn) { v._onError = fn; }
      });
      videos.push(v);
      return v;
    };
    vi.stubGlobal("document", {
      getElementById: vi.fn().mockReturnValue(preview),
      createElement: vi.fn().mockImplementation((tag: string) => {
        if (tag === "canvas") return canvas;
        if (tag === "video") return makeVideoStub();
        return {};
      }),
      body: { appendChild: vi.fn(), removeChild: vi.fn() }
    });
    installMediaRecorder();

    const videoLayer = layer({
      id: "vlayer",
      mediaUrl: "blob:vid",
      mediaType: "video",
      mediaName: "clip.mp4",
      videoDuration: 10,
      videoTrimStart: 2,
      videoTrimEnd: 8
    });
    const scene: EditorScene = {
      ...sceneWithLayer(videoLayer),
      frameInstances: [
        { id: "inst1", layerId: "vlayer", frame: "iphone15", x: 0.25, y: 0.5, scale: 0.4 },
        { id: "inst2", layerId: "other", frame: "iphone15", x: 0.75, y: 0.5, scale: 0.4 }
      ]
    };

    await exportWebm(scene);

    // Instance <video> elements keep decoding (and playing!) until explicitly
    // stopped: after the recording they must all be paused and dropped, or
    // every export leaks live media elements until reload.
    expect(videos.length).toBeGreaterThanOrEqual(2);
    for (const v of videos) {
      expect(v.pause).toHaveBeenCalled();
      expect(v.remove).toHaveBeenCalled();
    }
  });

  it("sizes the capture canvas to a custom resolution", async () => {
    const preview = fakePreview(); // 800×600 preview
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();

    const statuses: string[] = [];
    await exportWebm(
      sceneWithLayer({ mediaUrl: null, mediaType: "none" }),
      undefined,
      (m) => statuses.push(m),
      undefined,
      undefined,
      { width: 1920, height: 1080 }
    );
    expect(statuses).toContain("Done");
    // custom size overrides the quality-tier pixel ratio entirely
    expect(canvas.width).toBe(1920);
    expect(canvas.height).toBe(1080);
  });

  it("records at the quality-tier size when no custom size is set", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();

    // medium quality, dpr 2 → resolvePixelRatio = max(2,2)*0.75 = 1.5.
    // Size anchors to the scene's intrinsic artboard, not the preview box:
    // the demo scene is 16/9, so the base height is 450 (800×9/16). The raw
    // height 675 is odd; H.264/yuv420p rejects odd dimensions, so the capture
    // rounds down to the nearest even value.
    const scene = sceneWithLayer({ mediaUrl: null, mediaType: "none" });
    await exportWebm(scene);
    expect(canvas.width).toBe(toEvenDimension(Math.max(640, Math.round(800 * 1.5))));
    expect(canvas.height).toBe(toEvenDimension(Math.max(360, Math.round((800 * 9 / 16) * 1.5))));
    expect(canvas.height % 2).toBe(0);
    expect(canvas.width % 2).toBe(0);
  });

  it("caps the auto-sized canvas so high-DPI portrait scenes don't blow up the encode", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();

    // Portrait 9:16 scene at medium quality (dpr 2 → resolvePixelRatio 1.5)
    // would otherwise be 1600×2134 — a multi-megapixel canvas that makes the
    // WASM H.264 encode take minutes. The long edge must be capped, keeping
    // the aspect ratio.
    const scene = { ...sceneWithLayer({ mediaUrl: null, mediaType: "none" }), aspectRatio: "9 / 16" };
    await exportWebm(scene, undefined, undefined, undefined, undefined, undefined, undefined);
    expect(canvas.width).toBeLessThanOrEqual(1440);
    expect(canvas.height).toBeLessThanOrEqual(1440);
    // Aspect ratio preserved (9:16 → h > w).
    expect(canvas.height).toBeGreaterThan(canvas.width);
    expect(canvas.width / canvas.height).toBeCloseTo(9 / 16, 2);
  });

  it("transcodes an animated WebP through FFmpeg", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();

    const statuses: string[] = [];
    await exportWebpAnim(sceneWithLayer({ mediaUrl: null, mediaType: "none" }), undefined, (m) => statuses.push(m));
    expect(statuses).toContain("Done");
    // writes the capture, runs the encoder and cleans up
    expect(ffmpegHarness.loadCalls).toBeGreaterThan(0);
  });

  it("reports a WebP encoding failure", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();
    ffmpegHarness.execCode = 1;

    const errors: string[] = [];
    await exportWebpAnim(sceneWithLayer({ mediaUrl: null, mediaType: "none" }), undefined, undefined, undefined, (m) => errors.push(m));
    expect(errors).toContain("WebP encoding failed.");
    ffmpegHarness.execCode = 0;
  });

  it("reports a GIF encoding failure", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();
    ffmpegHarness.execCode = 1;

    const errors: string[] = [];
    await exportGif(sceneWithLayer({ mediaUrl: null, mediaType: "none" }), undefined, undefined, undefined, (m) => errors.push(m));
    expect(errors).toContain("GIF encoding failed.");
    ffmpegHarness.execCode = 0;
  });

  describe("exportVideoCore capture branches", () => {
  /** A <video> stub whose metadata/seek events fire on microtasks, mirroring
   *  the event ordering captureWebm relies on. */
  function makeVideoClass(captureStream: () => { getAudioTracks: () => unknown[] } = () => ({ getAudioTracks: () => [] })) {
    return class VideoStub {
      src = "";
      crossOrigin = "";
      muted = false;
      playsInline = false;
      _currentTime = 0;
      onloadedmetadata: (() => void) | null = null;
      onseeked: (() => void) | null = null;
      onerror: (() => void) | null = null;
      play = vi.fn().mockResolvedValue(undefined);
      pause = vi.fn();
      remove = vi.fn();
      captureStream = vi.fn().mockImplementation(() => captureStream());
      set currentTime(t: number) {
        this._currentTime = t;
        queueMicrotask(() => this.onseeked?.());
      }
      get currentTime() { return this._currentTime; }
    };
  }

  function installDomWithVideo(preview: HTMLElement, canvas: HTMLCanvasElement, VideoClass: new () => unknown) {
    const doc = {
      getElementById: vi.fn().mockReturnValue(preview),
      createElement: vi.fn().mockImplementation((tag: string) => {
        if (tag === "canvas") return canvas;
        if (tag === "a") return { click: vi.fn(), set href(_v: string) {}, get href() { return ""; } };
        if (tag === "video") {
          const v = new VideoClass() as { onloadedmetadata: (() => void) | null };
          queueMicrotask(() => v.onloadedmetadata?.());
          return v;
        }
        if (tag === "audio") return { src: "", crossOrigin: "", loop: false, play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), remove: vi.fn(), captureStream: vi.fn().mockReturnValue({ getAudioTracks: () => [] }) };
        return {};
      }),
      body: { appendChild: vi.fn(), removeChild: vi.fn() }
    };
    vi.stubGlobal("document", doc);
  }

  it("loads the overlay skin for overlay frames during capture", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();

    const statuses: string[] = [];
    await exportWebm({ ...sceneWithLayer({ mediaUrl: null, mediaType: "none" }), frame: "iphone15" }, undefined, (m) => statuses.push(m));
    expect(statuses).toContain("Done");
    expect(vi.mocked(loadImage)).toHaveBeenCalled();
  });

  it("keeps capturing when the overlay skin fails to load", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();
    vi.mocked(loadImage).mockRejectedValueOnce(new Error("skin failed"));

    const statuses: string[] = [];
    await exportWebm({ ...sceneWithLayer({ mediaUrl: null, mediaType: "none" }), frame: "iphone15" }, undefined, (m) => statuses.push(m));
    expect(statuses).toContain("Done");
  });

  it("preloads the scene background image for the capture", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();

    const scene: EditorScene = { ...sceneWithLayer({ mediaUrl: null, mediaType: "none" }), backgroundMode: "image", backgroundImageUrl: "data:image/png;base64,bg" };
    await exportWebm(scene);
    expect(vi.mocked(loadImage)).toHaveBeenCalledWith("data:image/png;base64,bg");
  });

  it("keeps capturing when the background image fails to load", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();
    vi.mocked(loadImage).mockRejectedValueOnce(new Error("bg failed"));

    const statuses: string[] = [];
    const scene: EditorScene = { ...sceneWithLayer({ mediaUrl: null, mediaType: "none" }), backgroundMode: "image", backgroundImageUrl: "data:image/png;base64,bg" };
    await exportWebm(scene, undefined, (m) => statuses.push(m));
    expect(statuses).toContain("Done");
  });

  it("errors when the scene has no layers", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();

    const errors: string[] = [];
    await exportWebm({ ...initialScene, layers: [] }, undefined, undefined, undefined, (m) => errors.push(m));
    expect(errors).toContain("Cannot export a scene with no layers.");
  });

  it("reports a friendly error when canvas capture is blocked", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    canvas.captureStream = vi.fn().mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    installDom(preview, canvas);
    installMediaRecorder();

    const errors: string[] = [];
    await exportWebm(sceneWithLayer({ mediaUrl: null, mediaType: "none" }), undefined, undefined, undefined, (m) => errors.push(m));
    expect(errors.some((e) => e.includes("cross-origin capture"))).toBe(true);
  });

  it("propagates unknown captureStream failures", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    canvas.captureStream = vi.fn().mockImplementation(() => {
      throw new Error("boom");
    });
    installDom(preview, canvas);
    installMediaRecorder();

    const errors: string[] = [];
    await exportWebm(sceneWithLayer({ mediaUrl: null, mediaType: "none" }), undefined, undefined, undefined, (m) => errors.push(m));
    expect(errors).toContain("boom");
  });

  it("merges background audio tracks into the capture", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    const videoTrack = { stop: vi.fn() };
    const bgAudioTrack = { stop: vi.fn() };
    canvas.captureStream = vi.fn().mockReturnValue({ getTracks: () => [videoTrack], getVideoTracks: () => [videoTrack] });
    const msInstances: unknown[][] = [];
    vi.stubGlobal("MediaStream", class {
      constructor(public tracks: unknown[]) { msInstances.push(tracks); }
      getTracks() { return this.tracks; }
    });

    const doc = {
      getElementById: vi.fn().mockReturnValue(preview),
      createElement: vi.fn().mockImplementation((tag: string) => {
        if (tag === "canvas") return canvas;
        if (tag === "a") return { click: vi.fn(), set href(_v: string) {}, get href() { return ""; } };
        if (tag === "video") return { src: "", crossOrigin: "", muted: false, playsInline: false, play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), remove: vi.fn(), captureStream: vi.fn().mockReturnValue({ getAudioTracks: () => [] }) };
        if (tag === "audio") return { src: "", crossOrigin: "", loop: false, play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), remove: vi.fn(), captureStream: vi.fn().mockReturnValue({ getAudioTracks: () => [bgAudioTrack] }) };
        return {};
      }),
      body: { appendChild: vi.fn(), removeChild: vi.fn() }
    };
    vi.stubGlobal("document", doc);
    installMediaRecorder();

    const statuses: string[] = [];
    const scene = { ...sceneWithLayer({ mediaUrl: null, mediaType: "none" }), backgroundAudioUrl: "blob:audio" };
    await exportWebm(scene, undefined, (m) => statuses.push(m));
    expect(statuses).toContain("Done");
    expect(msInstances.some((t) => t.length === 2)).toBe(true);
  });

  it("exports a video scene with per-tick frames and merged audio", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    const videoTrack = { stop: vi.fn() };
    const audioTrack = { stop: vi.fn() };
    canvas.captureStream = vi.fn().mockReturnValue({ getTracks: () => [videoTrack], getVideoTracks: () => [videoTrack] });
    const msInstances: unknown[][] = [];
    vi.stubGlobal("MediaStream", class {
      constructor(public tracks: unknown[]) { msInstances.push(tracks); }
      getTracks() { return this.tracks; }
    });

    const VideoClass = makeVideoClass(() => ({ getAudioTracks: () => [audioTrack], getVideoTracks: () => [videoTrack] }));
    vi.stubGlobal("HTMLVideoElement", VideoClass);
    installDomWithVideo(preview, canvas, VideoClass);
    installMediaRecorder();

    // First tick keeps animating (elapsed < duration), the second stops.
    let rafCalls = 0;
    let nowCalls = 0;
    vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => {
      if (rafCalls++ < 2) queueMicrotask(() => cb(0));
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    vi.stubGlobal("performance", { now: () => { nowCalls += 1; return nowCalls === 1 ? 0 : nowCalls === 2 ? 0.5 : 10000; } });

    const statuses: string[] = [];
    await exportWebm(
      sceneWithLayer({ mediaUrl: "blob:vid", mediaType: "video", mediaName: "clip.mp4", videoDuration: 10, videoTrimStart: 2, videoTrimEnd: 8, videoMuted: false }),
      undefined,
      (m) => statuses.push(m)
    );
    expect(statuses).toContain("Done");
    expect(msInstances.some((t) => t.length === 2)).toBe(true);
  });

  it("exports a video scene with no trim without seeking", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    canvas.captureStream = vi.fn().mockReturnValue({ getTracks: () => [], getVideoTracks: () => [] });
    const VideoClass = makeVideoClass();
    vi.stubGlobal("HTMLVideoElement", VideoClass);
    installDomWithVideo(preview, canvas, VideoClass);
    installMediaRecorder();

    const statuses: string[] = [];
    await exportWebm(
      sceneWithLayer({ mediaUrl: "blob:vid", mediaType: "video", mediaName: "clip.mp4", videoDuration: 10, videoTrimStart: 0, videoTrimEnd: 0 }),
      undefined,
      (m) => statuses.push(m)
    );
    expect(statuses).toContain("Done");
  });

  it("loads image media for each frame instance", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();

    const imgLayer = layer({ id: "img", mediaUrl: "data:image/png;base64,abc", mediaType: "image" });
    const scene: EditorScene = {
      ...sceneWithLayer(imgLayer),
      frameInstances: [{ id: "i1", layerId: "img", frame: "iphone", x: 0.5, y: 0.5, scale: 1 }]
    };
    await exportWebm(scene);
    expect(vi.mocked(loadImage)).toHaveBeenCalledWith("data:image/png;base64,abc");
  });

  it("tolerates a failed image load for a frame instance", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();
    vi.mocked(loadImage).mockRejectedValueOnce(new Error("img failed"));

    const imgLayer = layer({ id: "img", mediaUrl: "data:image/png;base64,abc", mediaType: "image" });
    const scene: EditorScene = {
      ...sceneWithLayer(imgLayer),
      frameInstances: [{ id: "i1", layerId: "img", frame: "iphone", x: 0.5, y: 0.5, scale: 1 }]
    };
    const statuses: string[] = [];
    await exportWebm(scene, undefined, (m) => statuses.push(m));
    expect(statuses).toContain("Done");
  });

  it("resolves frame-instance videos without seeking when no trim is set", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    const VideoClass = makeVideoClass();
    vi.stubGlobal("HTMLVideoElement", VideoClass);
    installDomWithVideo(preview, canvas, VideoClass);
    installMediaRecorder();

    const videoLayer = layer({ id: "vl", mediaUrl: "blob:vid", mediaType: "video", mediaName: "clip.mp4", videoDuration: 10, videoTrimStart: 0, videoTrimEnd: 0 });
    const scene: EditorScene = {
      ...sceneWithLayer(videoLayer),
      frameInstances: [{ id: "i1", layerId: "vl", frame: "iphone", x: 0.5, y: 0.5, scale: 1 }]
    };
    const statuses: string[] = [];
    await exportWebm(scene, undefined, (m) => statuses.push(m));
    expect(statuses).toContain("Done");
  });

  it("retries the capture once when the first recording is empty", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);

    let captures = 0;
    const recorder = {
      ondataavailable: null as ((e: { data: { size: number } }) => void) | null,
      onstop: null as (() => void) | null,
      onerror: null as (() => void) | null,
      start: vi.fn(function (this: { ondataavailable: ((e: { data: { size: number } }) => void) | null; onstop: (() => void) | null }) {
        captures += 1;
        queueMicrotask(() => {
          if (captures > 1) this.ondataavailable?.({ data: { size: 8 } });
          this.onstop?.();
        });
      }),
      stop: vi.fn()
    };
    const MR = vi.fn().mockImplementation(function () { return recorder; });
    (MR as unknown as { isTypeSupported: (t: string) => boolean }).isTypeSupported = (t: string) => t.includes("vp9");
    vi.stubGlobal("MediaRecorder", MR);

    const statuses: string[] = [];
    await exportWebm(sceneWithLayer({ mediaUrl: null, mediaType: "none" }), undefined, (m) => statuses.push(m));
    expect(captures).toBe(2);
    expect(statuses).toContain("Done");
  });

  it("reuses the preview image element when the active layer has no media", async () => {
    const Img = class {};
    vi.stubGlobal("HTMLImageElement", Img);
    const preview = fakePreview();
    const imgEl = new Img() as unknown as HTMLImageElement;
    preview.querySelector = vi.fn((sel: string) => (sel.startsWith("[data-layer-media=") ? imgEl : null)) as unknown as typeof preview.querySelector;
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();

    const statuses: string[] = [];
    await exportWebm(sceneWithLayer({ mediaUrl: null, mediaType: "none" }), undefined, (m) => statuses.push(m));
    expect(statuses).toContain("Done");
  });

  it("reuses the preview video element for still-image scenes", async () => {
    const VideoClass = makeVideoClass();
    vi.stubGlobal("HTMLVideoElement", VideoClass);
    const preview = fakePreview();
    const vidEl = new VideoClass() as unknown as HTMLVideoElement;
    preview.querySelector = vi.fn((sel: string) => (sel.startsWith("[data-layer-media=") ? vidEl : null)) as unknown as typeof preview.querySelector;
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();

    const statuses: string[] = [];
    await exportWebm(sceneWithLayer({ mediaUrl: null, mediaType: "none" }), undefined, (m) => statuses.push(m));
    expect(statuses).toContain("Done");
  });
  });
});
