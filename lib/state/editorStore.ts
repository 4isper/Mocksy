"use client";

import { create } from "zustand";
import type { AnimationPreset, EditorScene, MediaType, MockupFrame, StylePreset } from "@/lib/types/editor";
import { DEMO_MEDIA_NAME, DEMO_MEDIA_URL } from "@/lib/media/demoMedia";

interface EditorStoreState {
  scene: EditorScene;
  past: EditorScene[];
  future: EditorScene[];
  setScene: (scene: Partial<EditorScene>) => void;
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
  videoCurrentTime: 0,
  videoTrimStart: 0,
  videoTrimEnd: 0
};

const HISTORY_LIMIT = 100;

function pushHistory(s: EditorStoreState, scene: EditorScene) {
  if (s.scene.mediaUrl && s.scene.mediaUrl.startsWith("blob:") && s.scene.mediaUrl !== scene.mediaUrl) {
    URL.revokeObjectURL(s.scene.mediaUrl);
  }
  const past = [...s.past, s.scene].slice(-HISTORY_LIMIT);
  return { past, future: [], scene };
}

export const useEditorStore = create<EditorStoreState>((set) => ({
  scene: initialScene,
  past: [],
  future: [],
  setScene: (scene) => set((s) => pushHistory(s, { ...initialScene, ...scene })),
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
    set((s) =>
      pushHistory(s, {
        ...s.scene,
        mediaUrl,
        mediaType,
        mediaName,
        videoDuration: 0,
        videoCurrentTime: 0,
        videoTrimStart: 0,
        videoTrimEnd: 0
      })
    ),
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
  setVideoCurrentTime: (videoCurrentTime) => set((s) => ({ scene: { ...s.scene, videoCurrentTime } })),
  setVideoTrimStart: (videoTrimStart) =>
    set((s) => pushHistory(s, { ...s.scene, videoTrimStart: Math.min(videoTrimStart, s.scene.videoTrimEnd || videoTrimStart) })),
  setVideoTrimEnd: (videoTrimEnd) =>
    set((s) => pushHistory(s, { ...s.scene, videoTrimEnd: Math.max(videoTrimEnd, s.scene.videoTrimStart) }))
}));
