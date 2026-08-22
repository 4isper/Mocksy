"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import { useEditorExport } from "@/lib/hooks/useEditorExport";
import { useAutosaveStatus } from "@/lib/hooks/useAutosaveStatus";
import { warmUpFfmpeg } from "@/lib/export/exportVideo";
import { useEditorShortcuts } from "@/lib/hooks/useEditorShortcuts";
import { useClipboardPaste } from "@/lib/hooks/useClipboardPaste";
import { ControlPanel } from "@/components/editor/ControlPanel";
import { ExportDialog } from "@/components/editor/ExportDialog";
import { ShortcutsDialog } from "@/components/editor/ShortcutsDialog";
import { PreviewCanvas } from "@/components/editor/PreviewCanvas";
import { RightPanel } from "@/components/editor/RightPanel";
import { CommandPalette } from "@/components/editor/CommandPalette";
import { ErrorBoundary } from "@/components/editor/ErrorBoundary";
import { ResetConfirmDialog } from "@/components/editor/ResetConfirmDialog";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { OnboardingTour, hasSeenOnboarding } from "@/components/editor/OnboardingTour";
import { useCommands } from "@/lib/hooks/useCommands";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";
import { useProjectsStore } from "@/lib/state/projectsStore";
import { initHistoryPersistence, restoreHistory } from "@/lib/state/historyStorage";
import { readSharedSceneFromUrl } from "@/lib/state/shareState";
import { warmProjectCache } from "@/lib/state/projectsStore";
import type { EditorScene } from "@/lib/types/editor";

export function EditorShell() {
  const t = useTranslations();
  const scene = useEditorStore((s) => s.scene);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const setScene = useEditorStore((s) => s.setScene);
  const resetScene = useEditorStore((s) => s.resetScene);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const undoCount = useEditorStore((s) => s.past.length);
  const redoCount = useEditorStore((s) => s.future.length);
  const exportScale = useEditorStore((s) => s.exportScale);
  const setExportScale = useEditorStore((s) => s.setExportScale);
  const customExportSize = useEditorStore((s) => s.customExportSize);
  const setCustomExportSize = useEditorStore((s) => s.setCustomExportSize);
  const setAspectRatio = useEditorStore((s) => s.setAspectRatio);
  const saveError = useProjectsStore((s) => s.saveError);
  const fullscreenPreview = useEditorStore((s) => s.fullscreenPreview);
  const setFullscreenPreview = useEditorStore((s) => s.setFullscreenPreview);

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [resetNotice, setResetNotice] = useState(false);
  const resetNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasOpenModalRef = useRef(false);
  const bootstrapped = useRef(false);
  const historyCleanupRef = useRef<(() => void) | null>(null);

  const resetTrapRef = useFocusTrap(confirmResetOpen);

  useEffect(() => {
    hasOpenModalRef.current = confirmResetOpen || exportOpen || shortcutsOpen || commandPaletteOpen;
  }, [confirmResetOpen, exportOpen, shortcutsOpen, commandPaletteOpen]);

  const closeExportDialog = useCallback(() => setExportOpen(false), []);
  const exportApi = useEditorExport(scene, exportScale, customExportSize, closeExportDialog, activeLayerId);

  const { saved, saveToast, savedSceneRef, saveNow, markSaved } = useAutosaveStatus(scene, activeLayerId, bootstrapped);

  const commands = useCommands(
    exportApi.handleExportPng,
    exportApi.handleExportWebp,
    exportApi.handleExportSvg,
    exportApi.handleExportHtml,
    exportApi.handleExportPdf,
    exportApi.handleExportMp4,
    exportApi.handleExportWebm,
    exportApi.handleExportGif,
    exportApi.handleExportWebpAnim,
    exportApi.handleCopyPng,
    exportApi.copyShareUrl,
    saveNow,
    () => setFullscreenPreview(!fullscreenPreview)
  );

  const handleReset = useCallback(() => setConfirmResetOpen(true), []);
  const handleNewProject = useCallback(() => {
    const id = useProjectsStore.getState().createProject("Untitled");
    useProjectsStore.getState().switchProject(id);
  }, []);
  useEditorShortcuts({
    saveNow,
    onReset: handleReset,
    onNewProject: handleNewProject,
    onExportPng: exportApi.handleExportPng,
    onExportMp4: exportApi.handleExportMp4,
    onExportGif: exportApi.handleExportGif,
    onExportWebm: exportApi.handleExportWebm,
    onExportWebp: exportApi.handleExportWebp,
    onExportWebpAnim: exportApi.handleExportWebpAnim,
    onExportSvg: exportApi.handleExportSvg,
    onExportHtml: exportApi.handleExportHtml,
    onExportPdf: exportApi.handleExportPdf,
    onCopyPng: exportApi.handleCopyPng,
    onOpenShortcuts: () => setShortcutsOpen(true),
    onOpenCommandPalette: () => setCommandPaletteOpen(true),
    onToggleFullscreen: () => setFullscreenPreview(!fullscreenPreview),
    isModalOpen: () => hasOpenModalRef.current
  });
  // ⌘V pastes screenshots / copied media files (or an image URL) into the
  // active layer. Passive listener — no shortcut registration needed.
  useClipboardPaste();

  useEffect(() => {
    // Preload the FFmpeg encoder in the background so the first video/GIF
    // export doesn't block on the 32MB WASM download + worker boot. Gated on
    // the first user interaction: keeps the initial page load light (and the
    // Lighthouse byte-weight audit clean) for visitors who never export video.
    const arm = () => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => warmUpFfmpeg(), { timeout: 5000 });
      } else {
        setTimeout(warmUpFfmpeg, 1000);
      }
    };
    window.addEventListener("pointerdown", arm, { once: true });
    window.addEventListener("keydown", arm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, []);

  useEffect(() => {
    // Bootstrap from projects (URL share, localStorage, or a fresh demo).
    // Share links may carry a deflate-compressed payload, which only decodes
    // asynchronously — resolve it (or null) once, then hydrate with it. The
    // restored scene is not a user edit, so don't push it onto the undo stack
    // (also keeps StrictMode's double-mount from recording a duplicate entry).
    let alive = true;
    void Promise.all([readSharedSceneFromUrl(), warmProjectCache()]).then(([shared]) => {
      if (!alive) return;
      const restored = useProjectsStore.getState().hydrate(shared);
      // The restored scene already matches what's persisted, so treat it as the
      // saved baseline. `setScene` merges into a fresh object, so sync the ref
      // to the live scene afterwards — the autosave watcher won't flag it
      // "unsaved" on load.
      setScene(restored, false);
      savedSceneRef.current = useEditorStore.getState().scene;
      bootstrapped.current = true;
      // Bring back the undo/redo stacks saved by the last session (also not an
      // edit — it only fills `past`/`future`), then start watching for changes
      // so every subsequent edit persists across reloads.
      restoreHistory();
      historyCleanupRef.current = initHistoryPersistence();
    });
    return () => {
      alive = false;
      historyCleanupRef.current?.();
      historyCleanupRef.current = null;
    };
  }, [setScene, savedSceneRef]);

  useEffect(() => {
    // Show the guided tour once, on the first visit only. Skipped under
    // automation (navigator.webdriver): every e2e run starts with empty
    // localStorage and the backdrop would blanket every screenshot/click.
    // The tour itself stays testable via its command-palette entry.
    if (navigator.webdriver) return;
    if (!hasSeenOnboarding()) {
      const t = setTimeout(() => useEditorStore.getState().setOnboardingOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const toastStatus = exportApi.copyStatus
    ? { msg: exportApi.copyStatus, type: "success" as const }
    : exportApi.exportError
      ? { msg: exportApi.exportError, type: "error" as const }
      : saveError
        ? { msg: saveError, type: "error" as const }
        : saveToast
          ? { msg: saveToast, type: "info" as const }
          : null;

  useEffect(() => () => {
    if (resetNoticeTimer.current) clearTimeout(resetNoticeTimer.current);
  }, []);

  const confirmReset = useCallback(() => {
    resetScene();
    markSaved();
    setResetNotice(true);
    if (resetNoticeTimer.current) clearTimeout(resetNoticeTimer.current);
    resetNoticeTimer.current = setTimeout(() => setResetNotice(false), 6000);
    setConfirmResetOpen(false);
  }, [resetScene, markSaved]);

  const cancelReset = useCallback(() => setConfirmResetOpen(false), []);

  return (
    <main className="editor-shell" id="main-content" tabIndex={-1}>
      {!fullscreenPreview ? (
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <h1>Mocksy</h1>
          <span className="tag">{t("editor.tagline")}</span>
        </div>
      ) : null}
      <div className={fullscreenPreview ? "editor-grid fullscreen" : "editor-grid"}>
        {!fullscreenPreview ? <ErrorBoundary message={t("errors.message")}><ControlPanel /></ErrorBoundary> : null}
        <section
          className="preview-column"
          style={{
            display: "grid",
            gridTemplateRows: fullscreenPreview ? "1fr" : "1fr auto",
            gap: 12,
            minHeight: 0,
            overflow: "hidden",
            position: "relative"
          }}
        >
          {fullscreenPreview ? (
            <button
              type="button"
              className="btn-tb btn-tb-icon fullscreen-exit"
              onClick={() => setFullscreenPreview(false)}
              title={t("editor.exitFullscreen")}
              aria-label={t("editor.exitFullscreen")}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9 1v4h4M5 13V9H1M13 5H9V1M1 9h4v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          ) : null}
          <ErrorBoundary message={t("errors.message")}><PreviewCanvas scene={scene} /></ErrorBoundary>
          {!fullscreenPreview ? (
            <EditorToolbar
              canUndo={canUndo}
              canRedo={canRedo}
              undoCount={undoCount}
              redoCount={redoCount}
              onUndo={undo}
              onRedo={redo}
              onExport={() => setExportOpen(true)}
              isExporting={exportApi.isExporting}
              videoExportStatus={exportApi.videoExportStatus}
              videoExportProgress={exportApi.videoExportProgress}
              gifExportStatus={exportApi.gifExportStatus}
              gifExportProgress={exportApi.gifExportProgress}
              onCancelExport={exportApi.cancelExport}
              onShare={exportApi.copyShareUrl}
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
              onOpenShortcuts={() => setShortcutsOpen(true)}
              onReset={handleReset}
              saveToast={toastStatus ? toastStatus.msg : null}
              saveStatusType={toastStatus ? toastStatus.type : "info"}
              resetNotice={resetNotice}
              onUndoReset={() => { undo(); setResetNotice(false); }}
              onToggleFullscreen={() => setFullscreenPreview(true)}
            />
          ) : null}
        </section>
        {!fullscreenPreview ? <ErrorBoundary message={t("errors.message")}><RightPanel /></ErrorBoundary> : null}
      </div>
      <ResetConfirmDialog open={confirmResetOpen} onConfirm={confirmReset} onCancel={cancelReset} />
      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        scale={exportScale}
        onScaleChange={setExportScale}
        customSize={customExportSize}
        onCustomSizeChange={setCustomExportSize}
        onAspectRatioChange={setAspectRatio}
        onExport={exportApi.handleExport}
        onCopy={exportApi.handleCopyFromDialog}
        busy={exportApi.isExporting}
        onCancel={exportApi.cancelExport}
        isMultiFrame={scene.frameInstances.length > 0}
      />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <OnboardingTour />
      <CommandPalette
        commands={commands}
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </main>
  );
}
