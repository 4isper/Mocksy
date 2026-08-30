"use client";

import { useEffect, type ChangeEvent } from "react";
import type { EditorScene } from "@/lib/types/editor";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { buildTextLayerSvg, isTextLayer } from "@/lib/render/layerText";
import { buildEntranceAnimationCss, buildEntranceKeyframesStyle, type SceneCss } from "@/lib/render/mockupRenderer";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";
import { FrameContent } from "@/components/editor/FrameContent";

interface SingleFrameViewProps {
  scene: EditorScene;
  sceneCss: SceneCss;
  canPan: boolean;
  frameRef: React.RefObject<HTMLDivElement | null>;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  onPanDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPanMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPanUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  analyzeMedia: (el: HTMLImageElement | HTMLVideoElement) => void;
  handleCanvasFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  canvasFileInputKey: number;
  isMediaLoading: boolean;
  setVideoDuration: (duration: number, layerId?: string) => void;
  setVideoCurrentTime: (time: number) => void;
  setMediaLoading: (loading: boolean) => void;
  selectLayer: (id: string) => void;
}

export function SingleFrameView({
  scene,
  sceneCss,
  canPan,
  frameRef,
  videoRef,
  onPanDown,
  onPanMove,
  onPanUp,
  analyzeMedia,
  handleCanvasFile,
  canvasFileInputKey,
  isMediaLoading,
  setVideoDuration,
  setVideoCurrentTime,
  setMediaLoading,
  selectLayer
}: SingleFrameViewProps) {
  const t = useTranslations();
  // Subscribe here (not in PreviewCanvas) so the whole preview tree — all
  // annotations, the watermark and the frame grid — doesn't re-render on every
  // video time tick. The seek mirrors the Timeline scrubber onto the <video>:
  // onTimeUpdate writes the time back to the store, so we only seek when the
  // delta is large enough to be a user scrub rather than playback echo.
  const videoCurrentTime = useEditorStore((s) => s.videoCurrentTime);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (Math.abs(video.currentTime - videoCurrentTime) > 0.1) {
      try {
        video.currentTime = videoCurrentTime;
      } catch {
        // Seeking before metadata is ready can throw; ignore until it loads.
      }
    }
  }, [videoCurrentTime, videoRef]);
  // Mirror the active layer's playback speed onto the preview element (the
  // export pipeline sets it independently on its own detached <video>).
  const activeLayer = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
  const playbackSpeed = Math.max(0.5, Math.min(2, activeLayer?.playbackSpeed ?? 1));
  useEffect(() => {
    const video = videoRef.current;
    if (!video || video.playbackRate === playbackSpeed) return;
    try {
      video.playbackRate = playbackSpeed;
    } catch {
      // Not all engines allow changing the rate before metadata; retried below.
    }
  }, [playbackSpeed, videoRef]);
  return (
    <div
      ref={frameRef}
      style={{
        ...sceneCss.frame,
        zIndex: 1,
        cursor: canPan ? "grab" : undefined,
        touchAction: canPan ? "none" : undefined,
        // Live-preview reflection (Chromium/Safari); exports implement it
        // fully via the canvas pipeline for every browser.
        ...(scene.floorReflection
          ? ({ WebkitBoxReflect: "below 0 linear-gradient(transparent 45%, rgba(255,255,255,0.30))" } as CSSProperties)
          : {})
      }}
      data-mockup-frame
      onPointerDown={onPanDown}
      onPointerMove={onPanMove}
      onPointerUp={onPanUp}
      onPointerCancel={onPanUp}
    >
      <style dangerouslySetInnerHTML={{ __html: buildEntranceKeyframesStyle(scene.layers) }} />
      <FrameContent
        css={sceneCss}
        media={
          scene.layers
            .filter((layer) => !layer.hidden)
            .map((layer) => {
              const entranceStyle = buildEntranceAnimationCss(layer);
              const hasEntrance = layer.entranceAnimation && layer.entranceAnimation !== "none";
              const blendCss = layer.blendMode && layer.blendMode !== "normal" ? { mixBlendMode: layer.blendMode } : {};
              const wrapper: CSSProperties = hasEntrance
                ? { position: "relative", width: "100%", height: "100%", ...entranceStyle }
                : {};
              const wrap = (el: React.ReactNode) =>
                hasEntrance
                  ? <div key={`${layer.id}-${layer.entranceAnimation}`} style={wrapper}>{el}</div>
                  : el;
              return layer.mediaUrl ? (
                isVideoLayer(layer) ? wrap(
                  <video
                    key={layer.id}
                    ref={videoRef}
                    src={layer.mediaUrl}
                    muted={layer.videoMuted}
                    loop={layer.videoLoop}
                    autoPlay={layer.videoAutoplay}
                    playsInline
                    controls
                    crossOrigin="anonymous"
                    data-layer-media={layer.id}
                    style={{ ...sceneCss.mediaStyle, backgroundColor: "var(--panel-solid)", ...blendCss }}
                    onPointerDown={() => selectLayer(layer.id)}
                    onLoadedMetadata={(e) => {
                      const duration = e.currentTarget.duration || 0;
                      setVideoDuration(duration, layer.id);
                      const current = Math.min(layer.videoPosterTime, duration);
                      e.currentTarget.currentTime = current;
                      setVideoCurrentTime(current);
                      e.currentTarget.playbackRate = Math.max(0.5, Math.min(2, layer.playbackSpeed ?? 1));
                    }}
                    onTimeUpdate={(e) => {
                      const t = e.currentTarget.currentTime;
                      if (Math.abs(t - videoCurrentTime) >= 0.1) setVideoCurrentTime(t);
                    }}
                    onLoadedData={(ev) => {
                      setMediaLoading(false);
                      analyzeMedia(ev.currentTarget);
                    }}
                  />
                ) : wrap(
                  <img
                    key={layer.id}
                    src={layer.mediaUrl}
                    alt={t("editor.uploadedMediaAlt")}
                    data-layer-media={layer.id}
                    style={{ ...sceneCss.mediaStyle, ...blendCss }}
                    onPointerDown={() => selectLayer(layer.id)}
                    onLoad={(e) => {
                      setMediaLoading(false);
                      analyzeMedia(e.currentTarget);
                    }}
                  />
                )
              ) : isTextLayer(layer) ? wrap(
                <div
                  key={layer.id}
                  style={sceneCss.textStyle}
                  onPointerDown={() => selectLayer(layer.id)}
                  dangerouslySetInnerHTML={{ __html: buildTextLayerSvg(layer, sceneCss.screenAspect) ?? "" }}
                />
              ) : null;
            })
        }
        emptyMedia={
          scene.layers.every((l) => !l.mediaUrl) && !scene.layers.some(isTextLayer) ? (
            <label style={sceneCss.emptyMediaStyle}>
              <span>{t("editor.dropToStart")}</span>
              <input type="file" accept="image/*,video/*" onChange={handleCanvasFile} key={canvasFileInputKey} style={{ display: "none" }} />
            </label>
          ) : null
        }
      />
      {isMediaLoading ? (
        <div className="media-loading" role="status" aria-busy="true" aria-label={t("editor.loadingMedia")}>
          <span className="spinner" />
        </div>
      ) : null}
    </div>
  );
}
