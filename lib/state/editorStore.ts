"use client";

import { create } from "zustand";
import type { AnimationPreset, EditorScene, MediaType, MockupFrame, StylePreset, VideoQuality, WatermarkPosition } from "@/lib/types/editor";
import { DEMO_MEDIA_NAME, DEMO_MEDIA_URL } from "@/lib/media/demoMedia";
import { ASPECT_RATIOS } from "@/lib/render/frames";

export interface EditorStoreState {
  scene: EditorScene;
  past: EditorScene[];
  future: EditorScene[];
  /** Playback scrubber position; kept out of scene so playback doesn't
   *  churn history or re-render scene subscribers every frame. */
  videoCurrentTime: number;
  /** Groups rapid same-field edits (e.g. slider drags) into one undo step. */
  lastHistoryKey: string | null;
  lastHistoryAt: number;
  /** True while uploaded media is decoding (between setMedia and onLoad). */
  isMediaLoading: boolean;
  setScene: (scene: Partial<EditorScene>, recordHistory?: boolean) => void;
  setMediaLoading: (loading: boolean) => void;
  resetScene: () => void;
  undo: () => void;
  redo: () => void;
  setMedia: (mediaUrl: string | null, mediaType: MediaType, mediaName?: string | null) => void;
  setFrame: (frame: MockupFrame) => void;
  setStylePreset: (stylePreset: StylePreset) => void;
  setAnimationPreset: (animationPreset: AnimationPreset) => void;
  setZoom: (zoom: number) => void;
  setShadowOpacity: (shadowOpacity: number) => void;
  setBorderRadius: (radius: number) => void;
  setBackgroundSolid: (color: string) => void;
  setBackgroundGradient: (from: string, to: string) => void;
  setBackgroundTransparent: () => void;
  toggleWatermark: (enabled: boolean) => void;
  setWatermarkText: (text: string) => void;
  setWatermarkPosition: (position: WatermarkPosition) => void;
  setWatermarkSize: (size: number) => void;
  setAspectRatio: (aspectRatio: string) => void;
  setVideoMuted: (muted: boolean) => void;
  setVideoLoop: (loop: boolean) => void;
  setVideoAutoplay: (autoplay: boolean) => void;
  setVideoPosterTime: (time: number) => void;
  setVideoDuration: (time: number) => void;
  setVideoCurrentTime: (time: number) => void;
  setVideoTrimStart: (time: number) => void;
  setVideoTrimEnd: (time: number) => void;
  setVideoQuality: (quality: VideoQuality) => void;
}

export const initialScene: EditorScene = {
  mediaUrl: null,
  mediaType: "none",
  mediaName: null,
  frame: "iphone",
  stylePreset: "default",
  animationPreset: "none",
  zoom: 1,
  shadowOpacity: 0.4,
  borderRadius: 20,
  backgroundMode: "gradient",
  backgroundColor: "#111827",
  gradientFrom: "#1d4ed8",
  gradientTo: "#7c3aed",
  watermarkText: "Mocksy",
  watermarkEnabled: false,
  watermarkPosition: "bottom-right",
  watermarkSize: 13,
  aspectRatio: ASPECT_RATIOS[0] ?? "16 / 9",
  videoMuted: true,
  videoLoop: true,
  videoAutoplay: true,
  videoPosterTime: 0,
  videoDuration: 0,
  videoTrimStart: 0,
  videoTrimEnd: 0,
  videoQuality: "medium"
};

const HISTORY_LIMIT = 100;
/** Edits of the same field within this window collapse into one undo step,
 *  so dragging a slider doesn't flood history with a record per pixel. */
const COALESCE_MS = 400;

function pushHistory(s: EditorStoreState, scene: EditorScene, coalesceKey?: string) {
  const now = Date.now();
  // Coalesce rapid repeats of the same field: keep the pre-drag baseline in
  // past and only update the current scene, so undo returns to the value
  // before the drag rather than one pixel of it.
  if (coalesceKey && coalesceKey === s.lastHistoryKey && now - s.lastHistoryAt < COALESCE_MS) {
    return { scene, lastHistoryAt: now };
  }
  const past = [...s.past, s.scene].slice(-HISTORY_LIMIT);
  return { past, future: [], scene, lastHistoryKey: coalesceKey ?? null, lastHistoryAt: now };
}

/**
 * Returns the blob: media URLs that existed in `prev` but are no longer
 * reachable from `state` (current, past, or future). Blob URLs are one-shot,
 * so revoking one that history could still restore (via undo/redo) would
 * leave a dead canvas.
 */
export function orphanedBlobUrls(state: EditorStoreState, prev: EditorStoreState): string[] {
  const live = new Set<string>();
  if (state.scene.mediaUrl?.startsWith("blob:")) live.add(state.scene.mediaUrl);
  for (const s of state.past) if (s.mediaUrl?.startsWith("blob:")) live.add(s.mediaUrl);
  for (const s of state.future) if (s.mediaUrl?.startsWith("blob:")) live.add(s.mediaUrl);

  const prevBlobs = new Set<string>();
  if (prev.scene.mediaUrl?.startsWith("blob:")) prevBlobs.add(prev.scene.mediaUrl);
  for (const s of prev.past) if (s.mediaUrl?.startsWith("blob:")) prevBlobs.add(s.mediaUrl);
  for (const s of prev.future) if (s.mediaUrl?.startsWith("blob:")) prevBlobs.add(s.mediaUrl);

  return [...prevBlobs].filter((url) => !live.has(url));
}

function revokeOrphanedBlobs(state: EditorStoreState, prev: EditorStoreState) {
  for (const url of orphanedBlobUrls(state, prev)) URL.revokeObjectURL(url);
}

export const useEditorStore = create<EditorStoreState>((set) => ({
  scene: initialScene,
  past: [],
  future: [],
  videoCurrentTime: 0,
  lastHistoryKey: null,
  lastHistoryAt: 0,
  isMediaLoading: false,
  setScene: (scene, recordHistory = true) =>
    set((s) => {
      const next = { ...s.scene, ...scene };
      if (!recordHistory) return { scene: next };
      return pushHistory(s, next);
    }),
  resetScene: () =>
    set((s) =>
      pushHistory(s, {
        ...initialScene,
        mediaUrl: DEMO_MEDIA_URL,
        mediaType: "image",
        mediaName: DEMO_MEDIA_NAME
      })
    ),
  undo: () =>
    set((s) => {
      if (s.past.length === 0) return {};
      const previous = s.past[s.past.length - 1];
      // Playback position lives outside the scene, so re-sync it to the
      // restored scene's poster time instead of leaving the timeline slider
      // pointing at a moment that no longer matches the video.
      return { scene: previous, past: s.past.slice(0, -1), future: [s.scene, ...s.future], videoCurrentTime: previous?.videoPosterTime ?? 0 };
    }),
  redo: () =>
    set((s) => {
      if (s.future.length === 0) return {};
      const next = s.future[0];
      return { scene: next, past: [...s.past, s.scene], future: s.future.slice(1), videoCurrentTime: next?.videoPosterTime ?? 0 };
    }),
  setMedia: (mediaUrl, mediaType, mediaName = null) =>
    set((s) => ({
      ...pushHistory(s, {
        ...s.scene,
        mediaUrl,
        mediaType,
        mediaName,
        videoDuration: 0,
        videoTrimStart: 0,
        videoTrimEnd: 0
      }),
      videoCurrentTime: 0,
      // A real upload decodes asynchronously; clear media stops loading.
      isMediaLoading: mediaUrl != null
    })),
  setMediaLoading: (loading) => set({ isMediaLoading: loading }),
  setFrame: (frame) => set((s) => pushHistory(s, { ...s.scene, frame })),
  setStylePreset: (stylePreset) => set((s) => pushHistory(s, { ...s.scene, stylePreset })),
  setAnimationPreset: (animationPreset) => set((s) => pushHistory(s, { ...s.scene, animationPreset })),
  setZoom: (zoom) => set((s) => pushHistory(s, { ...s.scene, zoom }, "zoom")),
  setShadowOpacity: (shadowOpacity) => set((s) => pushHistory(s, { ...s.scene, shadowOpacity }, "shadow")),
  setBorderRadius: (borderRadius) => set((s) => pushHistory(s, { ...s.scene, borderRadius }, "radius")),
  setBackgroundSolid: (backgroundColor) => set((s) => pushHistory(s, { ...s.scene, backgroundMode: "solid", backgroundColor })),
  setBackgroundGradient: (gradientFrom, gradientTo) => set((s) => pushHistory(s, { ...s.scene, backgroundMode: "gradient", gradientFrom, gradientTo })),
  setBackgroundTransparent: () => set((s) => pushHistory(s, { ...s.scene, backgroundMode: "transparent" })),
  toggleWatermark: (watermarkEnabled) => set((s) => pushHistory(s, { ...s.scene, watermarkEnabled })),
  setWatermarkText: (watermarkText) => set((s) => pushHistory(s, { ...s.scene, watermarkText })),
  setWatermarkPosition: (watermarkPosition) => set((s) => pushHistory(s, { ...s.scene, watermarkPosition })),
  setWatermarkSize: (watermarkSize) => set((s) => pushHistory(s, { ...s.scene, watermarkSize: Math.max(8, Math.min(64, Math.round(watermarkSize))) }, "watermarkSize")),
  setAspectRatio: (aspectRatio) => set((s) => pushHistory(s, { ...s.scene, aspectRatio })),
  setVideoMuted: (videoMuted) => set((s) => pushHistory(s, { ...s.scene, videoMuted })),
  setVideoLoop: (videoLoop) => set((s) => pushHistory(s, { ...s.scene, videoLoop })),
  setVideoAutoplay: (videoAutoplay) => set((s) => pushHistory(s, { ...s.scene, videoAutoplay })),
  setVideoPosterTime: (videoPosterTime) => set((s) => pushHistory(s, { ...s.scene, videoPosterTime }, "poster")),
  setVideoDuration: (videoDuration) =>
    set((s) =>
      pushHistory(s, {
        ...s.scene,
        videoDuration,
        videoTrimEnd: s.scene.videoTrimEnd > 0 ? Math.min(s.scene.videoTrimEnd, videoDuration) : videoDuration
      })
    ),
  setVideoCurrentTime: (videoCurrentTime) => set({ videoCurrentTime }),
  setVideoTrimStart: (videoTrimStart) =>
    set((s) => pushHistory(s, { ...s.scene, videoTrimStart: Math.min(videoTrimStart, s.scene.videoTrimEnd || videoTrimStart) }, "trimStart")),
  setVideoTrimEnd: (videoTrimEnd) =>
    set((s) =>
      pushHistory(s, {
        ...s.scene,
        // A zero (or negative) end means "not trimmed" — clamp to the full
        // duration so 0 never lingers in state as a confusing sentinel.
        videoTrimEnd: videoTrimEnd <= 0 ? s.scene.videoDuration : Math.max(videoTrimEnd, s.scene.videoTrimStart)
      }, "trimEnd")
    ),
  setVideoQuality: (videoQuality) => set((s) => pushHistory(s, { ...s.scene, videoQuality }))
}));

// After any state change, free blob: media URLs that history can no longer
// reach (covers setMedia, undo, redo, Clear, and scene replacement).
useEditorStore.subscribe(revokeOrphanedBlobs);
