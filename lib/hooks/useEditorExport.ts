import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { exportImage, copyPngToClipboard, exportWebp } from "@/lib/export/exportImage";
import { exportPdf } from "@/lib/export/exportPdf";
import type { ExportFormat } from "@/components/editor/ExportDialog";
import { sceneToShareUrl, ShareUrlTooLarge } from "@/lib/state/shareState";
import type { EditorScene, ExportSize } from "@/lib/types/editor";

export interface EditorExportApi {
  videoExportStatus: string | null;
  videoExportProgress: number;
  gifExportStatus: string | null;
  gifExportProgress: number;
  exportError: string | null;
  copyStatus: string | null;
  isExporting: boolean;
  copyShareUrl: () => Promise<void>;
  handleExport: (format: ExportFormat) => void;
  handleCopyFromDialog: () => void;
  handleExportPng: () => void;
  handleExportWebp: () => void;
  handleExportSvg: () => void;
  handleExportHtml: () => void;
  handleExportPdf: () => void;
  handleExportMp4: () => void;
  handleExportWebm: () => void;
  handleExportWebpAnim: () => void;
  handleExportGif: () => void;
  handleCopyPng: () => Promise<void>;
}

const STATUS_CLEAR_DELAY = 800;

/**
 * Owns the export pipeline: PNG/WebP/SVG/HTML images, MP4/WebM/WebP/GIF video,
 * clipboard copy, and the transient status/progress/error state that feeds the
 * editor toolbar and export dialog. Handlers stay stable across renders (each
 * is a useCallback keyed on scene/scale/size) so consumers like useCommands
 * and the keyboard shortcuts hook can depend on them without re-binding.
 */
export function useEditorExport(
  scene: EditorScene,
  exportScale: number,
  customExportSize: ExportSize | null,
  onExportDialogClose: () => void,
  activeLayerId: string | null
): EditorExportApi {
  const t = useTranslations();
  const [videoExportStatus, setVideoExportStatus] = useState<string | null>(null);
  const [videoExportProgress, setVideoExportProgress] = useState(0);
  const [gifExportStatus, setGifExportStatus] = useState<string | null>(null);
  const [gifExportProgress, setGifExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const clearVideoStatus = useCallback(() => {
    setVideoExportStatus(null);
    setVideoExportProgress(0);
  }, []);

  const clearGifStatus = useCallback(() => {
    setGifExportStatus(null);
    setGifExportProgress(0);
  }, []);

  const copyShareUrl = useCallback(async () => {
    try {
      const url = sceneToShareUrl({ ...scene, activeLayerId });
      await navigator.clipboard.writeText(url);
    } catch (err) {
      if (err instanceof ShareUrlTooLarge) {
        setExportError(t("errors.shareUrlTooLarge"));
      } else {
        setExportError(err instanceof Error ? err.message : t("export.shareLinkFailed"));
      }
    }
  }, [scene, activeLayerId, t]);

  const handleExportPng = useCallback(() => {
    setExportError(null);
    exportImage(scene, "preview-canvas", "mocksy-export", setExportError, exportScale, customExportSize, activeLayerId);
  }, [scene, exportScale, customExportSize, activeLayerId]);

  const handleCopyPng = useCallback(async () => {
    setExportError(null);
    await copyPngToClipboard(scene, "preview-canvas", setExportError, setCopyStatus, exportScale, customExportSize, activeLayerId);
  }, [scene, exportScale, customExportSize, activeLayerId]);

  const handleExportWebp = useCallback(() => {
    setExportError(null);
    exportWebp(scene, "preview-canvas", "mocksy-export", setExportError, exportScale, customExportSize, activeLayerId);
  }, [scene, exportScale, customExportSize, activeLayerId]);

  const handleExportSvg = useCallback(async () => {
    setExportError(null);
    try {
      const { exportSvg } = await import("@/lib/export/exportSvg");
      await exportSvg(scene, "preview-canvas", "mocksy-export", setExportError, activeLayerId);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t("export.svgFailed"));
    }
  }, [scene, t, activeLayerId]);

  const handleExportHtml = useCallback(async () => {
    setExportError(null);
    try {
      const { exportHtml } = await import("@/lib/export/exportHtml");
      await exportHtml(scene, "preview-canvas", "mocksy-export", setExportError, activeLayerId);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t("export.htmlFailed"));
    }
  }, [scene, t, activeLayerId]);

  const handleExportPdf = useCallback(() => {
    setExportError(null);
    exportPdf(scene, "preview-canvas", "mocksy-export", setExportError, exportScale, customExportSize, activeLayerId);
  }, [scene, exportScale, customExportSize, activeLayerId]);

  const handleExportMp4 = useCallback(async () => {
    setExportError(null);
    try {
      setVideoExportStatus(t("export.exportingVideo"));
      setVideoExportProgress(0);
      const { exportVideo } = await import("@/lib/export/exportVideo");
      await exportVideo(scene, exportScale, setVideoExportStatus, setVideoExportProgress, setExportError, customExportSize, activeLayerId);
    } finally {
      setTimeout(clearVideoStatus, STATUS_CLEAR_DELAY);
    }
  }, [scene, exportScale, customExportSize, t, clearVideoStatus, activeLayerId]);

  const handleExportWebm = useCallback(async () => {
    setExportError(null);
    try {
      setVideoExportStatus(t("export.exportingWebm"));
      setVideoExportProgress(0);
      const { exportWebm } = await import("@/lib/export/exportVideo");
      await exportWebm(scene, exportScale, setVideoExportStatus, setVideoExportProgress, setExportError, customExportSize, activeLayerId);
    } finally {
      setTimeout(clearVideoStatus, STATUS_CLEAR_DELAY);
    }
  }, [scene, exportScale, customExportSize, t, clearVideoStatus, activeLayerId]);

  const handleExportWebpAnim = useCallback(async () => {
    setExportError(null);
    try {
      setVideoExportStatus(t("export.exportingWebpAnim"));
      setVideoExportProgress(0);
      const { exportWebpAnim } = await import("@/lib/export/exportVideo");
      await exportWebpAnim(scene, exportScale, setVideoExportStatus, setVideoExportProgress, setExportError, customExportSize, activeLayerId);
    } finally {
      setTimeout(clearVideoStatus, STATUS_CLEAR_DELAY);
    }
  }, [scene, exportScale, customExportSize, t, clearVideoStatus, activeLayerId]);

  const handleExportGif = useCallback(async () => {
    setExportError(null);
    try {
      setGifExportStatus(t("export.exportingGif"));
      setGifExportProgress(0);
      const { exportGif } = await import("@/lib/export/exportVideo");
      await exportGif(scene, exportScale, setGifExportStatus, setGifExportProgress, setExportError, customExportSize, activeLayerId);
    } finally {
      setTimeout(clearGifStatus, STATUS_CLEAR_DELAY);
    }
  }, [scene, exportScale, customExportSize, t, clearGifStatus, activeLayerId]);

  const handleExport = useCallback(
    (format: ExportFormat) => {
      onExportDialogClose();
      switch (format) {
        case "png":
          handleExportPng();
          break;
        case "webp":
          handleExportWebp();
          break;
        case "svg":
          void handleExportSvg();
          break;
        case "html":
          void handleExportHtml();
          break;
        case "pdf":
          handleExportPdf();
          break;
        case "mp4":
          void handleExportMp4();
          break;
        case "webm":
          void handleExportWebm();
          break;
        case "gif":
          void handleExportGif();
          break;
        case "webpAnim":
          void handleExportWebpAnim();
          break;
      }
    },
    [
      onExportDialogClose,
      handleExportPng,
      handleExportWebp,
      handleExportSvg,
      handleExportHtml,
      handleExportPdf,
      handleExportMp4,
      handleExportWebm,
      handleExportGif,
      handleExportWebpAnim
    ]
  );

  const handleCopyFromDialog = useCallback(() => {
    onExportDialogClose();
    void handleCopyPng();
  }, [onExportDialogClose, handleCopyPng]);

  // Clear the transient "Copied" status after a moment so it doesn't
  // linger in the toolbar like the persistent Saved indicator.
  useEffect(() => {
    if (!copyStatus) return;
    const timeout = setTimeout(() => setCopyStatus(null), 1500);
    return () => clearTimeout(timeout);
  }, [copyStatus]);

  return {
    videoExportStatus,
    videoExportProgress,
    gifExportStatus,
    gifExportProgress,
    exportError,
    copyStatus,
    isExporting: videoExportStatus !== null || gifExportStatus !== null,
    copyShareUrl,
    handleExport,
    handleCopyFromDialog,
    handleExportPng,
    handleExportWebp,
    handleExportSvg,
    handleExportHtml,
    handleExportPdf,
    handleExportMp4,
    handleExportWebm,
    handleExportWebpAnim,
    handleExportGif,
    handleCopyPng
  };
}
