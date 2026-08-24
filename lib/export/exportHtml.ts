"use client";

import type { EditorScene } from "@/lib/types/editor";
import { getFrameSpec } from "@/lib/render/frames";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { isVisibleFrameInstance } from "@/lib/render/frameGeometry";
import { buildEmbeddedFontCss, collectFontStacks } from "@/lib/export/fontEmbed";
import { downloadBlob } from "@/lib/export/downloadBlob";
import {
  buildGridHtmlSnippet,
  buildHtmlSnippet,
  type GridItemOptions,
  type HtmlSnippetOptions
} from "@/lib/export/htmlMarkup";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read blob"));
    reader.readAsDataURL(blob);
  });
}

/** Converts a media URL into a data: URL so the snippet stays self-contained. */
async function toEmbeddableDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const res = await fetch(src);
  return blobToDataUrl(await res.blob());
}

async function svgAssetToDataUrl(asset: string): Promise<string | null> {
  try {
    const res = await fetch(asset);
    const text = await res.text();
    return `data:image/svg+xml;utf8,${encodeURIComponent(text)}`;
  } catch {
    return null;
  }
}

/**
 * Exports the scene as a standalone HTML file. Single-frame scenes and
 * multi-frame grids both become live CSS mockups (crisp at any size,
 * animation preserved for single-frame scenes).
 */
export async function exportHtml(
  scene: EditorScene,
  containerId: string,
  filename = "mocksy-export",
  onError?: (message: string) => void,
  activeLayerId: string | null = scene.activeLayerId
) {
  try {
    if (scene.frameInstances.length > 0) {
      const items: GridItemOptions[] = [];
      const activeLayer = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
      for (const inst of scene.frameInstances) {
        if (!isVisibleFrameInstance(scene, inst)) continue;
        const layer = scene.layers.find((l) => l.id === inst.layerId) ?? activeLayer;
        let mediaHref: string | null = null;
        let mediaType: "image" | "video" | null = null;
        if (layer?.mediaUrl) {
          mediaHref = await toEmbeddableDataUrl(layer.mediaUrl);
          mediaType = isVideoLayer(layer) ? "video" : "image";
        }
        const spec = getFrameSpec(inst.frame, scene.customFrame, inst.material);
        const overlayHref = spec.isOverlay && spec.asset ? await svgAssetToDataUrl(spec.asset) : null;
        items.push({ inst, mediaHref, mediaType, overlayHref });
      }

      let backgroundHref: string | null = null;
      if (scene.backgroundMode === "image" && scene.backgroundImageUrl) {
        backgroundHref = await toEmbeddableDataUrl(scene.backgroundImageUrl);
      }
      let watermarkHref: string | null = null;
      if (scene.watermarkEnabled && scene.watermarkImageUrl) {
        watermarkHref = await toEmbeddableDataUrl(scene.watermarkImageUrl);
      }

      const html = buildGridHtmlSnippet(scene, items, {
        backgroundHref,
        watermarkHref,
        fontCss: await buildEmbeddedFontCss(collectFontStacks(scene))
      });
      downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${filename}.html`);
      return;
    }

    const activeLayer = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
    let mediaHref: string | null = null;
    let mediaType: "image" | "video" | null = null;
    if (activeLayer && !activeLayer.hidden && activeLayer.mediaUrl) {
      mediaHref = await toEmbeddableDataUrl(activeLayer.mediaUrl);
      mediaType = isVideoLayer(activeLayer) ? "video" : "image";
    }
    let backgroundHref: string | null = null;
    if (scene.backgroundMode === "image" && scene.backgroundImageUrl) {
      backgroundHref = await toEmbeddableDataUrl(scene.backgroundImageUrl);
    }
    let watermarkHref: string | null = null;
    if (scene.watermarkEnabled && scene.watermarkImageUrl) {
      watermarkHref = await toEmbeddableDataUrl(scene.watermarkImageUrl);
    }
    const spec = getFrameSpec(scene.frame, scene.customFrame, scene.frameMaterial);
    const overlayHref = spec.isOverlay && spec.asset ? await svgAssetToDataUrl(spec.asset) : null;

    const fontCss = await buildEmbeddedFontCss(collectFontStacks(scene));
    const opts: HtmlSnippetOptions = { mediaHref, mediaType, backgroundHref, overlayHref, watermarkHref, fontCss };
    const html = buildHtmlSnippet(scene, opts, activeLayerId);
    downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${filename}.html`);
  } catch (err) {
    onError?.(err instanceof Error ? err.message : "HTML export failed.");
  }
}

export { buildHtmlSnippet, buildGridHtmlSnippet };
export type { HtmlSnippetOptions };
