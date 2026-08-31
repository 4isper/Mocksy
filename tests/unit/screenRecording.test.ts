import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelScreenRecording,
  isScreenRecordingActive,
  isScreenRecordingSupported,
  onScreenRecordingChange,
  startScreenRecording,
  stopScreenRecording
} from "@/lib/media/screenRecording";

/** Fake MediaStream with stoppable video tracks. */
function fakeStream() {
  const tracks = [
    { kind: "video", stop: vi.fn(), onended: null as (() => void) | null }
  ];
  const stream = {
    getTracks: () => tracks,
    getVideoTracks: () => tracks
  } as unknown as MediaStream;
  return { stream, tracks };
}

/** Installs stubs for navigator.mediaDevices.getDisplayMedia and MediaRecorder.
 *  Returns handles to drive the fake recorder in tests. */
function stubCapture({ deny = false } = {}) {
  const { stream, tracks } = fakeStream();
  const getDisplayMedia = vi.fn(deny ? vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")) : vi.fn().mockResolvedValue(stream));
  interface Rec {
    state: string;
    start: () => void;
    stop: () => void;
    ondataavailable: ((e: { data: Blob }) => void) | null;
    onstop: (() => void) | null;
    mimeType?: string;
  }
  const instances: Rec[] = [];
  const FakeMediaRecorder = function (_stream: MediaStream, options?: { mimeType?: string }) {
    const rec: Rec = {
      state: "inactive",
      start: () => { rec.state = "recording"; },
      stop: () => {
        rec.state = "inactive";
        queueMicrotask(() => rec.onstop?.());
      },
      ondataavailable: null,
      onstop: null,
      mimeType: options?.mimeType
    };
    instances.push(rec);
    return rec;
  } as unknown as (new (stream: MediaStream, options?: { mimeType?: string }) => MediaRecorder);
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  vi.stubGlobal("navigator", {
    mediaDevices: { getDisplayMedia }
  });
  return {
    getDisplayMedia,
    instances,
    stream,
    emitData: (size = 10) => {
      const rec = instances[0]!;
      rec.ondataavailable?.({ data: new Blob(["x".repeat(size)], { type: "video/webm" }) });
    },
    endTrack: () => {
      tracks[0]!.onended?.();
    }
  };
}

beforeEach(() => {
  // Reset module-level singleton between tests via a cancel no-op.
  cancelScreenRecording();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("screenRecording", () => {
  it("reports support based on capability detection", () => {
    stubCapture();
    expect(isScreenRecordingSupported()).toBe(true);
    vi.stubGlobal("navigator", {});
    expect(isScreenRecordingSupported()).toBe(false);
  });

  it("resolves onDone(null) when the user denies the share prompt", async () => {
    stubCapture({ deny: true });
    const onDone = vi.fn();
    await startScreenRecording({ onDone });
    expect(onDone).toHaveBeenCalledWith(null);
    expect(isScreenRecordingActive()).toBe(false);
  });

  it("starts, collects chunks and delivers a blob on stop", async () => {
    const capture = stubCapture();
    const onDone = vi.fn();
    await startScreenRecording({ onDone });
    expect(isScreenRecordingActive()).toBe(true);
    capture.emitData(5);
    capture.emitData(7);
    stopScreenRecording();
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    const blob = onDone.mock.calls[0]![0] as Blob;
    expect(blob.size).toBe(12);
    expect(blob.type).toBe("video/webm");
    expect(isScreenRecordingActive()).toBe(false);
    // All captured tracks were released.
    for (const track of capture.stream.getTracks()) expect(track.stop).toHaveBeenCalled();
  });

  it("treats the browser's native 'Stop sharing' like stop", async () => {
    const capture = stubCapture();
    const onDone = vi.fn();
    await startScreenRecording({ onDone });
    capture.emitData(3);
    capture.endTrack();
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect((onDone.mock.calls[0]![0] as Blob).size).toBe(3);
  });

  it("cancel discards the clip: onDone(null), no data blob", async () => {
    const capture = stubCapture();
    const onDone = vi.fn();
    await startScreenRecording({ onDone });
    capture.emitData(4);
    cancelScreenRecording();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(null);
    expect(isScreenRecordingActive()).toBe(false);
  });

  it("refuses a second concurrent session", async () => {
    stubCapture();
    const first = vi.fn();
    await startScreenRecording({ onDone: first });
    const onError = vi.fn();
    const second = vi.fn();
    await startScreenRecording({ onDone: second, onError });
    expect(second).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    stopScreenRecording();
  });

  it("refuses a second start while the picker is still open", async () => {
    const capture = stubCapture();
    let resolvePicker: (stream: MediaStream) => void = () => {};
    capture.getDisplayMedia.mockImplementationOnce(
      () => new Promise<MediaStream>((resolve) => { resolvePicker = resolve; })
    );
    const onDone = vi.fn();
    const first = startScreenRecording({ onDone });
    // The picker is open (getDisplayMedia pending): `active` is still null,
    // but a second request must be blocked or both recorders would run and
    // the first stream would leak.
    const onError = vi.fn();
    const second = vi.fn();
    await startScreenRecording({ onDone: second, onError });
    expect(second).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    // The first session proceeds normally once the user picks a surface.
    resolvePicker(capture.stream);
    await first;
    expect(isScreenRecordingActive()).toBe(true);
    stopScreenRecording();
  });

  it("notifies listeners when recording starts and stops", async () => {
    const capture = stubCapture();
    const events: boolean[] = [];
    const unsubscribe = onScreenRecordingChange((activeFlag) => events.push(activeFlag));
    await startScreenRecording({ onDone: vi.fn() });
    stopScreenRecording();
    await vi.waitFor(() => expect(events).toEqual([true, false]));
    unsubscribe();
  });

  it("surfaces errors when capture is unavailable", async () => {
    vi.stubGlobal("MediaRecorder", undefined);
    vi.stubGlobal("navigator", { mediaDevices: { getDisplayMedia: vi.fn() } });
    const onDone = vi.fn();
    const onError = vi.fn();
    await startScreenRecording({ onDone, onError });
    expect(onDone).toHaveBeenCalledWith(null);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
