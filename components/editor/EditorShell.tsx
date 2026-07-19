"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ControlPanel } from "@/components/editor/ControlPanel";
import { PreviewCanvas } from "@/components/editor/PreviewCanvas";
import { TemplatesPanel } from "@/components/editor/TemplatesPanel";
import { useEditorStore } from "@/lib/state/editorStore";
import { exportImage } from "@/lib/export/exportImage";
import { exportVideo } from "@/lib/export/exportVideo";
import { readSceneFromUrl, sceneToShareUrl } from "@/lib/state/shareState";
import { normalizeScene } from "@/lib/state/normalizeScene";
import { DEMO_MEDIA_NAME, DEMO_MEDIA_URL } from "@/lib/media/demoMedia";

const AUTOSAVE_KEY = "mocksy-scene";
const AUTOSAVE_DELAY = 500;

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
  const [exportError, setExportError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fromUrl = readSceneFromUrl();
    const fromLocal = window.localStorage.getItem(AUTOSAVE_KEY);
    if (fromUrl) setScene(fromUrl);
    else if (fromLocal) {
      try {
        const restored = normalizeScene(JSON.parse(fromLocal));
        // Object URLs (blob:) are revoked when the tab closes, so a saved
        // blob: mediaUrl can never reload after a refresh. Fall back to the
        // demo media instead of showing an empty canvas.
        if (restored.mediaUrl && restored.mediaUrl.startsWith("blob:")) {
          setScene({ ...restored, mediaUrl: DEMO_MEDIA_URL, mediaType: "image", mediaName: DEMO_MEDIA_NAME });
        } else {
          setScene(restored);
        }
      } catch {
        setScene({ mediaUrl: DEMO_MEDIA_URL, mediaType: "image", mediaName: DEMO_MEDIA_NAME });
      }
    } else setScene({ mediaUrl: DEMO_MEDIA_URL, mediaType: "image", mediaName: DEMO_MEDIA_NAME });
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
      await exportVideo(scene, setVideoExportStatus, setVideoExportProgress, setExportError);
    } finally {
      setTimeout(() => {
        setVideoExportStatus(null);
        setVideoExportProgress(0);
      }, 800);
    }
  }, [scene]);

  const handleReset = useCallback(() => {
    resetScene();
    setSaved(false);
  }, [resetScene]);

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
      if (modifier && event.key.toLowerCase() === "e") {
        event.preventDefault();
        handleExportPng();
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
  }, [undo, redo, saveNow, handleExportPng, handleReset]);

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
            <button type="button" className="btn btn-primary" onClick={handleExportPng} title="Export PNG (⌘E)">
              Export PNG
            </button>
            <button
              type="button"
              className="btn"
              disabled={videoExportStatus !== null}
              onClick={handleExportMp4}
              title="Export MP4"
            >
              Export MP4
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
      </div>
    </main>
  );
}
