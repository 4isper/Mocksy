"use client";

import { chooseWebmMimeType } from "@/lib/export/videoExportHelpers";

/** A running screen-recording session. `stop` finalizes and resolves the
 *  captured WebM; `cancel` discards it. The browser's own "Stop sharing"
 *  chrome button behaves like stop. */
export interface ScreenRecordingSession {
  stop: () => void;
  cancel: () => void;
}

interface ActiveRecording {
  recorder: MediaRecorder;
  stream: MediaStream;
  finish: (blob: Blob | null) => void;
}

export type RecordingListener = (active: boolean) => void;

let active: ActiveRecording | null = null;
/** True between a start request and the moment the session is either running
 *  or definitively not started. The getDisplayMedia picker can stay open for
 *  seconds — without this guard a second start request (e.g. toolbar button +
 *  command palette) passes the `active` check, both recorders launch, and the
 *  first session's stream becomes unreachable through this module: its tracks
 *  keep the screen-capture indicator alive until the page reloads. */
let starting = false;
/** Last state announced to listeners; guards against duplicate notifications
 *  because `active` is reassigned before/around cleanup. */
let announcedActive = false;
const listeners = new Set<RecordingListener>();

function setActive(next: ActiveRecording | null) {
  const nowActive = next !== null;
  if (announcedActive === nowActive) return;
  announcedActive = nowActive;
  for (const fn of listeners) fn(nowActive);
}

/** True while a screen recording is in progress (module-level singleton, so
 *  UI can unmount/remount without losing the session). */
export function isScreenRecordingActive(): boolean {
  return active !== null;
}

/** Subscribes to recording start/stop notifications. Returns an unsubscribe
 *  function. */
export function onScreenRecordingChange(listener: RecordingListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True when this browser can capture the display and encode a clip. */
export function isScreenRecordingSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

function teardown(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop();
}

/**
 * Starts capturing the display/tab/window into a WebM blob. The returned
 * promise resolves once recording has actually started (after the user picks
 * a surface); the blob is delivered through `onDone` — null means the user
 * denied the permission or cancelled, in which case nothing is surfaced.
 */
export async function startScreenRecording(options: {
  onDone: (blob: Blob | null) => void;
  onError?: (message: string) => void;
}): Promise<void> {
  if (!isScreenRecordingSupported()) {
    options.onError?.("Screen recording is not supported in this browser.");
    options.onDone(null);
    return;
  }
  if (active || starting) {
    options.onError?.("A screen recording is already in progress.");
    return;
  }
  starting = true;
  try {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false
      });
    } catch (err) {
      // Permission denial / picker dismissal is a normal cancel — not an error.
      if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "AbortError")) {
        options.onDone(null);
        return;
      }
      options.onError?.(err instanceof Error ? err.message : "Failed to start screen recording.");
      options.onDone(null);
      return;
    }

    let recorder: MediaRecorder;
    try {
      const mimeType = chooseWebmMimeType();
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      // Some platforms refuse explicit mime types; fall back to the default.
      try {
        recorder = new MediaRecorder(stream);
      } catch (err) {
        teardown(stream);
        options.onError?.(err instanceof Error ? err.message : "Screen recording is not supported here.");
        options.onDone(null);
        return;
      }
    }

    const chunks: BlobPart[] = [];
    let finished = false;

    const cleanup = () => {
      stream.getVideoTracks().forEach((track) => {
        track.onended = null;
      });
      teardown(stream);
      setActive(null);
    };

    const finish = (blob: Blob | null) => {
      if (finished) return;
      finished = true;
      cleanup();
      active = null;
      options.onDone(blob);
    };

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      // Label the blob with the recorder's ACTUAL format — when no explicit
      // mimeType was requested (Safari) the default can be MP4, and a hardcoded
      // "video/webm" would mislabel the bytes.
      finish(chunks.length > 0 ? new Blob(chunks, { type: recorder.mimeType || "video/webm" }) : null);
    };

    // The browser's native "Stop sharing" control ends the video track.
    stream.getVideoTracks().forEach((track) => {
      track.onended = () => {
        if (recorder.state !== "inactive") recorder.stop();
      };
    });

    active = { recorder, stream, finish };
    setActive(active);
    recorder.start(200);
  } finally {
    // `active` is already set for a running session (later calls are blocked
    // by the `active` check); the flag only guards the async start window.
    starting = false;
  }
}

/** Finalizes the current recording and delivers its blob. */
export function stopScreenRecording(): void {
  const current = active;
  if (!current) return;
  if (current.recorder.state !== "inactive") current.recorder.stop();
}

/** Aborts the current recording without producing a blob. */
export function cancelScreenRecording(): void {
  const current = active;
  if (!current) return;
  current.recorder.onstop = null;
  if (current.recorder.state !== "inactive") current.recorder.stop();
  current.finish(null);
}
