import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";

// renderMockup pulls in canvas APIs we don't need for the export orchestration
// test; stub it so the suite runs under node.
vi.mock("@/lib/export/renderMockup", () => ({
  renderMockupToCanvas: vi.fn(function () {}),
  loadImage: vi.fn().mockResolvedValue(null)
}));

// FFmpeg WASM can't run in node; stub the heavy lifetime.
const ffmpegHarness = vi.hoisted(() => ({ execCode: 0, loadCalls: 0 }));
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
  }
}));

import { exportVideo, exportWebm, exportWebpAnim, exportGif, exportBaseName, sanitizeFilename, resolvePixelRatio, computeCaptureDuration, chooseWebmMimeType, terminateFfmpeg } from "@/lib/export/exportVideo";

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

  it("chooseWebmMimeType prefers vp9 when supported", () => {
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: { isTypeSupported: (t: string) => t.includes("vp9") }
    });
    expect(chooseWebmMimeType()).toBe("video/webm;codecs=vp9");
  });

  it("chooseWebmMimeType falls back to vp8", () => {
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: { isTypeSupported: () => false }
    });
    expect(chooseWebmMimeType()).toBe("video/webm;codecs=vp8");
  });

  it("exportBaseName strips the media extension and sanitizes", () => {
    expect(exportBaseName(sceneWithLayer({ mediaName: "My Shot (1).png" }))).toBe("My_Shot__1_");
    expect(exportBaseName(sceneWithLayer({ mediaName: null }))).toBe("mocksy-export");
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
});
