"use client";

import type { EditorScene } from "@/lib/types/editor";
import { getFrameSpec } from "@/lib/render/frames";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { renderSceneToImageBlob } from "@/lib/export/exportImage";
import { buildEmbeddedFontCss, collectFontStacks } from "@/lib/export/fontEmbed";
import { downloadBlob } from "@/lib/export/downloadBlob";
import { buildHtmlSnippet, buildRasterHtmlSnippet, type HtmlSnippetOptions } from "@/lib/export/htmlMarkup";

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
 * Exports the scene as a standalone HTML file. Single-frame scenes become a
 * live CSS mockup (crisp at any size, animation preserved); multi-frame grids
 * embed a rendered PNG so the file still opens anywhere.
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
      const blob = await renderSceneToImageBlob(scene, containerId, "image/png", onError, 2, undefined, activeLayerId);
      if (!blob) return;
      const href = await blobToDataUrl(blob);
      downloadBlob(new Blob([buildRasterHtmlSnippet(href)], { type: "text/html;charset=utf-8" }), `${filename}.html`);
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

export { buildHtmlSnippet, buildRasterHtmlSnippet };
export type { HtmlSnippetOptions };
