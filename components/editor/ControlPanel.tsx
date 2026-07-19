"use client";

import type { ChangeEvent } from "react";
import { useEditorStore } from "@/lib/state/editorStore";
import type { AnimationPreset, MockupFrame, StylePreset } from "@/lib/types/editor";
import { FRAME_ORDER } from "@/lib/render/frames";

const frames: MockupFrame[] = FRAME_ORDER;
const styles: StylePreset[] = ["default", "glassLight", "glassDark", "outline"];
const animations: AnimationPreset[] = ["none", "zoomIn", "zoomOut", "parallax"];
const aspectRatios = ["16 / 9", "4 / 3", "3 / 2", "1 / 1", "9 / 16"];
const videoExt = /\.(mp4|mov|m4v|webm|ogg|ogv|avi|mkv)$/i;

function detectMediaType(file: File): "video" | "image" {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.includes("mp4") || file.type.includes("quicktime") || file.type.includes("webm")) return "video";
  if (videoExt.test(file.name)) return "video";
  return "image";
}

export function ControlPanel() {
  const {
    scene,
    setMedia,
    setFrame,
    setStylePreset,
    setAnimationPreset,
    setZoom,
    setShadowOpacity,
    setBorderRadius,
    setBackgroundSolid,
    setBackgroundGradient,
    toggleWatermark,
    setWatermarkText,
    setAspectRatio,
    setVideoMuted,
    setVideoLoop,
    setVideoAutoplay,
    setVideoPosterTime,
    setVideoCurrentTime,
    setVideoTrimStart,
    setVideoTrimEnd
  } = useEditorStore();

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const mediaType = detectMediaType(file);
    setMedia(URL.createObjectURL(file), mediaType, file.name);
  };

  return (
    <div className="panel" style={{ padding: 16, display: "grid", gap: 12 }}>
      <label>
        Media
        <input type="file" accept="image/*,video/*" onChange={handleFile} />
      </label>
      {scene.mediaType === "video" && (
        <>
          <label>
            Video muted
            <input type="checkbox" checked={scene.videoMuted} onChange={(e) => setVideoMuted(e.target.checked)} />
          </label>
          <label>
            Video loop
            <input type="checkbox" checked={scene.videoLoop} onChange={(e) => setVideoLoop(e.target.checked)} />
          </label>
          <label>
            Video autoplay
            <input type="checkbox" checked={scene.videoAutoplay} onChange={(e) => setVideoAutoplay(e.target.checked)} />
          </label>
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
          <label>
            Trim start
            <input
              type="range"
              min={0}
              max={Math.max(scene.videoDuration, 0.1)}
              step={0.01}
              value={scene.videoTrimStart}
              onChange={(e) => setVideoTrimStart(Number(e.target.value))}
            />
          </label>
          <label>
            Trim end
            <input
              type="range"
              min={0}
              max={Math.max(scene.videoDuration, 0.1)}
              step={0.01}
              value={scene.videoTrimEnd || scene.videoDuration}
              onChange={(e) => setVideoTrimEnd(Number(e.target.value))}
            />
          </label>
        </>
      )}
      <label>
        Frame
        <select value={scene.frame} onChange={(e) => setFrame(e.target.value as MockupFrame)}>
          {frames.map((frame) => (
            <option key={frame} value={frame}>
              {frame}
            </option>
          ))}
        </select>
      </label>
      <label>
        Aspect ratio
        <select value={scene.aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
          {aspectRatios.map((ratio) => (
            <option key={ratio} value={ratio}>
              {ratio}
            </option>
          ))}
        </select>
      </label>
      <label>
        Style
        <select value={scene.stylePreset} onChange={(e) => setStylePreset(e.target.value as StylePreset)}>
          {styles.map((style) => (
            <option key={style} value={style}>
              {style}
            </option>
          ))}
        </select>
      </label>
      <label>
        Animation
        <select value={scene.animationPreset} onChange={(e) => setAnimationPreset(e.target.value as AnimationPreset)}>
          {animations.map((anim) => (
            <option key={anim} value={anim}>
              {anim}
            </option>
          ))}
        </select>
      </label>
      <label>
        Zoom
        <input type="range" min={0.8} max={1.5} step={0.01} value={scene.zoom} onChange={(e) => setZoom(Number(e.target.value))} />
      </label>
      <label>
        Shadow
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={scene.shadowOpacity}
          onChange={(e) => setShadowOpacity(Number(e.target.value))}
        />
      </label>
      <label>
        Radius
        <input type="range" min={0} max={48} step={1} value={scene.borderRadius} onChange={(e) => setBorderRadius(Number(e.target.value))} />
      </label>
      <div style={{ display: "grid", gap: 8 }}>
        <span>Background</span>
        <button onClick={() => setBackgroundSolid("#09090b")} type="button">
          Solid
        </button>
        <button onClick={() => setBackgroundGradient("#1d4ed8", "#7c3aed")} type="button">
          Gradient
        </button>
      </div>
      <label>
        Watermark
        <input type="checkbox" checked={scene.watermarkEnabled} onChange={(e) => toggleWatermark(e.target.checked)} />
      </label>
      <label>
        Watermark text
        <input value={scene.watermarkText} onChange={(e) => setWatermarkText(e.target.value)} />
      </label>
    </div>
  );
}
