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

  const toggle = (label: string, checked: boolean, onChange: (value: boolean) => void) => (
    <label>
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );

  return (
    <div style={{ display: "grid", gap: 8, borderTop: "1px solid #27272a", paddingTop: 8 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "transparent",
          border: "none",
          color: "#f4f4f5",
          cursor: "pointer",
          padding: 0,
          fontSize: 14,
          fontWeight: 600
        }}
      >
        <span>Video options</span>
        <span aria-hidden style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}>
          ▾
        </span>
      </button>
      {open ? (
        <div style={{ display: "grid", gap: 12 }}>
          {toggle("Muted", scene.videoMuted, setVideoMuted)}
          {toggle("Loop", scene.videoLoop, setVideoLoop)}
          {toggle("Autoplay", scene.videoAutoplay, setVideoAutoplay)}
          <label>
            Poster time
            <input
              type="range"
              min={0}
              max={Math.max(scene.videoDuration, 0.1)}
              step={0.1}
              value={scene.videoPosterTime}
              onChange={(e) => setVideoPosterTime(Number(e.target.value))}
            />
          </label>
          <label>
            Timeline
            <input
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
