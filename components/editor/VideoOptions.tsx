"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";
import { useEditorStore } from "@/lib/state/editorStore";
import { VideoTrimControl } from "@/components/editor/VideoTrimControl";

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
    setVideoQuality
  } = useEditorStore();
  const videoCurrentTime = useEditorStore((s) => s.videoCurrentTime);
  const activeLayer = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
  if (!activeLayer) return null;

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
        </div>
      ) : null}
    </div>
  );
}
