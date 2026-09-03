"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import { useEditorExport } from "@/lib/hooks/useEditorExport";
import { useAutosaveStatus } from "@/lib/hooks/useAutosaveStatus";
import { STORAGE_FULL_ERROR_KEY } from "@/lib/state/projectsStore";
import { hasOpenModalSurface } from "@/lib/state/modalRegistry";
import { warmUpFfmpeg } from "@/lib/export/exportVideo";
import { useEditorShortcuts } from "@/lib/hooks/useEditorShortcuts";
import { useClipboardPaste } from "@/lib/hooks/useClipboardPaste";
import { ControlPanel } from "@/components/editor/ControlPanel";
import { PreviewCanvas } from "@/components/editor/PreviewCanvas";
import { RightPanel } from "@/components/editor/RightPanel";
import { ErrorBoundary } from "@/components/editor/ErrorBoundary";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { MobileTabBar } from "@/components/editor/MobileTabBar";
import { PanelResizeHandles } from "@/components/editor/PanelResizeHandles";
import { SheetGrabber } from "@/components/editor/SheetGrabber";
import { LiveAnnouncer } from "@/components/editor/LiveAnnouncer";
import { hasSeenOnboarding } from "@/components/editor/OnboardingTour";
import { useCommands } from "@/lib/hooks/useCommands";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";
import { useProjectsStore } from "@/lib/state/projectsStore";
import { clearPersistedHistory, initHistoryPersistence, restoreHistory } from "@/lib/state/historyStorage";
import { readSharedSceneFromUrl, readTemplateFromUrl, clearTemplateFromUrl } from "@/lib/state/shareState";
import { warmProjectCache } from "@/lib/state/projectsStore";
import type { EditorScene } from "@/lib/types/editor";

const ExportDialog = React.lazy(() =>
  import("@/components/editor/ExportDialog").then((m) => ({ default: m.ExportDialog }))
);
const ShortcutsDialog = React.lazy(() =>
  import("@/components/editor/ShortcutsDialog").then((m) => ({ default: m.ShortcutsDialog }))
);
const CommandPalette = React.lazy(() =>
  import("@/components/editor/CommandPalette").then((m) => ({ default: m.CommandPalette }))
);
const ResetConfirmDialog = React.lazy(() =>
  import("@/components/editor/ResetConfirmDialog").then((m) => ({ default: m.ResetConfirmDialog }))
);
const OnboardingTour = React.lazy(() =>
  import("@/components/editor/OnboardingTour").then((m) => ({ default: m.OnboardingTour }))
);
const ShareQrDialog = React.lazy(() =>
  import("@/components/editor/ShareQrDialog").then((m) => ({ default: m.ShareQrDialog }))
);

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

  const translatedSaveError = saveError === STORAGE_FULL_ERROR_KEY ? t("editor.storageFull") : saveError;
  const fullscreenPreview = useEditorStore((s) => s.fullscreenPreview);
  const setFullscreenPreview = useEditorStore((s) => s.setFullscreenPreview);
  const mobileSheet = useEditorStore((s) => s.mobileSheet);
  const setMobileSheet = useEditorStore((s) => s.setMobileSheet);

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [resetNotice, setResetNotice] = useState(false);
  const resetNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bootstrapped = useRef(false);
  const historyCleanupRef = useRef<(() => void) | null>(null);

  // ResetConfirmDialog owns its own focus trap (like every other dialog);
  // a second one here would run side by side with it, double-locking scroll
  // and restoring focus to the wrong element on close.
  const controlsSheetTrapRef = useFocusTrap(mobileSheet === "controls");
  const rightSheetTrapRef = useFocusTrap(mobileSheet === "right");

  const closeExportDialog = useCallback(() => setExportOpen(false), []);
  const exportApi = useEditorExport(scene, exportScale, customExportSize, closeExportDialog, activeLayerId);

  // Every shortcut-gated dialog is routed through this gate: while any of them
  // is open the global shortcuts are parked so keystrokes land in the dialog,
  // not the editor. The Share-QR dialog is stateful inside exportApi, so it's
  // folded in here as a final boolean rather than a separate local state.
  // Dialogs whose open state lives inside panels (inline confirmations, the
  // onboarding tour, mobile sheets) register in the modal registry through
  // their focus trap and are polled live via hasOpenModalSurface(): a cached
  // snapshot would go stale when a registry-backed dialog closes without
  // re-rendering EditorShell, parking every shortcut (⌘K included) forever.
  const isModalOpen = useCallback(() => {
    return (
      confirmResetOpen ||
      exportOpen ||
      shortcutsOpen ||
      commandPaletteOpen ||
      exportApi.shareQrUrl !== null ||
      hasOpenModalSurface()
    );
  }, [confirmResetOpen, exportOpen, shortcutsOpen, commandPaletteOpen, exportApi.shareQrUrl]);

  const { saved, saveToast, savedSceneRef, saveNow, markSaved } = useAutosaveStatus(scene, activeLayerId, bootstrapped);

  // Stable per-fullscreenPreview change: an inline closure passed straight to
  // useCommands would defeat its useMemo and rebuild the command list on
  // every render (the always-mounted palette re-renders with it).
  const toggleFullscreenPreview = useCallback(
    () => setFullscreenPreview(!fullscreenPreview),
    [setFullscreenPreview, fullscreenPreview]
  );

  const commands = useCommands(
    exportApi.handleExportPng,
    exportApi.handleExportJpeg,
    exportApi.handleExportWebp,
    exportApi.handleExportAvif,
    exportApi.handleExportSvg,
    exportApi.handleExportHtml,
    exportApi.handleExportPdf,
    exportApi.handleExportMp4,
    exportApi.handleExportWebm,
    exportApi.handleExportGif,
    exportApi.handleExportWebpAnim,
    exportApi.handleExportZipVideo,
    exportApi.handleCopyPng,
    exportApi.handleCopyJpeg,
    exportApi.handleCopyWebp,
    exportApi.handleCopySvg,
    exportApi.handleCopyHtml,
    exportApi.copyShareUrl,
    saveNow,
    toggleFullscreenPreview
  );

  const handleReset = useCallback(() => setConfirmResetOpen(true), []);
  const handleNewProject = useCallback(() => {
    const id = useProjectsStore.getState().createProject(t("projects.untitled"));
    useProjectsStore.getState().switchProject(id);
  }, [t]);
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
    onToggleFullscreen: toggleFullscreenPreview,
    isModalOpen
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
    void Promise.all([readTemplateFromUrl(), readSharedSceneFromUrl(), warmProjectCache()])
      .then(
        ([template, shared]) => {
          if (!alive) return;
          // Template links win over share scenes: both params in one URL is a
          // hand-made edge case, and the template is the more specific intent.
          if (template) clearTemplateFromUrl();
          // A share or template link replaces the scene wholesale: the undo
          // stack persisted by the previous session belongs to a different
          // scene and must not be restored (⌘Z would swap the opened scene
          // for an old project's snapshot, which the autosave would then
          // persist over the new project). Continuations of the same session
          // (no URL scene) restore the stack so Ctrl+Z works after a reload.
          const fromShareOrTemplate = !!(template ?? shared);
          const restored = useProjectsStore.getState().hydrate(template ?? shared);
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
          if (fromShareOrTemplate) {
            useEditorStore.getState().clearHistory();
            clearPersistedHistory();
          } else {
            restoreHistory();
          }
          historyCleanupRef.current = initHistoryPersistence();
        })
      .catch((err) => {
        if (!alive) return;
        console.error("Editor bootstrap failed:", err);
        // Mark bootstrapped so autosave starts — the default scene is usable.
        bootstrapped.current = true;
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
      : exportApi.exportWarning
        ? { msg: exportApi.exportWarning, type: "info" as const }
        : saveError
          ? { msg: translatedSaveError, type: "error" as const }
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
      <LiveAnnouncer />
      {!fullscreenPreview ? (
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <h1>Mocksy</h1>
          <span className="tag">{t("editor.tagline")}</span>
        </div>
      ) : null}
      <div className={fullscreenPreview ? "editor-grid fullscreen" : "editor-grid"}>
        {!fullscreenPreview ? (
          /* Sheet hosts are layout-transparent (`display: contents`) on
             desktop so the grid still sees the panels directly; at the
             mobile breakpoint they become fixed bottom sheets. */
          <div ref={controlsSheetTrapRef} className={mobileSheet === "controls" ? "sheet-host sheet-host--controls is-open" : "sheet-host sheet-host--controls"}>
            <SheetGrabber onDismiss={() => setMobileSheet(null)} />
            <ErrorBoundary message={t("errors.message")} retryLabel={t("errors.tryAgain")}><ControlPanel /></ErrorBoundary>
          </div>
        ) : null}
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
          <ErrorBoundary message={t("errors.message")} retryLabel={t("errors.tryAgain")}><PreviewCanvas scene={scene} /></ErrorBoundary>
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
        {!fullscreenPreview ? (
          <div ref={rightSheetTrapRef} className={mobileSheet === "right" ? "sheet-host sheet-host--right is-open" : "sheet-host sheet-host--right"}>
            <SheetGrabber onDismiss={() => setMobileSheet(null)} />
            <ErrorBoundary message={t("errors.message")} retryLabel={t("errors.tryAgain")}>
              <RightPanel onShareTemplate={exportApi.copyTemplateUrl} />
            </ErrorBoundary>
          </div>
        ) : null}
        {!fullscreenPreview ? <PanelResizeHandles /> : null}
      </div>
      {!fullscreenPreview && mobileSheet ? (
        <div className="sheet-backdrop" aria-hidden="true" onClick={() => setMobileSheet(null)} />
      ) : null}
      {!fullscreenPreview ? <MobileTabBar onExport={() => setExportOpen(true)} /> : null}
      <Suspense fallback={null}>
        <ResetConfirmDialog open={confirmResetOpen} onConfirm={confirmReset} onCancel={cancelReset} />
      </Suspense>
      <Suspense fallback={null}>
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
          onCopyJpeg={exportApi.handleCopyJpeg}
          onCopyWebp={exportApi.handleCopyWebp}
          onCopySvg={exportApi.handleCopySvg}
          onCopyHtml={exportApi.handleCopyHtml}
          busy={exportApi.isExporting}
          onCancel={exportApi.cancelExport}
          isMultiFrame={scene.frameInstances.length > 0}
        />
      </Suspense>
      <Suspense fallback={null}>
        <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </Suspense>
      <Suspense fallback={null}>
        <OnboardingTour />
      </Suspense>
      <Suspense fallback={null}>
        <ShareQrDialog url={exportApi.shareQrUrl} onClose={exportApi.closeShareQr} />
      </Suspense>
      <Suspense fallback={null}>
        <CommandPalette
          commands={commands}
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
        />
      </Suspense>
    </main>
  );
}
