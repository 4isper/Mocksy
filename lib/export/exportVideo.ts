"use client";

import type { EditorScene, VideoQuality } from "@/lib/types/editor";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { loadImage, renderMockupToCanvas, type RenderTransform } from "@/lib/export/renderMockup";
import { sampleVideoTransform } from "@/lib/render/videoComposer";
import { getFrameSpec } from "@/lib/render/frames";
import { isVideoLayer } from "@/lib/render/mediaKind";

let ffmpegSingleton: FFmpeg | null = null;

async function getFfmpegInstance(onStatus?: (message: string) => void) {
  if (ffmpegSingleton) return ffmpegSingleton;

  const ffmpeg = new FFmpeg();
  onStatus?.("Preparing encoder…");
  await ffmpeg.load({
    coreURL: "/ffmpeg-core.js",
    wasmURL: "/ffmpeg-core.wasm",
  });
  ffmpegSingleton = ffmpeg;
  return ffmpeg;
}

/** Releases the cached FFmpeg instance and its WASM worker. Call when the
 *  editor is torn down or memory is tight; the next export will re-load it. */
export function terminateFfmpeg() {
  if (!ffmpegSingleton) return;
  // terminate() exists on the real FFmpeg class; guard for test stubs.
  (ffmpegSingleton as unknown as { terminate?: () => void }).terminate?.();
  ffmpegSingleton = null;
}

/** Duration of an animated still-image export, in seconds. */
const ANIMATION_DURATION_SEC = 3;

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
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
 * fixed animation loop. Returns seconds.
 */
export function computeCaptureDuration(scene: EditorScene): number {
  const active = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
  const isVideo = active ? isVideoLayer(active) && active.mediaUrl != null : false;
  if (!isVideo || !active) return ANIMATION_DURATION_SEC;
  const start = Math.max(0, active.videoTrimStart || 0);
  const end = active.videoTrimEnd > start ? active.videoTrimEnd : active.videoDuration;
  return Math.max(0.2, end - start);
}

/** Picks the best WebM codec the browser can record. */
export function chooseWebmMimeType(): string {
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
    return "video/webm;codecs=vp9";
  }
  return "video/webm;codecs=vp8";
}

/**
 * Per-quality export tuning. fps and the VPX/webm capture rate stay fixed; the
 * MP4 encode quality (mpeg4 has no real bitrate control, so we use -q:v, lower
 * is better) and the capture resolution scale drive the output size. "high"
 * keeps the full device-pixel-ratio canvas; lower tiers downscale it.
 */
const QUALITY: Record<VideoQuality, { qscale: number; scale: number }> = {
  low: { qscale: 10, scale: 0.5 },
  medium: { qscale: 5, scale: 0.75 },
  high: { qscale: 2, scale: 1 }
};

async function recordCanvasToWebm(
  scene: EditorScene,
  canvas: HTMLCanvasElement,
  media: HTMLVideoElement | HTMLImageElement | null,
  frameElement: HTMLElement | null,
  pixelRatio: number,
  onStatus?: (message: string) => void,
  onProgress?: (progress: number) => void,
  layerMedias?: Map<string, CanvasImageSource | null>,
  frameOverlays?: Map<string, CanvasImageSource | null>
) {
  const spec = getFrameSpec(scene.frame);
  let overlay: CanvasImageSource | null = null;
  if (spec.isOverlay && spec.asset) {
    try {
      overlay = await loadImage(spec.asset);
    } catch {
      overlay = null;
    }
  }

  // Annotations are drawn from the scene automatically; the background image
  // must be preloaded and passed in (the canvas renderer is synchronous).
  let backgroundImage: CanvasImageSource | null = null;
  if (scene.backgroundMode === "image" && scene.backgroundImageUrl) {
    try {
      backgroundImage = await loadImage(scene.backgroundImageUrl);
    } catch {
      backgroundImage = null;
    }
  }

  // Match the PNG export: size the frame from its on-screen box so overlay
  // skins (iphone15/16pro) keep their native aspect ratio instead of being
  // stretched to the default 10/16 fallback in computeFrameBox.
  // MP4 (mpeg4) can't carry an alpha channel, so a transparent scene is
  // composited onto black for the video export (PNG keeps real transparency).
  const backgroundFill = scene.backgroundMode === "transparent" ? "#000000" : undefined;
  const frameWidth = frameElement ? Math.max(1, Math.round(frameElement.offsetWidth * pixelRatio)) : undefined;
  const frameHeight = frameElement ? Math.max(1, Math.round(frameElement.offsetHeight * pixelRatio)) : undefined;

  const fps = 30;
  // Attach the canvas to the DOM (off-screen) before capturing: some browsers
  // won't deliver frames from captureStream() on a detached canvas, which
  // yields an empty recording.
  canvas.style.position = "fixed";
  canvas.style.left = "-9999px";
  canvas.style.top = "0";
  canvas.style.opacity = "0";
  canvas.style.pointerEvents = "none";
  document.body.appendChild(canvas);

  // Resolve the active layer before stream setup so the audio capture branch
  // below can check its muted state.
  const activeForCapture = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
  if (!activeForCapture) {
    canvas.remove();
    throw new Error("Cannot export a scene with no layers.");
  }

  let stream: MediaStream;
  try {
    stream = canvas.captureStream(fps);
  } catch (err) {
    canvas.remove();
    if (err instanceof DOMException && err.name === "SecurityError") {
      throw new Error("This video can't be exported: its host doesn't allow cross-origin capture. Use a file you uploaded instead.");
    }
    throw err;
  }

  // Background audio: if the user uploaded an audio track, capture it and
  // use it instead of any video-layer audio (replaces, not mixes).
  let bgAudioEl: HTMLAudioElement | null = null;
  if (scene.backgroundAudioUrl) {
    try {
      bgAudioEl = document.createElement("audio");
      bgAudioEl.src = scene.backgroundAudioUrl;
      bgAudioEl.loop = true;
      bgAudioEl.crossOrigin = "anonymous";
      await bgAudioEl.play();
      const bgStream = (bgAudioEl as HTMLAudioElement & { captureStream: () => MediaStream }).captureStream();
      const bgTracks = bgStream.getAudioTracks();
      if (bgTracks.length > 0) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          stream = new MediaStream([videoTrack, ...bgTracks]);
        }
      }
    } catch {
      // background audio not supported — export video-only
    }
  } else if (media instanceof HTMLVideoElement && activeForCapture.videoMuted === false) {
    try {
      const audioMs = (media as HTMLVideoElement & { captureStream: () => MediaStream }).captureStream();
      const audioTracks = audioMs.getAudioTracks();
      if (audioTracks.length > 0) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          stream = new MediaStream([videoTrack, ...audioTracks]);
        }
      }
    } catch {
      // audio capture not supported — export video-only
    }
  }

  const chunks: BlobPart[] = [];
  const mimeType = chooseWebmMimeType();
  const recorder = new MediaRecorder(stream, { mimeType });
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const start = Math.max(0, activeForCapture.videoTrimStart || 0);
  const end = activeForCapture.videoTrimEnd > start ? activeForCapture.videoTrimEnd : activeForCapture.videoDuration;
  const isVideo = media instanceof HTMLVideoElement;
  const duration = computeCaptureDuration(scene);

  await new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error("MediaRecorder failed"));
    recorder.start(200);

    let raf = 0;
    const startedAt = performance.now();
    if (media instanceof HTMLVideoElement) {
      media.currentTime = start;
      media.muted = activeForCapture?.videoMuted !== false;
      media.play().catch(() => null);
    }

    const tick = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      const normalized = duration > 0 ? Math.min(1, elapsed / duration) : 1;
      const progress = Math.min(100, normalized * 100);
      const sampled = sampleVideoTransform(activeForCapture ?? scene.layers[0], normalized);
      const transform: RenderTransform = { zoom: sampled.zoom, offsetX: sampled.x, offsetY: sampled.y };
      onProgress?.(progress);

      if (media instanceof HTMLVideoElement) {
        if (media.currentTime >= end || elapsed >= duration) {
          media.pause();
          renderMockupToCanvas(canvas, scene, activeForCapture?.hidden ? null : media, undefined, undefined, frameWidth, frameHeight, pixelRatio, transform, backgroundFill, overlay, backgroundImage, layerMedias, frameOverlays);
          recorder.stop();
          cancelAnimationFrame(raf);
          onProgress?.(100);
          return;
        }
      } else if (elapsed >= duration) {
        recorder.stop();
        cancelAnimationFrame(raf);
        onProgress?.(100);
        return;
      }

      renderMockupToCanvas(canvas, scene, activeForCapture?.hidden ? null : media, undefined, undefined, frameWidth, frameHeight, pixelRatio, transform, backgroundFill, overlay, backgroundImage, layerMedias, frameOverlays);
      raf = requestAnimationFrame(tick);
    };

    onStatus?.("Recording preview…");
    raf = requestAnimationFrame(tick);
  });

  canvas.remove();
  // Free the capture stream's tracks so the canvas track doesn't leak between
  // exports.
  stream.getTracks().forEach((track) => track.stop());
  if (bgAudioEl) {
    bgAudioEl.pause();
    bgAudioEl.remove();
  }
  return new Blob(chunks, { type: "video/webm" });
}

/**
 * Captures the preview animation to a WebM blob, shared by the MP4 and GIF
 * exporters. Builds the off-screen canvas, resolves the media element (a
 * detached <video> for video scenes, or the one already in the preview), and
 * records via MediaRecorder. Returns null if no frames were captured.
 */
async function captureWebm(
  scene: EditorScene,
  scale?: number,
  onStatus?: (message: string) => void,
  onProgress?: (progress: number) => void
): Promise<Blob | null> {
  const previewNode = document.getElementById("preview-canvas");
  if (!previewNode) throw new Error("Preview area not found.");

  const exportQuality = (scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0])?.videoQuality ?? "medium";
  const quality = QUALITY[exportQuality] ?? QUALITY.medium;
  const pixelRatio = resolvePixelRatio(exportQuality) * (typeof scale === "number" && scale > 0 ? scale / 2 : 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(640, Math.round(previewNode.clientWidth * pixelRatio));
  canvas.height = Math.max(360, Math.round(previewNode.clientHeight * pixelRatio));

  const videoInPreview = previewNode.querySelector("video");
  const imageInPreview = previewNode.querySelector("img");
  // When exporting a video scene we create a detached <video> from the active
  // video layer's URL; track it so we can stop/remove it and free its blob: URL
  // afterwards. For image scenes we reuse the element already in the preview.
  const activeLayer = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
  let sourceVideo: HTMLVideoElement | null = null;
  let media: HTMLVideoElement | HTMLImageElement | null = null;
  if (activeLayer && isVideoLayer(activeLayer) && activeLayer.mediaUrl) {
    sourceVideo = document.createElement("video");
    sourceVideo.src = activeLayer.mediaUrl;
    sourceVideo.crossOrigin = "anonymous";
    sourceVideo.muted = activeLayer?.videoMuted !== false;
    sourceVideo.playsInline = true;
    await new Promise<void>((resolve, reject) => {
      sourceVideo!.onloadedmetadata = () => {
        const start = Math.max(0, activeLayer?.videoTrimStart || 0);
        if (start > 0) {
          sourceVideo!.currentTime = start;
          sourceVideo!.onseeked = () => resolve();
        } else {
          resolve();
        }
      };
      sourceVideo!.onerror = () => reject(new Error("Unable to load video for export"));
    });
    media = sourceVideo;
  } else if (imageInPreview instanceof HTMLImageElement) {
    media = imageInPreview;
  } else if (videoInPreview instanceof HTMLVideoElement) {
    media = videoInPreview;
  }

  const isMultiFrame = scene.frameInstances.length > 0;
  const frameElement = previewNode.querySelector<HTMLElement>("[data-mockup-frame]");
  const frameWidth = isMultiFrame ? undefined : frameElement ? Math.max(1, Math.round(frameElement.offsetWidth * pixelRatio)) : undefined;
  const frameHeight = isMultiFrame ? undefined : frameElement ? Math.max(1, Math.round(frameElement.offsetHeight * pixelRatio)) : undefined;

  // For multi-frame mode, load media for each frame's layer and per-instance overlays
  let layerMedias: Map<string, CanvasImageSource | null> | undefined;
  let frameOverlays: Map<string, CanvasImageSource | null> | undefined;
  if (isMultiFrame) {
    layerMedias = new Map();
    frameOverlays = new Map();
    for (const inst of scene.frameInstances) {
      const layer = scene.layers.find((l) => l.id === inst.layerId);
      if (layer?.mediaUrl) {
        try {
          const isVideo = isVideoLayer(layer);
          if (isVideo) {
            // Create a detached video element for the export
            const v = document.createElement("video");
            v.src = layer.mediaUrl;
            v.crossOrigin = "anonymous";
            v.muted = true;
            v.playsInline = true;
            await new Promise<void>((resolve, reject) => {
              v.onloadedmetadata = () => resolve();
              v.onerror = () => reject();
            });
            layerMedias.set(layer.id, v);
          } else {
            const img = await loadImage(layer.mediaUrl);
            layerMedias.set(layer.id, img);
          }
        } catch {
          layerMedias.set(layer.id, null);
        }
      }
      const instSpec = getFrameSpec(inst.frame);
      if (instSpec.isOverlay && instSpec.asset) {
        try {
          const ov = await loadImage(instSpec.asset);
          if (layer?.id) frameOverlays.set(layer.id, ov);
        } catch {
          // overlay failed to load
        }
      }
    }
  }

  let webmBlob: Blob | null = null;
  try {
    webmBlob = await recordCanvasToWebm(scene, canvas, media, frameElement, pixelRatio, onStatus, onProgress, layerMedias, frameOverlays);
  } finally {
    if (sourceVideo) {
      sourceVideo.pause();
      if (sourceVideo.src.startsWith("blob:")) URL.revokeObjectURL(sourceVideo.src);
      sourceVideo.remove();
    }
  }
  return webmBlob;
}

export async function exportVideo(
  scene: EditorScene,
  scale?: number,
  onStatus?: (message: string) => void,
  onProgress?: (progress: number) => void,
  onError?: (message: string) => void
) {
  try {
    const webmBlob = await captureWebm(scene, scale, onStatus, onProgress);
    if (!webmBlob || webmBlob.size === 0) {
      onError?.("Recording produced no video frames.");
      return;
    }

  onStatus?.("Encoding MP4…");
  onProgress?.(0);
  const exportQuality = (scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0])?.videoQuality ?? "medium";
  const quality = QUALITY[exportQuality] ?? QUALITY.medium;
  const ffmpeg = await getFfmpegInstance(onStatus);
  const inputName = "input.webm";
  const outputName = "mocksy-export.mp4";
  await ffmpeg.writeFile(inputName, new Uint8Array(await webmBlob.arrayBuffer()));
  onProgress?.(50);
  const code = await ffmpeg.exec([
    "-i", inputName,
    "-c:v", "mpeg4",
    "-q:v", String(quality.qscale),
    "-pix_fmt", "yuv420p",
    outputName,
  ]);
  // FFmpeg returns 0 on success; a non-zero code means the encode failed
  // (e.g. unsupported input) and would otherwise produce an empty/corrupt MP4.
  if (code !== 0) {
    throw new Error("Video encoding failed.");
  }
  onProgress?.(90);
  const data = await ffmpeg.readFile(outputName);
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  if (bytes.length === 0) {
    throw new Error("Video encoding produced no output.");
  }
  const blob = new Blob([bytes], { type: "video/mp4" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = sanitizeFilename(((scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0])?.mediaName || "mocksy-export").replace(/\.[^.]+$/, "")) + ".mp4";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 200);
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);
  onStatus?.("Done");
  onProgress?.(100);
  } catch (err) {
    // Best-effort temp-file cleanup so the FFmpeg singleton doesn't carry
    // stale input/output between failed exports.
    try {
      const ffmpeg = ffmpegSingleton;
      if (ffmpeg) {
        await ffmpeg.deleteFile("input.webm");
        await ffmpeg.deleteFile("mocksy-export.mp4");
      }
    } catch {
      // ignore cleanup errors
    }
    onError?.(err instanceof Error ? err.message : "Video export failed.");
  }
}

/**
 * Exports an animated GIF by capturing the preview to WebM (via
 * captureWebm) and transcoding it through FFmpeg with a generated palette,
 * which keeps the file small and the colors accurate. Pixel ratio follows
 * the same quality tiers as the MP4 export.
 */
export async function exportGif(
  scene: EditorScene,
  scale?: number,
  onStatus?: (message: string) => void,
  onProgress?: (progress: number) => void,
  onError?: (message: string) => void
) {
  try {
    const webmBlob = await captureWebm(scene, scale, onStatus, onProgress);
    if (!webmBlob || webmBlob.size === 0) {
      onError?.("Recording produced no frames.");
      return;
    }

    onStatus?.("Encoding GIF…");
    onProgress?.(0);
    const exportQuality = (scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0])?.videoQuality ?? "medium";
    const quality = QUALITY[exportQuality] ?? QUALITY.medium;
    const ffmpeg = await getFfmpegInstance(onStatus);
    const inputName = "input.webm";
    const paletteName = "palette.png";
    const outputName = "mocksy-export.gif";
    await ffmpeg.writeFile(inputName, new Uint8Array(await webmBlob.arrayBuffer()));
    onProgress?.(50);
    // Scale down for GIF: keep it crisp but cap width so the palette step
    // stays cheap. Quality tier and the chosen export scale drive the width
    // (2× is the baseline, so 1× halves and 4× doubles it).
    const width = Math.round(480 * quality.scale * (typeof scale === "number" && scale > 0 ? scale / 2 : 1));
    const code = await ffmpeg.exec([
      "-i", inputName,
      "-vf", `fps=15,scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
      "-loop", "0",
      outputName
    ]);
    if (code !== 0) {
      throw new Error("GIF encoding failed.");
    }
    onProgress?.(90);
    const data = await ffmpeg.readFile(outputName);
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
    if (bytes.length === 0) {
      throw new Error("GIF encoding produced no output.");
    }
    const blob = new Blob([bytes], { type: "image/gif" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = sanitizeFilename(((scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0])?.mediaName || "mocksy-export").replace(/\.[^.]+$/, "")) + ".gif";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 200);
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(paletteName);
    await ffmpeg.deleteFile(outputName);
    onStatus?.("Done");
    onProgress?.(100);
  } catch (err) {
    try {
      const ffmpeg = ffmpegSingleton;
      if (ffmpeg) {
        await ffmpeg.deleteFile("input.webm");
        await ffmpeg.deleteFile("palette.png");
        await ffmpeg.deleteFile("mocksy-export.gif");
      }
    } catch {
      // ignore cleanup errors
    }
    onError?.(err instanceof Error ? err.message : "GIF export failed.");
  }
}
