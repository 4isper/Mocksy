import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene } from "@/lib/types/editor";

// renderMockup pulls in canvas APIs we don't need for the export orchestration
// test; stub it so the suite runs under node.
vi.mock("@/lib/export/renderMockup", () => ({
  renderMockupToCanvas: vi.fn(),
  loadImage: vi.fn().mockResolvedValue(null)
}));

// FFmpeg WASM can't run in node; stub the heavy lifetime.
const ffmpegHarness = vi.hoisted(() => ({ execCode: 0 }));
vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: class {
    writeFile = vi.fn().mockResolvedValue(undefined);
    deleteFile = vi.fn().mockResolvedValue(undefined);
    exec = vi.fn().mockImplementation(() => Promise.resolve(ffmpegHarness.execCode));
    readFile = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
    load = vi.fn().mockResolvedValue(undefined);
  }
}));

import { exportVideo, sanitizeFilename, resolvePixelRatio, computeCaptureDuration, chooseWebmMimeType } from "@/lib/export/exportVideo";

const ORIGINAL_WINDOW = globalThis.window;

beforeEach(() => {
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
  vi.restoreAllMocks();
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
    const scene: EditorScene = { ...initialScene, mediaUrl: null, mediaType: "none" };
    expect(computeCaptureDuration(scene)).toBe(3);
  });

  it("computeCaptureDuration uses trimmed video length", () => {
    const scene: EditorScene = {
      ...initialScene,
      mediaUrl: "blob:vid",
      mediaType: "video",
      videoDuration: 10,
      videoTrimStart: 2,
      videoTrimEnd: 6
    };
    expect(computeCaptureDuration(scene)).toBe(4);
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
      captureStream: vi.fn().mockReturnValue({ getTracks: () => [] }),
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
        if (tag === "video") return { src: "", crossOrigin: "", muted: false, playsInline: false, onloadedmetadata: null, onerror: null, play: vi.fn(), pause: vi.fn(), remove: vi.fn() };
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
    const MR = vi.fn().mockImplementation(() => recorder);
    (MR as unknown as { isTypeSupported: (t: string) => boolean }).isTypeSupported = (t: string) => t.includes("vp9");
    Object.defineProperty(globalThis, "MediaRecorder", { configurable: true, value: MR });
    return recorder;
  }

  it("exports an MP4 for a still-image scene (happy path)", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    const recorder = installMediaRecorder();

    const scene: EditorScene = { ...initialScene, mediaUrl: null, mediaType: "none" };
    const statuses: string[] = [];
    const progress: number[] = [];
    await exportVideo(
      scene,
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
    await exportVideo({ ...initialScene, mediaUrl: null, mediaType: "none" }, undefined, undefined, (m) => errors.push(m));
    expect(errors).toContain("Preview area not found.");
  });

  it("surfaces a FFmpeg failure instead of producing an empty MP4", async () => {
    const preview = fakePreview();
    const canvas = fakeCanvas();
    installDom(preview, canvas);
    installMediaRecorder();
    ffmpegHarness.execCode = 1;

    const errors: string[] = [];
    await exportVideo({ ...initialScene, mediaUrl: null, mediaType: "none" }, undefined, undefined, (m) => errors.push(m));
    expect(errors).toContain("Video encoding failed.");
    ffmpegHarness.execCode = 0;
  });
});
