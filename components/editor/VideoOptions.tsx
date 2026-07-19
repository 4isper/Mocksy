"use client";

import { useState } from "react";
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
    setVideoCurrentTime
  } = useEditorStore();

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
            <input type="checkbox" checked={scene.videoMuted} onChange={(e) => setVideoMuted(e.target.checked)} />
            <span className="track" aria-hidden="true" />
            <span>Muted</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={scene.videoLoop} onChange={(e) => setVideoLoop(e.target.checked)} />
            <span className="track" aria-hidden="true" />
            <span>Loop</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={scene.videoAutoplay} onChange={(e) => setVideoAutoplay(e.target.checked)} />
            <span className="track" aria-hidden="true" />
            <span>Autoplay</span>
          </label>
          <label className="field">
            <span>Poster time</span>
            <input
              className="range"
              type="range"
              min={0}
              max={Math.max(scene.videoDuration, 0.1)}
              step={0.1}
              value={scene.videoPosterTime}
              onChange={(e) => setVideoPosterTime(Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>Timeline</span>
            <input
              className="range"
              type="range"
              min={0}
              max={Math.max(scene.videoDuration, 0.1)}
              step={0.01}
              value={scene.videoCurrentTime}
              onChange={(e) => setVideoCurrentTime(Number(e.target.value))}
            />
          </label>
          <VideoTrimControl duration={scene.videoDuration} />
        </div>
      ) : null}
    </div>
  );
}
