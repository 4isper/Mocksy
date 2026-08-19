"use client";

import type { EditorScene } from "@/lib/types/editor";
import { computeFrameBox, computeFrameInstances, type FrameBox } from "@/lib/render/frameGeometry";
import { getFrameSpec, frameViewBox } from "@/lib/render/frames";
import { loadImage, loadVideoFrame } from "@/lib/render/canvasMedia";
import { resolveExportTransform, waitForImage } from "@/lib/export/exportImageCore";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { buildEmbeddedFontCss, collectFontStacks } from "@/lib/export/fontEmbed";
import { downloadBlob } from "@/lib/export/downloadBlob";
import { buildSvgMarkup, type SvgFrameGroup, type SvgExportOptions } from "@/lib/export/svgMarkup";

export { buildSvgMarkup };
export type { SvgFrameGroup, SvgExportOptions };

function loadMediaElement(src: string): Promise<HTMLImageElement> {
  return loadImage(src);
}

/**
 * Converts a media URL to a data: URL plus its intrinsic size. Data URLs pass
 * through untouched; blob/http URLs are re-encoded through a canvas so the SVG
 * stays self-contained.
 */
export async function mediaToDataUrl(src: string): Promise<{ href: string; width: number; height: number } | null> {
  try {
    const img = await loadMediaElement(src);
    const width = img.naturalWidth || img.width || 1;
    const height = img.naturalHeight || img.height || 1;
    if (src.startsWith("data:")) return { href: src, width, height };
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { href: src, width, height };
    ctx.drawImage(img, 0, 0);
    return { href: canvas.toDataURL("image/png"), width, height };
  } catch {
    return null;
  }
}

/** Captures the current frame of a preview <video> as a PNG data URL. */
export function videoToDataUrl(video: HTMLVideoElement): { href: string; width: number; height: number } | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  try {
    ctx.drawImage(video, 0, 0);
    return { href: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
  } catch {
    return null;
  }
}

/** Fetches a device-skin SVG and returns its inner markup for inlining. */
export async function inlineSvgAsset(asset: string): Promise<string | null> {
  try {
    const res = await fetch(asset);
    const text = await res.text();
    return text
      .replace(/<\?xml[^>]*\?>/i, "")
      .replace(/^[\s\S]*?<svg[^>]*>/i, "<g>")
      .replace(/<\/svg>\s*$/i, "</g>")
      .trim();
  } catch {
    return null;
  }
}

/**
 * Exports the scene as a standalone SVG. Geometry is measured from the live
 * preview (so it matches the PNG/video exports), media is embedded as data
 * URLs, and overlay device skins are inlined so the file opens cleanly in
 * Figma/Illustrator/browsers.
 */
export async function exportSvg(
  scene: EditorScene,
  containerId: string,
  filename = "mocksy-export",
  onError?: (message: string) => void,
  activeLayerId: string | null = scene.activeLayerId
) {
  try {
    const node = document.getElementById(containerId);
    if (!node) {
      onError?.("Preview area not found.");
      return;
    }
    const frameElement = node.querySelector<HTMLElement>("[data-mockup-frame]");
    const video = node.querySelector("video");
    const img = node.querySelector("img");
    const width = node.clientWidth;
    const height = node.clientHeight;
    if (!width || !height) {
      onError?.("Preview has no measurable size.");
      return;
    }

    let background: { href: string; width: number; height: number } | null = null;
    if (scene.backgroundMode === "image" && scene.backgroundImageUrl) {
      background = await mediaToDataUrl(scene.backgroundImageUrl);
    }

    let watermark: { href: string; width: number; height: number } | null = null;
    if (scene.watermarkEnabled && scene.watermarkImageUrl) {
      watermark = await mediaToDataUrl(scene.watermarkImageUrl);
    }

    const isMulti = scene.frameInstances.length > 0;
    const activeLayer = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
    const transform = resolveExportTransform(scene, activeLayerId);
    const groups: SvgFrameGroup[] = [];

    if (isMulti) {
      const boxes = computeFrameInstances(scene, width, height, 1, transform, activeLayerId);
      for (let i = 0; i < boxes.length; i++) {
        const box: FrameBox | undefined = boxes[i];
        const inst = scene.frameInstances[i];
        if (!box || !inst) continue;
        const layer = scene.layers.find((l) => l.id === inst.layerId) ?? activeLayer;
        const spec = getFrameSpec(inst.frame, scene.customFrame);
        let media: { href: string; width: number; height: number } | null = null;
        if (layer?.mediaUrl) {
          if (isVideoLayer(layer)) {
            // Embed the video's poster frame as PNG so the frame isn't blank.
            const videoFrame = await loadVideoFrame(layer.mediaUrl, layer.videoPosterTime ?? 0);
            media = videoToDataUrl(videoFrame);
          } else {
            media = await mediaToDataUrl(layer.mediaUrl);
          }
        }
        const overlayInner = spec.isOverlay && spec.asset ? await inlineSvgAsset(spec.asset) : null;
        groups.push({
          box,
          mediaHref: media?.href ?? null,
          mediaWidth: media?.width ?? box.innerW,
          mediaHeight: media?.height ?? box.innerH,
          isOverlay: spec.isOverlay,
          viewBox: frameViewBox(spec),
          isCircular: inst.frame === "watch",
          overlayInner,
          mediaFit: layer?.mediaFit,
          offsetX: layer?.mediaOffsetX,
          offsetY: layer?.mediaOffsetY,
          rotation: layer?.rotation ?? 0
        });
      }
    } else {
      const spec = getFrameSpec(scene.frame, scene.customFrame);
      let media: { href: string; width: number; height: number } | null = null;
      if (!activeLayer?.hidden) {
        if (video instanceof HTMLVideoElement) {
          let src: HTMLVideoElement = video;
          if (video.readyState < 2 && activeLayer && isVideoLayer(activeLayer) && activeLayer.mediaUrl) {
            try {
              src = await loadVideoFrame(activeLayer.mediaUrl, activeLayer.videoPosterTime ?? 0);
            } catch {
              src = video;
            }
          }
          media = videoToDataUrl(src);
        } else if (img instanceof HTMLImageElement) {
          await waitForImage(img);
          media = {
            href: img.src,
            width: img.naturalWidth || img.width || 1,
            height: img.naturalHeight || img.height || 1
          };
        }
      }
      const box = computeFrameBox(scene, width, height, 1, frameElement?.offsetWidth, frameElement?.offsetHeight, transform, undefined, undefined, activeLayerId);
      const overlayInner = spec.isOverlay && spec.asset ? await inlineSvgAsset(spec.asset) : null;
      groups.push({
        box,
        mediaHref: media?.href ?? null,
        mediaWidth: media?.width ?? box.innerW,
        mediaHeight: media?.height ?? box.innerH,
        isOverlay: spec.isOverlay,
        viewBox: frameViewBox(spec),
        isCircular: scene.frame === "watch",
        overlayInner,
        mediaFit: activeLayer?.mediaFit,
        offsetX: activeLayer?.mediaOffsetX,
        offsetY: activeLayer?.mediaOffsetY,
        rotation: activeLayer?.rotation ?? 0
      });
    }

    const markup = buildSvgMarkup(scene, {
      width,
      height,
      backgroundHref: background?.href ?? null,
      backgroundWidth: background?.width,
      backgroundHeight: background?.height,
      watermarkHref: watermark?.href ?? null,
      watermarkWidth: watermark?.width,
      watermarkHeight: watermark?.height,
      zoom: transform.zoom,
      groups,
      fontCss: await buildEmbeddedFontCss(collectFontStacks(scene))
    });
    downloadBlob(new Blob([markup], { type: "image/svg+xml" }), `${filename}.svg`);
  } catch (err) {
    onError?.(err instanceof Error ? err.message : "SVG export failed.");
  }
}
