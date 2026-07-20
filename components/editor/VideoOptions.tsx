"use client";

import { useState } from "react";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";
import { useEditorStore } from "@/lib/state/editorStore";
import { VideoTrimControl } from "@/components/editor/VideoTrimControl";

export function VideoOptions() {
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
        <span>Video options</span>
        <span aria-hidden className="accordion-chevron">
          ▾
        </span>
      </button>
      {open ? (
        <div className="field-group">
          <label className="toggle">
            <input type="checkbox" checked={activeLayer.videoMuted} onChange={(e) => setVideoMuted(e.target.checked)} />
            <span className="track" aria-hidden="true" />
            <span>Muted</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={activeLayer.videoLoop} onChange={(e) => setVideoLoop(e.target.checked)} />
            <span className="track" aria-hidden="true" />
            <span>Loop</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={activeLayer.videoAutoplay} onChange={(e) => setVideoAutoplay(e.target.checked)} />
            <span className="track" aria-hidden="true" />
            <span>Autoplay</span>
          </label>
          <label className="field">
            <span>Poster time</span>
            <input
              className="range"
              type="range"
              min={0}
              max={Math.max(activeLayer.videoDuration, 0.1)}
              step={0.1}
              value={activeLayer.videoPosterTime}
              aria-label="Poster time"
              aria-valuetext={`${activeLayer.videoPosterTime.toFixed(1)} seconds`}
              onChange={(e) => setVideoPosterTime(Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>Timeline</span>
            <input
              className="range"
              type="range"
              min={0}
              max={Math.max(activeLayer.videoDuration, 0.1)}
              step={0.01}
              value={videoCurrentTime}
              aria-label="Playback position"
              aria-valuetext={`${videoCurrentTime.toFixed(2)} seconds`}
              onChange={(e) => setVideoCurrentTime(Number(e.target.value))}
            />
          </label>
          <VideoTrimControl duration={activeLayer.videoDuration} />
          <label className="field">
            <span>Export quality</span>
            <select
              className="select"
              value={activeLayer.videoQuality}
              onChange={(e) => setVideoQuality(e.target.value as MediaLayer["videoQuality"])}
            >
              <option value="low">Low (smaller file)</option>
              <option value="medium">Medium</option>
              <option value="high">High (best detail)</option>
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}
