import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitForDecodedFrame } from "@/lib/export/videoRecorder";

function video(readyState: number) {
  return { readyState } as unknown as HTMLVideoElement;
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