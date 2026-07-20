"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ControlPanel } from "@/components/editor/ControlPanel";
import { PreviewCanvas } from "@/components/editor/PreviewCanvas";
import { TemplatesPanel } from "@/components/editor/TemplatesPanel";
import { LayersPanel } from "@/components/editor/LayersPanel";
import { useEditorStore } from "@/lib/state/editorStore";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene } from "@/lib/types/editor";
import { exportImage } from "@/lib/export/exportImage";
import { exportGif } from "@/lib/export/exportVideo";
import { readSceneFromUrl, sceneToShareUrl } from "@/lib/state/shareState";
import { normalizeScene } from "@/lib/state/normalizeScene";
import { DEMO_MEDIA_NAME, DEMO_MEDIA_URL } from "@/lib/media/demoMedia";

const AUTOSAVE_KEY = "mocksy-scene";
const AUTOSAVE_DELAY = 500;

/** A fresh scene seeded with the bundled demo media (used on first load and
 *  when a saved payload is too corrupted to normalize). */
function demoScene(): EditorScene {
  return {
    layers: [
      {
        id: "seed",
        mediaUrl: DEMO_MEDIA_URL,
        mediaType: "image",
        mediaName: DEMO_MEDIA_NAME,
        zoom: 1,
        mediaOffsetX: 0,
        mediaOffsetY: 0,
        animationPreset: "none",
        videoMuted: true,
        videoLoop: true,
        videoAutoplay: true,
        videoPosterTime: 0,
        videoDuration: 0,
        videoTrimStart: 0,
        videoTrimEnd: 0,
        videoQuality: "medium"
      }
    ],
    activeLayerId: "seed",
    frame: initialScene.frame,
    stylePreset: initialScene.stylePreset,
    shadowOpacity: initialScene.shadowOpacity,
    borderRadius: initialScene.borderRadius,
    backgroundMode: initialScene.backgroundMode,
    backgroundColor: initialScene.backgroundColor,
    gradientFrom: initialScene.gradientFrom,
    gradientTo: initialScene.gradientTo,
    watermarkText: initialScene.watermarkText,
    watermarkEnabled: initialScene.watermarkEnabled,
    watermarkPosition: initialScene.watermarkPosition,
    watermarkSize: initialScene.watermarkSize,
    aspectRatio: initialScene.aspectRatio
  };
}

export function EditorShell() {
  const scene = useEditorStore((s) => s.scene);
  const setScene = useEditorStore((s) => s.setScene);
  const resetScene = useEditorStore((s) => s.resetScene);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const pastLength = useEditorStore((s) => s.past.length);
  const futureLength = useEditorStore((s) => s.future.length);
  const [videoExportStatus, setVideoExportStatus] = useState<string | null>(null);
  const [videoExportProgress, setVideoExportProgress] = useState<number>(0);
  const [gifExportStatus, setGifExportStatus] = useState<string | null>(null);
  const [gifExportProgress, setGifExportProgress] = useState<number>(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fromUrl = readSceneFromUrl();
    const fromLocal = window.localStorage.getItem(AUTOSAVE_KEY);
    // Initial load restores saved state; it is not a user edit, so don't push
    // it onto the undo stack (also keeps StrictMode's double-mount from
    // recording a duplicate entry).
    if (fromUrl) setScene(fromUrl, false);
    else if (fromLocal) {
      try {
        const restored = normalizeScene(JSON.parse(fromLocal));
        // Object URLs (blob:) are revoked when the tab closes, so a saved
        // blob: layer can never reload after a refresh. Replace any dead
        // blob: layers with the demo media instead of showing an empty canvas.
        const hasBlob = restored.layers.some((l) => l.mediaUrl?.startsWith("blob:"));
        if (hasBlob) {
          setScene(
            {
              ...restored,
              layers: restored.layers.map((l) =>
                l.mediaUrl && l.mediaUrl.startsWith("blob:")
                  ? { ...l, mediaUrl: DEMO_MEDIA_URL, mediaType: "image", mediaName: DEMO_MEDIA_NAME }
                  : l
              )
            },
            false
          );
        } else {
          setScene(restored, false);
        }
      } catch {
        setScene(demoScene(), false);
      }
    } else setScene(demoScene(), false);
  }, [setScene]);

  useEffect(() => {
    setSaved(false);
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(scene));
      setSaved(true);
    }, AUTOSAVE_DELAY);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [scene]);

  const saveNow = useCallback(() => {
    window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(scene));
    setSaved(true);
  }, [scene]);

  const copyShareUrl = useCallback(async () => {
    const url = sceneToShareUrl(scene);
    await navigator.clipboard.writeText(url);
  }, [scene]);

  const handleExportPng = useCallback(() => {
    setExportError(null);
    exportImage(scene, "preview-canvas", "mocksy-export", setExportError);
  }, [scene]);

  const handleExportMp4 = useCallback(async () => {
    setExportError(null);
    try {
      setVideoExportStatus("Exporting video…");
      setVideoExportProgress(0);
      // Loaded lazily so the 32MB FFmpeg WASM bundle stays out of the editor's
      // main chunk and only downloads when the user actually exports an MP4.
      const { exportVideo } = await import("@/lib/export/exportVideo");
      await exportVideo(scene, setVideoExportStatus, setVideoExportProgress, setExportError);
    } finally {
      setTimeout(() => {
        setVideoExportStatus(null);
        setVideoExportProgress(0);
      }, 800);
    }
  }, [scene]);

  const handleExportGif = useCallback(async () => {
    setExportError(null);
    try {
      setGifExportStatus("Exporting GIF…");
      setGifExportProgress(0);
      // Reuse the lazily-loaded FFmpeg module already imported for MP4.
      const { exportGif } = await import("@/lib/export/exportVideo");
      await exportGif(scene, setGifExportStatus, setGifExportProgress, setExportError);
    } finally {
      setTimeout(() => {
        setGifExportStatus(null);
        setGifExportProgress(0);
      }, 800);
    }
  }, [scene]);

  const handleReset = useCallback(() => {
    setConfirmResetOpen(true);
  }, []);

  const confirmReset = useCallback(() => {
    resetScene();
    setSaved(false);
    setConfirmResetOpen(false);
  }, [resetScene]);

  const cancelReset = useCallback(() => setConfirmResetOpen(false), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveNow();
        return;
      }
      if (event.key.toLowerCase() === "r" && !modifier) {
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
        event.preventDefault();
        handleReset();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, saveNow, handleReset]);

  return (
    <main className="editor-shell">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <h1>Mocksy</h1>
        <span className="tag">Free mockup editor — no subscriptions</span>
      </div>
      <div className="editor-grid">
        <ControlPanel />
        <section style={{ display: "grid", gridTemplateRows: "1fr auto", gap: 12, minHeight: 0, overflow: "hidden" }}>
          <PreviewCanvas scene={scene} />
          <div className="panel toolbar">
            <button type="button" className="btn" onClick={undo} disabled={pastLength === 0} title="Undo (⌘Z)">
              Undo
            </button>
            <button type="button" className="btn" onClick={redo} disabled={futureLength === 0} title="Redo (⇧⌘Z)">
              Redo
            </button>
            <button type="button" className="btn btn-primary" onClick={handleExportPng} title="Export PNG">
              Export PNG
            </button>
            <button
              type="button"
              className="btn"
              disabled={videoExportStatus !== null || gifExportStatus !== null}
              onClick={handleExportMp4}
              title="Export MP4"
            >
              Export MP4
            </button>
            <button
              type="button"
              className="btn"
              disabled={videoExportStatus !== null || gifExportStatus !== null}
              onClick={handleExportGif}
              title="Export GIF"
            >
              Export GIF
            </button>
            {videoExportStatus ? (
              <div className="export-status">
                <span className="label">{videoExportStatus}</span>
                <div className="progress">
                  <div style={{ width: `${videoExportProgress}%` }} />
                </div>
                <span className="pct">{Math.round(videoExportProgress)}%</span>
              </div>
            ) : null}
            {gifExportStatus ? (
              <div className="export-status">
                <span className="label">{gifExportStatus}</span>
                <div className="progress">
                  <div style={{ width: `${gifExportProgress}%` }} />
                </div>
                <span className="pct">{Math.round(gifExportProgress)}%</span>
              </div>
            ) : null}
            {exportError ? (
              <span className="error" role="alert">
                {exportError}
              </span>
            ) : (
              <span className={`status${saved ? " saved" : ""}`}>{saved ? "Saved" : "Editing…"}</span>
            )}
            <span className="spacer" />
            <button type="button" className="btn" onClick={saveNow} title="Save (⌘S)">
              Save
            </button>
            <button type="button" className="btn" onClick={copyShareUrl} title="Copy Share URL">
              Share
            </button>
            <button type="button" className="btn" onClick={handleReset} title="Reset (R)">
              Reset
            </button>
          </div>
        </section>
        <TemplatesPanel />
        <LayersPanel />
      </div>
      {confirmResetOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={cancelReset}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            aria-describedby="reset-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="reset-title">Reset editor?</h3>
            <p id="reset-desc">This clears the current mockup and returns to the default scene. You can undo afterwards.</p>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={cancelReset} autoFocus>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmReset}>
                Reset
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
