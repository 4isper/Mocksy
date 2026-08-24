"use client";

import type { EditorScene, MockupFrame } from "@/lib/types/editor";
import { renderSceneToPngBlob } from "@/lib/export/exportImage";
import { downloadBlob } from "@/lib/export/downloadBlob";

/**
 * Batch export: renders every frame instance of a multi-frame scene as its
 * own PNG (same pipeline and geometry as the regular PNG export) and packs
 * the results into a single ZIP download. jszip is only pulled in here so it
 * stays out of the initial bundle.
 */

/** Zero-pads the index to the width needed for the total count. */
export function padIndex(index: number, total: number): string {
  const width = Math.max(1, String(Math.max(1, total)).length);
  return String(index).padStart(width, "0");
}

/** File name for one entry in the archive, e.g. "mocksy-export-1-iphone.png".
 *  Uses the raw frame id (ASCII-safe, stable across locales). */
export function batchEntryName(frame: MockupFrame, index: number, total: number): string {
  return `mocksy-export-${padIndex(index, total)}-${String(frame).replace(/[^a-z0-9-]/gi, "")}.png`;
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
