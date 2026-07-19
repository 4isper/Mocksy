"use client";

import { create } from "zustand";
import type { AnimationPreset, EditorScene, MediaType, MockupFrame, StylePreset } from "@/lib/types/editor";

interface EditorStoreState {
  scene: EditorScene;
  setScene: (scene: EditorScene) => void;
  setMedia: (mediaUrl: string | null, mediaType: MediaType, mediaName?: string | null) => void;
  setFrame: (frame: MockupFrame) => void;
  setStylePreset: (stylePreset: StylePreset) => void;
  setAnimationPreset: (animationPreset: AnimationPreset) => void;
  setZoom: (zoom: number) => void;
  setShadowOpacity: (shadowOpacity: number) => void;
  setBorderRadius: (radius: number) => void;
  setBackgroundSolid: (color: string) => void;
  setBackgroundGradient: (from: string, to: string) => void;
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

const initialScene: EditorScene = {
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

export const useEditorStore = create<EditorStoreState>((set) => ({
  scene: initialScene,
  setScene: (scene) => set(() => ({ scene: { ...initialScene, ...scene } })),
  setMedia: (mediaUrl, mediaType, mediaName = null) =>
    set((s) => ({
      scene: {
        ...s.scene,
        mediaUrl,
        mediaType,
        mediaName,
        videoDuration: 0,
        videoCurrentTime: 0,
        videoTrimStart: 0,
        videoTrimEnd: 0
      }
    })),
  setFrame: (frame) => set((s) => ({ scene: { ...s.scene, frame } })),
  setStylePreset: (stylePreset) => set((s) => ({ scene: { ...s.scene, stylePreset } })),
  setAnimationPreset: (animationPreset) => set((s) => ({ scene: { ...s.scene, animationPreset } })),
  setZoom: (zoom) => set((s) => ({ scene: { ...s.scene, zoom } })),
  setShadowOpacity: (shadowOpacity) => set((s) => ({ scene: { ...s.scene, shadowOpacity } })),
  setBorderRadius: (borderRadius) => set((s) => ({ scene: { ...s.scene, borderRadius } })),
  setBackgroundSolid: (backgroundColor) =>
    set((s) => ({ scene: { ...s.scene, backgroundMode: "solid", backgroundColor } })),
  setBackgroundGradient: (gradientFrom, gradientTo) =>
    set((s) => ({ scene: { ...s.scene, backgroundMode: "gradient", gradientFrom, gradientTo } })),
  toggleWatermark: (watermarkEnabled) => set((s) => ({ scene: { ...s.scene, watermarkEnabled } })),
  setWatermarkText: (watermarkText) => set((s) => ({ scene: { ...s.scene, watermarkText } })),
  setAspectRatio: (aspectRatio) => set((s) => ({ scene: { ...s.scene, aspectRatio } })),
  setVideoMuted: (videoMuted) => set((s) => ({ scene: { ...s.scene, videoMuted } })),
  setVideoLoop: (videoLoop) => set((s) => ({ scene: { ...s.scene, videoLoop } })),
  setVideoAutoplay: (videoAutoplay) => set((s) => ({ scene: { ...s.scene, videoAutoplay } })),
  setVideoPosterTime: (videoPosterTime) => set((s) => ({ scene: { ...s.scene, videoPosterTime } })),
  setVideoDuration: (videoDuration) =>
    set((s) => ({
      scene: {
        ...s.scene,
        videoDuration,
        videoTrimEnd: s.scene.videoTrimEnd > 0 ? Math.min(s.scene.videoTrimEnd, videoDuration) : videoDuration
      }
    })),
  setVideoCurrentTime: (videoCurrentTime) => set((s) => ({ scene: { ...s.scene, videoCurrentTime } })),
  setVideoTrimStart: (videoTrimStart) =>
    set((s) => ({ scene: { ...s.scene, videoTrimStart: Math.min(videoTrimStart, s.scene.videoTrimEnd || videoTrimStart) } })),
  setVideoTrimEnd: (videoTrimEnd) =>
    set((s) => ({ scene: { ...s.scene, videoTrimEnd: Math.max(videoTrimEnd, s.scene.videoTrimStart) } }))
}));
