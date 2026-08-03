"use client";

import type { EditorScene, ExportSize } from "@/lib/types/editor";
import { PDFDocument } from "pdf-lib";
import { renderSceneToPngBlob } from "@/lib/export/exportImage";

export async function exportPdf(
  scene: EditorScene,
  containerId: string,
  filename: string,
  onError?: (message: string) => void,
  scale?: number,
  customSize?: ExportSize | null,
  activeLayerId: string | null = scene.activeLayerId
) {
  try {
    const pngBlob = await renderSceneToPngBlob(scene, containerId, onError, scale, customSize, activeLayerId);
    if (!pngBlob) {
      onError?.("Failed to render scene for PDF.");
      return;
    }

    const pdfDoc = await PDFDocument.create();
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
    const embeddedImage = await pdfDoc.embedPng(pngBytes);

    const imgWidth = embeddedImage.width;
    const imgHeight = embeddedImage.height;
    const imgAspect = imgWidth / Math.max(1, imgHeight);

    const pageWidth = customSize?.width ?? 612;
    const pageHeight = pageWidth / imgAspect;

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight
    });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([new Uint8Array(pdfBytes).buffer], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 200);
  } catch (err) {
    onError?.(err instanceof Error ? err.message : "PDF export failed.");
  }
}