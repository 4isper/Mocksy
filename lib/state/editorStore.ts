"use client";

import { create } from "zustand";
import type { AnimationPreset, EditorScene, MediaType, MockupFrame, StylePreset } from "@/lib/types/editor";
import { DEMO_MEDIA_NAME, DEMO_MEDIA_URL } from "@/lib/media/demoMedia";

export interface EditorStoreState {
  scene: EditorScene;
  past: EditorScene[];
  future: EditorScene[];
  /** Playback scrubber position; kept out of scene so playback doesn't
   *  churn history or re-render scene subscribers every frame. */
  videoCurrentTime: number;
  setScene: (scene: Partial<EditorScene>, recordHistory?: boolean) => void;
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
  setAspectRatio: (aspectRatio: string) => void;
  setVideoMuted: (muted: boolean) => void;
  setVideoLoop: (loop: boolean) => void;
  setVideoAutoplay: (autoplay: boolean) => void;
  setVideoPosterTime: (time: number) => void;
  setVideoDuration: (time: number) => void;
  setVideoCurrentTime: (time: number) => void;
  setVideoTrimStart: (time: number) => void;
  setVideoTrimEnd: (time: number) => void;
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
  aspectRatio: "16 / 9",
  videoMuted: true,
  videoLoop: true,
  videoAutoplay: true,
  videoPosterTime: 0,
  videoDuration: 0,
  videoTrimStart: 0,
  videoTrimEnd: 0
};

const HISTORY_LIMIT = 100;

function pushHistory(s: EditorStoreState, scene: EditorScene) {
  const past = [...s.past, s.scene].slice(-HISTORY_LIMIT);
  return { past, future: [], scene };
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
      return { scene: previous, past: s.past.slice(0, -1), future: [s.scene, ...s.future] };
    }),
  redo: () =>
    set((s) => {
      if (s.future.length === 0) return {};
      const next = s.future[0];
      return { scene: next, past: [...s.past, s.scene], future: s.future.slice(1) };
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
      videoCurrentTime: 0
    })),
  setFrame: (frame) => set((s) => pushHistory(s, { ...s.scene, frame })),
  setStylePreset: (stylePreset) => set((s) => pushHistory(s, { ...s.scene, stylePreset })),
  setAnimationPreset: (animationPreset) => set((s) => pushHistory(s, { ...s.scene, animationPreset })),
  setZoom: (zoom) => set((s) => pushHistory(s, { ...s.scene, zoom })),
  setShadowOpacity: (shadowOpacity) => set((s) => pushHistory(s, { ...s.scene, shadowOpacity })),
  setBorderRadius: (borderRadius) => set((s) => pushHistory(s, { ...s.scene, borderRadius })),
  setBackgroundSolid: (backgroundColor) => set((s) => pushHistory(s, { ...s.scene, backgroundMode: "solid", backgroundColor })),
  setBackgroundGradient: (gradientFrom, gradientTo) => set((s) => pushHistory(s, { ...s.scene, backgroundMode: "gradient", gradientFrom, gradientTo })),
  setBackgroundTransparent: () => set((s) => pushHistory(s, { ...s.scene, backgroundMode: "transparent" })),
  toggleWatermark: (watermarkEnabled) => set((s) => pushHistory(s, { ...s.scene, watermarkEnabled })),
  setWatermarkText: (watermarkText) => set((s) => pushHistory(s, { ...s.scene, watermarkText })),
  setAspectRatio: (aspectRatio) => set((s) => pushHistory(s, { ...s.scene, aspectRatio })),
  setVideoMuted: (videoMuted) => set((s) => pushHistory(s, { ...s.scene, videoMuted })),
  setVideoLoop: (videoLoop) => set((s) => pushHistory(s, { ...s.scene, videoLoop })),
  setVideoAutoplay: (videoAutoplay) => set((s) => pushHistory(s, { ...s.scene, videoAutoplay })),
  setVideoPosterTime: (videoPosterTime) => set((s) => pushHistory(s, { ...s.scene, videoPosterTime })),
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
    set((s) => pushHistory(s, { ...s.scene, videoTrimStart: Math.min(videoTrimStart, s.scene.videoTrimEnd || videoTrimStart) })),
  setVideoTrimEnd: (videoTrimEnd) =>
    set((s) => pushHistory(s, { ...s.scene, videoTrimEnd: Math.max(videoTrimEnd, s.scene.videoTrimStart) }))
}));

// After any state change, free blob: media URLs that history can no longer
// reach (covers setMedia, undo, redo, Clear, and scene replacement).
useEditorStore.subscribe(revokeOrphanedBlobs);
