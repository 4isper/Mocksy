"use client";

import type { EditorScene, MockupFrame } from "@/lib/types/editor";
import { renderSceneToPngBlob } from "@/lib/export/exportImage";
import { downloadBlob } from "@/lib/export/downloadBlob";

/**
 * Batch export: renders every frame instance of a multi-frame scene as its
 * own file (PNG image, or WebM/MP4 video via the regular export pipeline)
 * and packs the results into a single ZIP download. jszip is only pulled in
 * here so it stays out of the initial bundle.
 */

/** Zero-pads the index to the width needed for the total count. */
export function padIndex(index: number, total: number): string {
  const width = Math.max(1, String(Math.max(1, total)).length);
  return String(index).padStart(width, "0");
}

/** File name for one entry in the archive, e.g. "mocksy-export-1-iphone.png".
 *  Uses the raw frame id (ASCII-safe, stable across locales). */
export function batchEntryName(frame: MockupFrame, index: number, total: number, ext = "png"): string {
  return `mocksy-export-${padIndex(index, total)}-${String(frame).replace(/[^a-z0-9-]/gi, "")}.${ext}`;
}

/**
 * Renders each frame instance standalone (the scene is re-rendered with just
 * that instance at its layout position on the shared background) and
 * downloads all of them as one ZIP.
 */
export async function exportBatchZip(
  scene: EditorScene,
  containerId: string,
  filename = "mocksy-export",
  onError?: (message: string) => void,
  scale?: number,
  activeLayerId: string | null = scene.activeLayerId,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const instances = scene.frameInstances;
  if (instances.length === 0) {
    onError?.("Multi-frame mode is off — there is nothing to batch.");
    return;
  }

  try {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    let exported = 0;

    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i]!;
      onProgress?.(i + 1, instances.length);
      // Rendering a single-instance scene variant reuses the exact export
      // geometry: the frame sits at its own layout position with the shared
      // background, watermark and annotations drawn once per file.
      const blob = await renderSceneToPngBlob(
        { ...scene, frameInstances: [inst] },
        containerId,
        onError,
        scale,
        null,
        activeLayerId
      );
      if (!blob) return;
      zip.file(batchEntryName(inst.frame, i + 1, instances.length), blob);
      exported++;
    }

    if (exported === 0) {
      onError?.("No frames were rendered.");
      return;
    }

    const archive = await zip.generateAsync({ type: "blob" });
    downloadBlob(archive, `${filename}.zip`);
  } catch (err) {
    onError?.(err instanceof Error ? err.message : "Batch export failed.");
  }
}

export type BatchVideoFormat = "webm" | "mp4";

/** Unique per-run FFmpeg temp names so overlapping exports never share FS
 *  entries (same scheme as exportVideo.ts). */
function batchVideoTempNames(): { inputName: string; outputName: string } {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { inputName: `input-${id}.webm`, outputName: `mocksy-batch-${id}.mp4` };
}

/**
 * Records every frame instance of a multi-frame scene as its own video clip
 * (the same capture pipeline as the MP4/WebM exports, scoped to a
 * single-instance scene variant) and packs the clips into one ZIP. WebM clips
 * are archived directly; MP4 clips are transcoded through FFmpeg per entry.
 */
export async function exportVideoBatchZip(
  scene: EditorScene,
  filename = "mocksy-export",
  onError?: (message: string) => void,
  format: BatchVideoFormat = "webm",
  scale?: number,
  activeLayerId: string | null = scene.activeLayerId,
  onProgress?: (current: number, total: number) => void,
  signal?: AbortSignal
): Promise<void> {
  const instances = scene.frameInstances;
  if (instances.length === 0) {
    onError?.("Multi-frame mode is off — there is nothing to batch.");
    return;
  }

  try {
    signal?.throwIfAborted();
    const [{ default: JSZip }, videoCore] = await Promise.all([
      import("jszip"),
      import("@/lib/export/exportVideoCore")
    ]);
    const zip = new JSZip();
    let ffmpeg: Awaited<ReturnType<typeof videoCore.getFfmpegInstance>> | null = null;
    let exported = 0;

    for (let i = 0; i < instances.length; i++) {
      signal?.throwIfAborted();
      const inst = instances[i]!;
      onProgress?.(i + 1, instances.length);
      // Scoping the scene to this single instance reuses the exact capture
      // geometry of the regular video export. The instance's own layer drives
      // the recording so each clip animates its device's media.
      const webmBlob = await videoCore.captureWebmWithRetry(
        { ...scene, frameInstances: [inst] },
        scale,
        undefined,
        undefined,
        null,
        inst.layerId ?? activeLayerId,
        signal
      );
      if (!webmBlob || webmBlob.size === 0) {
        onError?.("Recording produced no frames.");
        return;
      }

      if (format === "webm") {
        zip.file(batchEntryName(inst.frame, i + 1, instances.length, "webm"), webmBlob);
      } else {
        if (!ffmpeg) ffmpeg = await videoCore.getFfmpegInstance();
        const { inputName, outputName } = batchVideoTempNames();
        await ffmpeg.writeFile(inputName, new Uint8Array(await webmBlob.arrayBuffer()));
        const quality =
          videoCore.QUALITY[videoCore.activeLayerOf(scene, inst.layerId ?? activeLayerId)?.videoQuality ?? "medium"] ??
          videoCore.QUALITY.medium;
        const code = await ffmpeg.exec([
          "-i", inputName,
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-crf", String(quality.crf),
          "-pix_fmt", "yuv420p",
          "-movflags", "+faststart",
          outputName
        ]);
        if (code !== 0) throw new Error("Video encoding failed.");
        const data = await ffmpeg.readFile(outputName);
        const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
        if (bytes.length === 0) throw new Error("Video encoding produced no output.");
        zip.file(batchEntryName(inst.frame, i + 1, instances.length, "mp4"), bytes);
        await videoCore.cleanupFfmpegTempFiles(ffmpeg, [inputName, outputName]);
      }
      exported++;
    }

    if (exported === 0) {
      onError?.("No frames were rendered.");
      return;
    }

    const archive = await zip.generateAsync({ type: "blob" });
    downloadBlob(archive, `${filename}-${format}.zip`);
  } catch (err) {
    onError?.(err instanceof Error ? err.message : "Batch export failed.");
  }
}
