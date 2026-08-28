import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// FFmpeg WASM can't run in node; stub the heavy lifetime. Same harness shape
// as exportVideo.test.ts so both suites exercise the real loader logic.
const ffmpegHarness = vi.hoisted(() => ({
  loadCalls: 0,
  terminateCalls: 0
}));
vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: class {
    writeFile = vi.fn().mockResolvedValue(undefined);
    deleteFile = vi.fn().mockResolvedValue(undefined);
    exec = vi.fn().mockResolvedValue(0);
    readFile = vi.fn().mockResolvedValue(new Uint8Array([1, 2]));
    load = vi.fn().mockImplementation(function () {
      ffmpegHarness.loadCalls += 1;
      return Promise.resolve(undefined);
    });
    terminate = vi.fn(function () {
      ffmpegHarness.terminateCalls += 1;
    });
  }
}));

import {
  cleanupFfmpegTempFiles,
  FFMPEG_IDLE_RELEASE_MS,
  getFfmpegInstance,
  getFfmpegSingleton,
  scheduleFfmpegIdleRelease,
  terminateFfmpeg,
  warmUpFfmpeg
} from "@/lib/export/ffmpegLoader";

beforeEach(() => {
  terminateFfmpeg();
  ffmpegHarness.loadCalls = 0;
  ffmpegHarness.terminateCalls = 0;
});

afterEach(() => {
  vi.useRealTimers();
  terminateFfmpeg();
});

describe("ffmpegLoader idle release", () => {
  it("releases the singleton exactly when the idle window elapses", async () => {
    vi.useFakeTimers();
    await getFfmpegInstance();
    expect(getFfmpegSingleton()).not.toBeNull();

    scheduleFfmpegIdleRelease();
    await vi.advanceTimersByTimeAsync(FFMPEG_IDLE_RELEASE_MS - 1);
    expect(getFfmpegSingleton()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1);

    expect(getFfmpegSingleton()).toBeNull();
    expect(ffmpegHarness.terminateCalls).toBe(1);
  });

  it("cancels the pending release when the encoder is used again", async () => {
    vi.useFakeTimers();
    await getFfmpegInstance();
    scheduleFfmpegIdleRelease();

    await vi.advanceTimersByTimeAsync(FFMPEG_IDLE_RELEASE_MS / 2);
    await getFfmpegInstance();
    await vi.advanceTimersByTimeAsync(FFMPEG_IDLE_RELEASE_MS * 2);

    // An armed timer must never fire under an imminent/in-flight export.
    expect(getFfmpegSingleton()).not.toBeNull();
    expect(ffmpegHarness.loadCalls).toBe(1);
    expect(ffmpegHarness.terminateCalls).toBe(0);
  });

  it("re-arms after temp-file cleanup; the next export reloads a fresh worker", async () => {
    vi.useFakeTimers();
    const ff = await getFfmpegInstance();

    await cleanupFfmpegTempFiles(ff, ["input.webm", "output.mp4"]);
    await vi.advanceTimersByTimeAsync(FFMPEG_IDLE_RELEASE_MS);
    expect(getFfmpegSingleton()).toBeNull();

    const again = await getFfmpegInstance();
    expect(again).not.toBe(ff);
    expect(ffmpegHarness.loadCalls).toBe(2);
  });

  it("warmUpFfmpeg arms the release so visitors who never export don't pin the WASM", async () => {
    vi.useFakeTimers();
    warmUpFfmpeg();

    await vi.advanceTimersByTimeAsync(FFMPEG_IDLE_RELEASE_MS);
    expect(getFfmpegSingleton()).toBeNull();
    expect(ffmpegHarness.terminateCalls).toBe(1);
  });

  it("replaces an already-armed timer instead of stacking a second one", async () => {
    vi.useFakeTimers();
    await getFfmpegInstance();

    scheduleFfmpegIdleRelease();
    scheduleFfmpegIdleRelease();
    await vi.advanceTimersByTimeAsync(FFMPEG_IDLE_RELEASE_MS);

    expect(ffmpegHarness.terminateCalls).toBe(1);
  });
});
