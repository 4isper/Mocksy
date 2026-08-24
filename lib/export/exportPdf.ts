"use client";

import type { EditorScene, ExportSize } from "@/lib/types/editor";
import { intrinsicExportSize, fitRatioForCustomSize } from "@/lib/export/exportSize";
import { renderSceneToPngBlob } from "@/lib/export/exportImage";
import { downloadBlob } from "@/lib/export/downloadBlob";
import { buildStandaloneSvg } from "@/lib/export/exportSvg";

export function pdfPageSize(scene: EditorScene, customSize?: ExportSize | null): { width: number; height: number } {
  const base = intrinsicExportSize(scene, 1);
  if (!customSize?.width && !customSize?.height) return base;
  const ratio = fitRatioForCustomSize(scene, customSize);
  const width = Math.max(1, Math.round(base.width * ratio));
  const height = Math.max(1, Math.round(base.height * ratio));
  return { width, height };
}

async function renderVectorPdf(
  scene: EditorScene,
  containerId: string,
  activeLayerId: string | null,
  pageSize: { width: number; height: number }
): Promise<Blob> {
  const svg = await buildStandaloneSvg(scene, containerId, activeLayerId);
  if (!svg) throw new Error("Preview area not found.");

  const [{ jsPDF }] = await Promise.all([import("jspdf"), import("svg2pdf.js")]);

  const host = document.createElement("div");
  host.setAttribute(
    "style",
    "position:fixed;left:-99999px;top:-99999px;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;"
  );
  host.innerHTML = svg.markup;
  document.body.appendChild(host);

  try {
    const el = host.firstElementChild;
    if (!(el instanceof SVGSVGElement)) throw new Error("Invalid SVG markup for PDF.");

    const doc = new jsPDF({
      unit: "pt",
      format: [pageSize.width, pageSize.height],
      orientation: pageSize.width >= pageSize.height ? "landscape" : "portrait",
      compress: true
    });
    await doc.svg(el, {
      x: 0,
      y: 0,
      width: pageSize.width,
      height: pageSize.height
    });
    return doc.output("blob");
  } finally {
    host.remove();
  }
}

async function renderRasterPdf(
  scene: EditorScene,
  containerId: string,
  onError: ((message: string) => void) | undefined,
  scale: number | undefined,
  customSize: ExportSize | null,
  activeLayerId: string | null,
  pageSize: { width: number; height: number }
): Promise<Blob> {
  const pngBlob = await renderSceneToPngBlob(scene, containerId, onError, scale, customSize, activeLayerId);
  if (!pngBlob) throw new Error("Failed to render scene for PDF.");

  const [{ jsPDF }] = await Promise.all([import("jspdf")]);
  const bytes = new Uint8Array(await pngBlob.arrayBuffer());
  const doc = new jsPDF({
    unit: "pt",
    format: [pageSize.width, pageSize.height],
    orientation: pageSize.width >= pageSize.height ? "landscape" : "portrait",
    compress: true
  });
  doc.addImage(bytes, "PNG", 0, 0, pageSize.width, pageSize.height);
  return doc.output("blob");
}

export async function exportPdf(
  scene: EditorScene,
  containerId: string,
  filename: string,
  onError?: (message: string) => void,
  scale?: number,
  customSize?: ExportSize | null,
  activeLayerId: string | null = scene.activeLayerId
) {
  const pageSize = pdfPageSize(scene, customSize);
  let blob: Blob | null = null;
  let vectorError: unknown = null;
  try {
    blob = await renderVectorPdf(scene, containerId, activeLayerId, pageSize);
  } catch (err) {
    vectorError = err;
  }

  if (!blob) {
    try {
      blob = await renderRasterPdf(scene, containerId, onError, scale, customSize ?? null, activeLayerId, pageSize);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "PDF export failed.");
      return;
    }
    if (vectorError instanceof Error && !/Preview area not found/.test(vectorError.message)) {
      console.warn("Vector PDF export failed, used raster fallback.", vectorError);
    }
  }

  downloadBlob(blob, `${filename}.pdf`);
}
