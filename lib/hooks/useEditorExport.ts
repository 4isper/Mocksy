import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { exportImage, copyPngToClipboard, exportWebp } from "@/lib/export/exportImage";
import { exportPdf } from "@/lib/export/exportPdf";
import type { ExportFormat } from "@/components/editor/ExportDialog";
import { sceneToShareUrl, sceneToTemplateUrl, ShareUrlTooLarge } from "@/lib/state/shareState";
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
  handleExportZip: () => void;
  handleExportMp4: () => void;
  handleExportWebm: () => void;
  handleExportWebpAnim: () => void;
  handleExportGif: () => void;
  handleCopyPng: () => Promise<void>;
  copyTemplateUrl: () => Promise<void>;
  /** URL currently shown in the share-QR dialog, or null when closed. */
  shareQrUrl: string | null;
  closeShareQr: () => void;
  cancelExport: () => void;
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
  const [shareQrUrl, setShareQrUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancelExport = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setVideoExportStatus(null);
    setGifExportStatus(null);
    setExportError(null);
  }, []);

  const clearVideoStatus = useCallback(() => {
    setVideoExportStatus(null);
    setVideoExportProgress(0);
  }, []);

  const clearGifStatus = useCallback(() => {
    setGifExportStatus(null);
    setGifExportProgress(0);
  }, []);

  // Transient status messages auto-dismiss so a success/error toast doesn't
  // stay pinned in the toolbar forever after a copy/export/share action.
  useEffect(() => {
    if (!copyStatus) return;
    const id = setTimeout(() => setCopyStatus(null), 3200);
    return () => clearTimeout(id);
  }, [copyStatus]);

  useEffect(() => {
    if (!exportError) return;
    const id = setTimeout(() => setExportError(null), 6000);
    return () => clearTimeout(id);
  }, [exportError]);

  const copyShareUrl = useCallback(async () => {
    try {
      const url = await sceneToShareUrl({ ...scene, activeLayerId });
      await navigator.clipboard.writeText(url);
      setCopyStatus(t("editor.shareLinkCopied"));
      setShareQrUrl(url);
    } catch (err) {
      if (err instanceof ShareUrlTooLarge) {
        setExportError(t("errors.shareUrlTooLarge"));
      } else {
        setExportError(err instanceof Error ? err.message : t("export.shareLinkFailed"));
      }
    }
  }, [scene, activeLayerId, t]);

  // Template links carry the scene's appearance without any media payloads,
  // so they stay small and never leak uploaded screenshots.
  const copyTemplateUrl = useCallback(async () => {
    try {
      const url = await sceneToTemplateUrl({ ...scene, activeLayerId });
      await navigator.clipboard.writeText(url);
      setCopyStatus(t("editor.templateLinkCopied"));
      setShareQrUrl(url);
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
    void Promise.resolve(exportImage(scene, "preview-canvas", "mocksy-export", setExportError, exportScale, customExportSize, activeLayerId)).then(
      () => setCopyStatus(t("editor.exported"))
    );
  }, [scene, exportScale, customExportSize, activeLayerId, t]);

  const handleCopyPng = useCallback(async () => {
    setExportError(null);
    await copyPngToClipboard(scene, "preview-canvas", setExportError, setCopyStatus, exportScale, customExportSize, activeLayerId);
  }, [scene, exportScale, customExportSize, activeLayerId]);

  const handleExportWebp = useCallback(() => {
    setExportError(null);
    void Promise.resolve(exportWebp(scene, "preview-canvas", "mocksy-export", setExportError, exportScale, customExportSize, activeLayerId)).then(
      () => setCopyStatus(t("editor.exported"))
    );
  }, [scene, exportScale, customExportSize, activeLayerId, t]);

  const handleExportSvg = useCallback(async () => {
    setExportError(null);
    try {
      const { exportSvg } = await import("@/lib/export/exportSvg");
      await exportSvg(scene, "preview-canvas", "mocksy-export", setExportError, activeLayerId);
      setCopyStatus(t("editor.exported"));
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t("export.svgFailed"));
    }
  }, [scene, t, activeLayerId]);

  const handleExportHtml = useCallback(async () => {
    setExportError(null);
    try {
      const { exportHtml } = await import("@/lib/export/exportHtml");
      await exportHtml(scene, "preview-canvas", "mocksy-export", setExportError, activeLayerId);
      setCopyStatus(t("editor.exported"));
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t("export.htmlFailed"));
    }
  }, [scene, t, activeLayerId]);

  const handleExportPdf = useCallback(() => {
    setExportError(null);
    void Promise.resolve(exportPdf(scene, "preview-canvas", "mocksy-export", setExportError, exportScale, customExportSize, activeLayerId)).then(
      () => setCopyStatus(t("editor.exported"))
    );
  }, [scene, exportScale, customExportSize, activeLayerId, t]);

  const handleExportZip = useCallback(async () => {
    setExportError(null);
    try {
      const { exportBatchZip } = await import("@/lib/export/exportBatch");
      await exportBatchZip(
        scene,
        "preview-canvas",
        "mocksy-export",
        setExportError,
        exportScale,
        activeLayerId,
        (current, total) => {
          setVideoExportStatus(t("export.exportingZip", { current, total }));
          setVideoExportProgress(Math.round((current / total) * 100));
        }
      );
      setCopyStatus(t("editor.exported"));
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t("export.zipFailed"));
    } finally {
      setTimeout(clearVideoStatus, STATUS_CLEAR_DELAY);
    }
  }, [scene, exportScale, t, clearVideoStatus, activeLayerId]);

  const handleExportMp4 = useCallback(async () => {
    setExportError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      setVideoExportStatus(t("export.exportingVideo"));
      setVideoExportProgress(0);
      const { exportVideo } = await import("@/lib/export/exportVideo");
      await exportVideo(scene, exportScale, setVideoExportStatus, setVideoExportProgress, setExportError, customExportSize, activeLayerId, ctrl.signal);
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setTimeout(clearVideoStatus, STATUS_CLEAR_DELAY);
    }
  }, [scene, exportScale, customExportSize, t, clearVideoStatus, activeLayerId]);

  const handleExportWebm = useCallback(async () => {
    setExportError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      setVideoExportStatus(t("export.exportingWebm"));
      setVideoExportProgress(0);
      const { exportWebm } = await import("@/lib/export/exportVideo");
      await exportWebm(scene, exportScale, setVideoExportStatus, setVideoExportProgress, setExportError, customExportSize, activeLayerId, ctrl.signal);
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setTimeout(clearVideoStatus, STATUS_CLEAR_DELAY);
    }
  }, [scene, exportScale, customExportSize, t, clearVideoStatus, activeLayerId]);

  const handleExportWebpAnim = useCallback(async () => {
    setExportError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      setVideoExportStatus(t("export.exportingWebpAnim"));
      setVideoExportProgress(0);
      const { exportWebpAnim } = await import("@/lib/export/exportVideo");
      await exportWebpAnim(scene, exportScale, setVideoExportStatus, setVideoExportProgress, setExportError, customExportSize, activeLayerId, ctrl.signal);
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setTimeout(clearVideoStatus, STATUS_CLEAR_DELAY);
    }
  }, [scene, exportScale, customExportSize, t, clearVideoStatus, activeLayerId]);

  const handleExportGif = useCallback(async () => {
    setExportError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      setGifExportStatus(t("export.exportingGif"));
      setGifExportProgress(0);
      const { exportGif } = await import("@/lib/export/exportVideo");
      await exportGif(scene, exportScale, setGifExportStatus, setGifExportProgress, setExportError, customExportSize, activeLayerId, ctrl.signal);
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setTimeout(clearGifStatus, STATUS_CLEAR_DELAY);
    }
  }, [scene, exportScale, customExportSize, t, clearGifStatus, activeLayerId]);

  const handleExport = useCallback(
    (format: ExportFormat) => {
      // Raster/image exports are synchronous downloads, so close the dialog
      // immediately. Video exports show live progress with a cancel button,
      // so keep the dialog open and let the toolbar/timer close it.
      const isVideo = format === "mp4" || format === "webm" || format === "gif" || format === "webpAnim";
      if (!isVideo) onExportDialogClose();
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
        case "zip":
          void handleExportZip();
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
      handleExportZip,
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
    copyTemplateUrl,
    shareQrUrl,
    closeShareQr: () => setShareQrUrl(null),
    handleExport,
    handleCopyFromDialog,
    handleExportPng,
    handleExportWebp,
    handleExportSvg,
    handleExportHtml,
    handleExportPdf,
    handleExportZip,
    handleExportMp4,
    handleExportWebm,
    handleExportWebpAnim,
    handleExportGif,
    handleCopyPng,
    cancelExport
  };
}
