import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitForDecodedFrame, waitForPlayback, waitForPresentedFrame, waitForSeek } from "@/lib/export/videoRecorder";

interface TestVideo {
  readyState: number;
  videoWidth: number;
  currentTime: number;
  paused: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  fire: (type: string) => void;
}

function video(readyState: number, opts: { currentTime?: number; videoWidth?: number; paused?: boolean } = {}): HTMLVideoElement {
  const handlers: Record<string, () => void> = {};
  const el = {
    readyState,
    videoWidth: opts.videoWidth ?? 0,
    currentTime: opts.currentTime ?? 0,
    paused: opts.paused ?? false,
    addEventListener: vi.fn((type: string, cb: () => void) => {
      handlers[type] = cb;
    }),
    removeEventListener: vi.fn((type: string) => {
      delete handlers[type];
    }),
    fire: (type: string) => handlers[type]?.()
  } as unknown as TestVideo;
  return el as unknown as HTMLVideoElement;
}

describe("waitForDecodedFrame", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves immediately when every video already has a decoded frame", async () => {
    let settled = false;
    const promise = waitForDecodedFrame([video(4), video(2)]).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    await promise;
    expect(settled).toBe(true);
  });

  it("resolves once a not-yet-decoded video crosses the readyState threshold", async () => {
    const undecoded = video(1);
    let settled = false;
    waitForDecodedFrame([undecoded]).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(50);
    expect(settled).toBe(false);
    (undecoded as { readyState: number }).readyState = 2;
    await vi.advanceTimersByTimeAsync(50);
    expect(settled).toBe(true);
  });

  it("resolves without rejecting when a video never decodes (cap)", async () => {
    const undecoded = video(1);
    let settled = false;
    const promise = waitForDecodedFrame([undecoded], 500).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(600);
    await promise;
    expect(settled).toBe(true);
    expect(undecoded.readyState).toBe(1);
  });
});

describe("waitForSeek", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves immediately when the seek isn't needed", async () => {
    const v = video(2, { currentTime: 5 });
    const settled = await waitForSeek(v, 5).then(() => true);
    expect(settled).toBe(true);
    expect(v.addEventListener).not.toHaveBeenCalled();
  });

  it("resolves once the seek completes", async () => {
    const v = video(1, { currentTime: 0 });
    let settled = false;
    const promise = waitForSeek(v, 5).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    (v as unknown as TestVideo).fire("seeked");
    await promise;
    expect(settled).toBe(true);
  });

  it("resolves without waiting forever when the seek never completes (cap)", async () => {
    const v = video(1, { currentTime: 0 });
    let settled = false;
    const promise = waitForSeek(v, 5, 500).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(600);
    await promise;
    expect(settled).toBe(true);
  });
});

describe("waitForPlayback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves once the clock has advanced past the starting position", async () => {
    const v = video(2, { currentTime: 0 });
    const promise = waitForPlayback(v, 0).then(() => true);
    // advanceTime() must be awaited *before* mutating currentTime so the poll
    // has a chance to run.
    await vi.advanceTimersByTimeAsync(1);
    (v as unknown as TestVideo).currentTime = 0.1;
    await vi.advanceTimersByTimeAsync(25);
    await expect(promise).resolves.toBe(true);
  });

  it("does not resolve while the clock is frozen (still blank), only at the timeout cap", async () => {
    const v = video(2, { currentTime: 0, paused: true });
    let settled = false;
    const promise = waitForPlayback(v, 0, 200).then(() => {
      settled = true;
    });
    // A whole wall of freeze — no playback advance → must NOT resolve.
    await vi.advanceTimersByTimeAsync(150);
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    await promise;
    expect(settled).toBe(true);
  });

  it("stops re-arming polls after the deadline (no unbounded timer chain)", async () => {
    const v = video(2, { currentTime: 0, paused: true });
    const promise = waitForPlayback(v, 0, 200);
    await vi.advanceTimersByTimeAsync(1000);
    await promise;
    const pending = vi.getTimerCount();
    expect(pending).toBe(0);
  });
});


describe("waitForPresentedFrame", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves once a frame with dimensions has been presented (no rVFC)", async () => {
    const v = video(1, { videoWidth: 0 });
    let settled = false;
    const promise = waitForPresentedFrame(v, 3000).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(25);
    expect(settled).toBe(false);
    (v as unknown as TestVideo).videoWidth = 1280;
    (v as unknown as TestVideo).readyState = 2;
    await vi.advanceTimersByTimeAsync(25);
    await promise;
    expect(settled).toBe(true);
  });

  it("resolves without rejecting when a frame is never presented (cap)", async () => {
    const v = video(1, { videoWidth: 0 });
    let settled = false;
    const promise = waitForPresentedFrame(v, 500).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(600);
    await promise;
    expect(settled).toBe(true);
  });
});