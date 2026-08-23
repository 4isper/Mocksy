"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import {
  cancelScreenRecording,
  isScreenRecordingActive,
  isScreenRecordingSupported,
  onScreenRecordingChange,
  startScreenRecording,
  stopScreenRecording
} from "@/lib/media/screenRecording";
import { loadMediaFromFile } from "@/lib/media/loadFile";
import { useEditorStore } from "@/lib/state/editorStore";

/** Static subscribe/no-op and server snapshot for never-changing client flags. */
const noSubscribe = () => () => {};
const isServerUnsupported = () => false;

/** Elapsed-seconds ticker for the active recording. */
function useElapsed(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => {
      clearInterval(timer);
      setElapsed(0);
    };
  }, [active]);
  return elapsed;
}

/** Loads a finished recording into the active layer (same flow as upload).
 *  Shared by the MediaSection hook and the command-palette entry. Throws on
 *  decode/encode failure so callers can surface a translated message. */
export async function loadRecordedClip(blob: Blob | null): Promise<void> {
  if (!blob) return;
  const file = new File([blob], "Screen recording.webm", { type: "video/webm" });
  const { url, mediaType, mediaName } = await loadMediaFromFile(file);
  useEditorStore.getState().setMediaUploadError(null);
  useEditorStore.getState().setScenePalette(null);
  useEditorStore.getState().setMedia(url, mediaType, mediaName);
}

/**
 * Screen-recording controller for the editor: starts a display capture and
 * loads the finished WebM clip into the active layer (same flow as a file
 * upload). Denying the browser's share prompt is a silent no-op.
 */
export function useScreenRecording(): {
  supported: boolean;
  recording: boolean;
  elapsed: number;
  start: () => void;
  stop: () => void;
  cancel: () => void;
} {
  const t = useTranslations();
  // Lazy init covers remounts while a session runs; the subscription keeps it
  // fresh afterwards. No synchronous setState in the effect body (lint rule).
  const [recording, setRecording] = useState(() =>
    typeof window === "undefined" ? false : isScreenRecordingActive()
  );
  const busyRef = useRef(false);
  const elapsed = useElapsed(recording);
  const setMediaUploadError = useEditorStore((s) => s.setMediaUploadError);

  useEffect(() => onScreenRecordingChange(setRecording), []);

  const loadClip = useCallback(
    async (blob: Blob | null) => {
      busyRef.current = false;
      try {
        await loadRecordedClip(blob);
      } catch {
        setMediaUploadError(t("editor.uploadError"));
      }
    },
    [setMediaUploadError, t]
  );

  const start = useCallback(() => {
    if (busyRef.current || isScreenRecordingActive()) return;
    busyRef.current = true;
    void startScreenRecording({
      onDone: (blob) => void loadClip(blob),
      onError: (message) => setMediaUploadError(message || t("editor.screenRecordError"))
    }).catch(() => {
      busyRef.current = false;
      setMediaUploadError(t("editor.screenRecordError"));
    });
  }, [loadClip, setMediaUploadError, t]);

  const cancel = useCallback(() => cancelScreenRecording(), []);

  // Feature detection must not run during the first (server-matched) render:
  // navigator exists only on the client, and an eager check makes the SSR
  // HTML disagree with hydration. useSyncExternalStore serves `false` on the
  // server and the real check on the client without a setState-in-effect
  // cascade; support never changes mid-session, so no subscription is needed.
  const supported = useSyncExternalStore(
    noSubscribe,
    isScreenRecordingSupported,
    isServerUnsupported
  );

  return {
    supported,
    recording,
    elapsed,
    start,
    // stop finalizes; exposed under the same button that started it. Cancel
    // stays available programmatically (Esc handling lives in the module).
    stop: stopScreenRecording,
    cancel
  };
}
