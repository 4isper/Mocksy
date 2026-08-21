"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/lib/state/editorStore";
import { loadMediaFromFile, loadMediaFromUrl, UnsupportedMediaError, UnsupportedMediaUrlError } from "@/lib/media/loadFile";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { useScreenRecording } from "@/lib/hooks/useScreenRecording";
import { VideoOptions } from "@/components/editor/VideoOptions";
import { Section } from "@/components/editor/Section";

function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function MediaSection() {
  const t = useTranslations();
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [mediaUrlBusy, setMediaUrlBusy] = useState(false);
  const { scene, activeLayerId, setMedia, setScenePalette, mediaUploadError, setMediaUploadError } = useEditorStore(
    useShallow((s) => ({
      scene: s.scene,
      activeLayerId: s.activeLayerId,
      setMedia: s.setMedia,
      setScenePalette: s.setScenePalette,
      mediaUploadError: s.mediaUploadError,
      setMediaUploadError: s.setMediaUploadError
    }))
  );

  const activeLayer = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
  const screenRecording = useScreenRecording();

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const { url, mediaType, mediaName } = await loadMediaFromFile(file);
      setMediaUploadError(null);
      // Drop any palette from the previous media; a fresh one is computed once
      // the new file decodes in the preview.
      setScenePalette(null);
      setMedia(url, mediaType, mediaName);
    } catch (err) {
      if (err instanceof UnsupportedMediaError) setMediaUploadError(err.message);
      else setMediaUploadError(t("editor.uploadError"));
    } finally {
      event.target.value = "";
    }
  };

  const handleUrlSubmit = async () => {
    const value = mediaUrlInput.trim();
    if (!value || mediaUrlBusy) return;
    setMediaUrlBusy(true);
    setMediaUploadError(null);
    try {
      const { url, mediaType, mediaName } = await loadMediaFromUrl(value);
      setScenePalette(null);
      setMedia(url, mediaType, mediaName);
      setMediaUrlInput("");
    } catch (err) {
      if (err instanceof UnsupportedMediaUrlError) setMediaUploadError(err.message);
      else setMediaUploadError(t("editor.uploadError"));
    } finally {
      setMediaUrlBusy(false);
    }
  };

  return (
    <Section
      id="media"
      title={t("editor.media")}
      icon={(
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="1.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="4.2" cy="4.2" r="0.9" fill="currentColor"/><path d="M1.5 8l2.6-2.6L8 9.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      )}
    >
      <div className="field-group">
        <div className="field">
          <label className="file-trigger">
            {t("editor.uploadMediaShort")}
            <input type="file" accept="image/*,video/*" onChange={handleFile} />
          </label>
          <button
            type="button"
            className="btn btn-sm"
            disabled={!screenRecording.supported}
            title={screenRecording.supported ? t("editor.recordScreenHint") : t("editor.screenRecordUnsupported")}
            aria-label={screenRecording.recording ? t("editor.stopRecording") : t("editor.recordScreen")}
            style={screenRecording.recording ? { color: "var(--danger)", borderColor: "var(--danger)" } : undefined}
            onClick={() => (screenRecording.recording ? screenRecording.stop() : screenRecording.start())}
          >
            {screenRecording.recording
              ? t("editor.stopRecordingElapsed", { time: formatElapsed(screenRecording.elapsed) })
              : t("editor.recordScreen")}
          </button>
          {activeLayer?.mediaUrl ? (
            <button
              type="button"
              className="btn btn-sm"
              title={t("editor.clearMedia")}
              onClick={() => setMedia(null, "none", null)}
            >
              {t("editor.clearMedia")}
            </button>
          ) : null}
        </div>
        <div className="field">
          <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{t("editor.mediaByUrl")}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="url"
              value={mediaUrlInput}
              placeholder={t("editor.mediaByUrlPlaceholder")}
              aria-label={t("editor.mediaByUrl")}
              disabled={mediaUrlBusy}
              onChange={(e) => setMediaUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleUrlSubmit();
              }}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button type="button" className="btn btn-sm" disabled={mediaUrlBusy} onClick={() => void handleUrlSubmit()}>
              {t("editor.mediaByUrlButton")}
            </button>
          </div>
        </div>
        {mediaUploadError ? (
          <span role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>
            {mediaUploadError}
          </span>
        ) : null}
        {activeLayer && isVideoLayer(activeLayer) && <VideoOptions />}
      </div>
    </Section>
  );
}
