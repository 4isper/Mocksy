"use client";

import { useCallback, useEffect, useState } from "react";
import type { EditorScene } from "@/lib/types/editor";
import { exportImage, copyPngToClipboard } from "@/lib/export/exportImage";
import { useEditorStore } from "@/lib/state/editorStore";

export function useEditorExport(scene: EditorScene, setExportOpen?: (v: boolean) => void) {
  const exportScale = useEditorStore((s) => s.exportScale);
  const [videoExportStatus, setVideoExportStatus] = useState<string | null>(null);
  const [videoExportProgress, setVideoExportProgress] = useState<number>(0);
  const [gifExportStatus, setGifExportStatus] = useState<string | null>(null);
  const [gifExportProgress, setGifExportProgress] = useState<number>(0);
  const isExporting = videoExportStatus !== null || gifExportStatus !== null;
  const [exportError, setExportError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const handleExportPng = useCallback(() => {
    setExportError(null);
    exportImage(scene, "preview-canvas", "mocksy-export", setExportError, exportScale);
  }, [scene, exportScale]);

  const handleCopyPng = useCallback(async () => {
    setExportError(null);
    await copyPngToClipboard(scene, "preview-canvas", setExportError, setCopyStatus, exportScale);
  }, [scene, exportScale]);

  const handleExportMp4 = useCallback(async () => {
    setExportError(null);
    try {
      setVideoExportStatus("Exporting video…");
      setVideoExportProgress(0);
      const { exportVideo } = await import("@/lib/export/exportVideo");
      await exportVideo(scene, exportScale, setVideoExportStatus, setVideoExportProgress, setExportError);
    } finally {
      setTimeout(() => {
        setVideoExportStatus(null);
        setVideoExportProgress(0);
      }, 800);
    }
  }, [scene, exportScale]);

  const handleExportGif = useCallback(async () => {
    setExportError(null);
    try {
      setGifExportStatus("Exporting GIF…");
      setGifExportProgress(0);
      const { exportGif } = await import("@/lib/export/exportVideo");
      await exportGif(scene, exportScale, setGifExportStatus, setGifExportProgress, setExportError);
    } finally {
      setTimeout(() => {
        setGifExportStatus(null);
        setGifExportProgress(0);
      }, 800);
    }
  }, [scene, exportScale]);

  const handleExport = useCallback(
    (format: "png" | "mp4" | "gif") => {
      setExportOpen?.(false);
      if (format === "png") handleExportPng();
      else if (format === "mp4") handleExportMp4();
      else handleExportGif();
    },
    [handleExportPng, handleExportMp4, handleExportGif]
  );

  const handleCopyFromDialog = useCallback(() => {
    setExportOpen?.(false);
    handleCopyPng();
  }, [handleCopyPng]);

  // Clear the transient "Copied" status after a moment so it doesn't
  // linger in the toolbar like the persistent Saved indicator.
  useEffect(() => {
    if (!copyStatus) return;
    const t = setTimeout(() => setCopyStatus(null), 1500);
    return () => clearTimeout(t);
  }, [copyStatus]);

  return {
    handleExportPng,
    handleCopyPng,
    handleExportMp4,
    handleExportGif,
    handleExport,
    handleCopyFromDialog,
    videoExportStatus,
    videoExportProgress,
    gifExportStatus,
    gifExportProgress,
    isExporting,
    exportError,
    copyStatus,
    setExportError,
  };
}
