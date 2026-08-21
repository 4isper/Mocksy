"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";
import { useEditorStore } from "@/lib/state/editorStore";
import { VideoTrimControl } from "@/components/editor/VideoTrimControl";
import { isAudioFile, blobToDataUrl } from "@/lib/media/loadFile";

export function VideoOptions() {
  const t = useTranslations();
  const [open, setOpen] = useState(true);
  const {
    scene,
    setVideoMuted,
    setVideoLoop,
    setVideoAutoplay,
    setVideoPosterTime,
    setVideoCurrentTime,
    setVideoQuality,
    setPlaybackSpeed,
    setBackgroundAudio,
    clearBackgroundAudio,
    setAudioFadeIn,
    setAudioFadeOut
  } = useEditorStore(
    useShallow((s) => ({
      scene: s.scene,
      setVideoMuted: s.setVideoMuted,
      setVideoLoop: s.setVideoLoop,
      setVideoAutoplay: s.setVideoAutoplay,
      setVideoPosterTime: s.setVideoPosterTime,
      setVideoCurrentTime: s.setVideoCurrentTime,
      setVideoQuality: s.setVideoQuality,
      setPlaybackSpeed: s.setPlaybackSpeed,
      setBackgroundAudio: s.setBackgroundAudio,
      clearBackgroundAudio: s.clearBackgroundAudio,
      setAudioFadeIn: s.setAudioFadeIn,
      setAudioFadeOut: s.setAudioFadeOut
    }))
  );
  const videoCurrentTime = useEditorStore((s) => s.videoCurrentTime);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const activeLayer = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
  if (!activeLayer || activeLayer.mediaType !== "video") return null;

  async function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !isAudioFile(file)) return;
    const url = await blobToDataUrl(file);
    setBackgroundAudio(url, file.name);
  }

  return (
    <div className="field-group video-options">
      <button
        type="button"
        className="accordion-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{t("video.options")}</span>
        <span aria-hidden className="accordion-chevron">
          ▾
        </span>
      </button>
      {open ? (
        <div className="field-group">
          <label className="toggle">
            <input type="checkbox" checked={activeLayer.videoMuted} onChange={(e) => setVideoMuted(e.target.checked)} />
            <span className="track" aria-hidden="true" />
            <span>{t("video.muted")}</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={activeLayer.videoLoop} onChange={(e) => setVideoLoop(e.target.checked)} />
            <span className="track" aria-hidden="true" />
            <span>{t("video.loop")}</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={activeLayer.videoAutoplay} onChange={(e) => setVideoAutoplay(e.target.checked)} />
            <span className="track" aria-hidden="true" />
            <span>{t("video.autoplay")}</span>
          </label>
          <label className="field">
            <span>{t("video.posterTime")}</span>
            <input
              className="range"
              type="range"
              min={0}
              max={Math.max(activeLayer.videoDuration, 0.1)}
              step={0.1}
              value={activeLayer.videoPosterTime}
              aria-label={t("video.posterTime")}
              aria-valuetext={`${activeLayer.videoPosterTime.toFixed(1)} seconds`}
              onChange={(e) => setVideoPosterTime(Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>{t("video.timeline")}</span>
            <input
              className="range"
              type="range"
              min={0}
              max={Math.max(activeLayer.videoDuration, 0.1)}
              step={0.01}
              value={videoCurrentTime}
              aria-label={t("video.playbackPosition")}
              aria-valuetext={`${videoCurrentTime.toFixed(2)} seconds`}
              onChange={(e) => setVideoCurrentTime(Number(e.target.value))}
            />
          </label>
          <VideoTrimControl duration={activeLayer.videoDuration} />
          <label className="field">
            <span>{t("video.speed", { val: Math.max(0.5, Math.min(2, activeLayer.playbackSpeed ?? 1)) })}</span>
            <input
              className="range"
              type="range"
              min={0.5}
              max={2}
              step={0.25}
              value={Math.max(0.5, Math.min(2, activeLayer.playbackSpeed ?? 1))}
              aria-label={t("video.speed", { val: Math.max(0.5, Math.min(2, activeLayer.playbackSpeed ?? 1)) })}
              aria-valuetext={`${Math.max(0.5, Math.min(2, activeLayer.playbackSpeed ?? 1))}x`}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>{t("video.exportQuality")}</span>
            <select
              className="select"
              value={activeLayer.videoQuality}
              onChange={(e) => setVideoQuality(e.target.value as MediaLayer["videoQuality"])}
            >
              <option value="low">{t("video.qualityLow")}</option>
              <option value="medium">{t("video.qualityMedium")}</option>
              <option value="high">{t("video.qualityHigh")}</option>
            </select>
          </label>
          <div className="field-group">
            <span className="field-label">{t("video.backgroundAudio")}</span>
            {scene.backgroundAudioUrl ? (
              <div className="audio-info">
                <span className="audio-name">{scene.backgroundAudioName}</span>
                <button type="button" className="btn btn-sm" onClick={clearBackgroundAudio}>
                  {t("video.removeAudio")}
                </button>
              </div>
            ) : (
              <label className="btn btn-sm upload-audio-btn">
                {t("video.uploadAudio")}
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg,.aac,.flac,.m4a"
                  className="hidden"
                  onChange={handleAudioUpload}
                />
              </label>
            )}
            {scene.backgroundAudioUrl ? (
              <>
                <label className="field">
                  <span>{t("video.audioFadeIn", { val: scene.audioFadeIn ?? 0 })}</span>
                  <input
                    className="range"
                    type="range"
                    min={0}
                    max={10}
                    step={0.5}
                    value={scene.audioFadeIn ?? 0}
                    aria-label={t("video.audioFadeIn", { val: scene.audioFadeIn ?? 0 })}
                    aria-valuetext={`${scene.audioFadeIn ?? 0} seconds`}
                    onChange={(e) => setAudioFadeIn(Number(e.target.value))}
                  />
                </label>
                <label className="field">
                  <span>{t("video.audioFadeOut", { val: scene.audioFadeOut ?? 0 })}</span>
                  <input
                    className="range"
                    type="range"
                    min={0}
                    max={10}
                    step={0.5}
                    value={scene.audioFadeOut ?? 0}
                    aria-label={t("video.audioFadeOut", { val: scene.audioFadeOut ?? 0 })}
                    aria-valuetext={`${scene.audioFadeOut ?? 0} seconds`}
                    onChange={(e) => setAudioFadeOut(Number(e.target.value))}
                  />
                </label>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
