"use client";

import type { EditorScene, MediaLayer, VideoQuality } from "@/lib/types/editor";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { sanitizeFilename } from "@/lib/export/filename";

export { sanitizeFilename };

/** Media layer driving the export (active layer, falling back to the first). */
export function activeLayerOf(scene: EditorScene, activeLayerId: string | null = scene.activeLayerId): MediaLayer | null {
  return scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0] ?? null;
}

/** Base export filename (media name with its extension stripped, or the default). */
export function exportBaseName(scene: EditorScene, activeLayerId: string | null = scene.activeLayerId): string {
  const name = activeLayerOf(scene, activeLayerId)?.mediaName || "mocksy-export";
  return sanitizeFilename(name.replace(/\.[^.]+$/, ""));
}

/**
 * Capture pixel ratio for a quality tier. Higher tiers keep more of the
 * device's native ratio; lower tiers downscale to shrink the output file.
 * The 2x floor keeps overlays readable; reads window.devicePixelRatio so it
 * can be stubbed in tests.
 */
export function resolvePixelRatio(videoQuality: VideoQuality): number {
  const quality = QUALITY[videoQuality] ?? QUALITY.medium;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return Math.max(2, dpr) * quality.scale;
}

/**
 * Records video scenes for their trimmed length; still-image scenes play the
 * configured animation loop. Returns seconds.
 */
export function computeCaptureDuration(scene: EditorScene, activeLayerId: string | null = scene.activeLayerId): number {
  const active = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
  const isVideo = active ? isVideoLayer(active) && active.mediaUrl != null : false;
  const fallbackSec = Math.max(0.5, scene.animationDurationMs / 1000);
  if (!isVideo || !active) return fallbackSec;
  const start = Math.max(0, active.videoTrimStart || 0);
  const end = active.videoTrimEnd > start ? active.videoTrimEnd : active.videoDuration;
  // Metadata may not have loaded yet (undefined/0) or a trim may be
  // misconfigured; never let a non-finite or empty duration collapse the
  // recording to zero frames.
  if (typeof end !== "number" || !isFinite(end) || end <= 0) return fallbackSec;
  return Math.max(0.2, end - start);
}

/**
 * Picks a WebM codec the browser can record. VP8 is preferred over VP9: the
 * WebM blob is an intermediate (MP4/GIF are re-encoded by FFmpeg anyway), and
 * VP8's software encoder is several times faster than VP9's — important on
 * GPU-less machines and CI runners, where a VP9 capture of motion-heavy video
 * scenes can stall for minutes.
 */
export function chooseWebmMimeType(): string {
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
    return "video/webm;codecs=vp8";
  }
  return "video/webm;codecs=vp9";
}

/**
 * Per-quality export tuning. fps and the VPX/webm capture rate stay fixed; the
 * MP4 encode quality (mpeg4 has no real bitrate control, so we use -q:v, lower
 * is better) and the capture resolution scale drive the output size. "high"
 * keeps the full device-pixel-ratio canvas; lower tiers downscale it.
 */
export const QUALITY: Record<VideoQuality, { qscale: number; scale: number }> = {
  low: { qscale: 10, scale: 0.5 },
  medium: { qscale: 5, scale: 0.75 },
  high: { qscale: 2, scale: 1 }
};
