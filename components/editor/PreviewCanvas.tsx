"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent, ReactNode } from "react";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";
import { buildSceneCss } from "@/lib/render/mockupRenderer";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { sampleVideoTransform } from "@/lib/render/videoComposer";
import { loadMediaFromFile, UnsupportedMediaError } from "@/lib/media/loadFile";
import { useEditorStore } from "@/lib/state/editorStore";

/** Duration of one animation loop in the preview, matching the video export. */
const ANIMATION_DURATION_MS = 3000;

/**
 * Wraps a single media layer and drives its zoomIn/zoomOut/parallax in the
 * live preview by writing the transform straight to the DOM via rAF — no React
 * re-render per frame, and buildSceneCss (the expensive part) is untouched.
 * The sampled transform mirrors sampleVideoTransform used by the video export,
 * so what you see previews what you export.
 */
function LayerAnimation({ layer, children }: { layer: MediaLayer; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Keep the latest layer in a ref so the rAF loop always samples fresh zoom/
  // pan values without re-seeding the loop on every slider tick.
  const layerRef = useRef(layer);
  layerRef.current = layer;
  const animates = layer.animationPreset !== "none";

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!animates) {
      const base = sampleVideoTransform(layerRef.current, 0);
      node.style.transform = `scale(${base.zoom}) translate(${base.x * 2}px, ${base.y * 2}px)`;
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const progress = ((performance.now() - start) % ANIMATION_DURATION_MS) / ANIMATION_DURATION_MS;
      const { zoom, x, y } = sampleVideoTransform(layerRef.current, progress);
      node.style.transform = `scale(${zoom}) translate(${x * 2}px, ${y * 2}px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Re-seed the loop when the preset, zoom, or pan actually changes so the
    // static (non-animated) branch re-applies its transform to the DOM.
  }, [animates, layer.animationPreset, layer.zoom, layer.mediaOffsetX, layer.mediaOffsetY]);

  return (
    <div
      ref={ref}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transformOrigin: "center",
        willChange: "transform"
      }}
    >
      {children}
    </div>
  );
}

interface PreviewCanvasProps {
  scene: EditorScene;
}

export function PreviewCanvas({ scene }: PreviewCanvasProps) {
  const sceneCss = useMemo(() => buildSceneCss(scene), [scene]);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const setMedia = useEditorStore((s) => s.setMedia);
  const addLayer = useEditorStore((s) => s.addLayer);
  const removeLayer = useEditorStore((s) => s.removeLayer);
  const setVideoDuration = useEditorStore((s) => s.setVideoDuration);
  const setVideoCurrentTime = useEditorStore((s) => s.setVideoCurrentTime);
  const videoCurrentTime = useEditorStore((s) => s.videoCurrentTime);
  const isMediaLoading = useEditorStore((s) => s.isMediaLoading);
  const setMediaLoading = useEditorStore((s) => s.setMediaLoading);
  const activeLayer = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
  const useVideo = activeLayer ? isVideoLayer(activeLayer) : false;

  // Pinch-to-zoom on touch devices: track the two-finger distance and map it
  // to the active layer zoom so mobile users can scale the mockup without a slider.
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && activeLayer) {
      const a = e.touches[0];
      const b = e.touches[1];
      if (!a || !b) return;
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      pinchStart.current = { dist: Math.hypot(dx, dy), zoom: activeLayer.zoom };
    }
  };
  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 2 || !pinchStart.current || !activeLayer) return;
    e.preventDefault();
    const a = e.touches[0];
    const b = e.touches[1];
    if (!a || !b) return;
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    const dist = Math.hypot(dx, dy);
    const next = Math.min(1.5, Math.max(0.8, pinchStart.current.zoom * (dist / pinchStart.current.dist)));
    useEditorStore.getState().setZoom(next);
  };
  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) pinchStart.current = null;
  };

  useEffect(() => {
    if (!useVideo) return;
    // Sync the playback scrubber to the active video layer when it changes.
  }, [useVideo, videoCurrentTime, activeLayer?.id]);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    try {
      const { url, mediaType, mediaName } = loadMediaFromFile(file);
      setDropError(null);
      // Drop adds a new layer on top of the stack.
      addLayer(url, mediaType, mediaName);
    } catch (err) {
      setDropError(err instanceof UnsupportedMediaError ? err.message : "Could not load that file.");
    }
  };

  const [arW, arH] = scene.aspectRatio.split("/").map((n) => Number(n.trim()));

  return (
    <div
      className="panel"
      style={{
        height: "100%",
        minHeight: 0,
        padding: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Establish a size container so the canvas can size itself with
        // container query units, fitting inside both axes without distortion.
        containerType: "size",
        ["--canvas-ar-w" as string]: arW,
        ["--canvas-ar-h" as string]: arH,
        // Let the component own pinch gestures instead of the browser zooming
        // the whole page when two fingers land on the preview.
        touchAction: "none",
        outline: isDragging ? "2px dashed #00d9ff" : "2px dashed transparent"
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setIsDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) setIsDragging(false);
      }}
      onDrop={handleDrop}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        id="preview-canvas"
        style={{
          // Contain inside the size container: take the larger of the two
          // axes that still fits the other, so the canvas keeps its aspect
          // ratio instead of being stretched by a fixed 100% width.
          width: "min(100cqw, calc(100cqh * var(--canvas-ar-w) / var(--canvas-ar-h)))",
          height: "min(100cqh, calc(100cqw * var(--canvas-ar-h) / var(--canvas-ar-w)))",
          aspectRatio: scene.aspectRatio,
          position: "relative",
          borderRadius: 12,
          ...sceneCss.container
        }}
      >
        <div style={sceneCss.frame} data-mockup-frame>
          {scene.layers.map((layer) =>
            layer.mediaUrl ? (
              <LayerAnimation key={layer.id} layer={layer}>
                {isVideoLayer(layer) ? (
                  <video
                    src={layer.mediaUrl}
                    muted={layer.videoMuted}
                    loop={layer.videoLoop}
                    autoPlay={layer.videoAutoplay}
                    playsInline
                    controls
                    onLoadedMetadata={(e) => {
                      const duration = e.currentTarget.duration || 0;
                      setVideoDuration(duration);
                      const current = Math.min(layer.videoPosterTime, duration);
                      e.currentTarget.currentTime = current;
                      setVideoCurrentTime(current);
                    }}
                    onTimeUpdate={(e) => {
                      // Throttle store writes to ~10fps: playback scrubbing doesn't
                      // need per-frame precision and the store update re-renders
                      // every component subscribed to videoCurrentTime.
                      const t = e.currentTarget.currentTime;
                      if (Math.abs(t - videoCurrentTime) >= 0.1) setVideoCurrentTime(t);
                    }}
                    onLoadedData={() => setMediaLoading(false)}
                    style={sceneCss.mediaStyle}
                  />
                ) : (
                  // Local blob/object URLs can't be optimized by next/image.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={layer.mediaUrl}
                    alt="Uploaded media"
                    style={sceneCss.mediaStyle}
                    onLoad={() => setMediaLoading(false)}
                  />
                )}
              </LayerAnimation>
            ) : null
          )}
          {scene.layers.every((l) => !l.mediaUrl) ? (
            <div style={sceneCss.emptyMediaStyle}>Drop image or video to start</div>
          ) : null}
          {sceneCss.frameOverlay && (
            // Local static SVG device skins served from /public. The overlay sits
            // above the media but its screen cutout is transparent, so the media
            // (inset to the same cutout) shows through.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sceneCss.frameOverlay}
              alt=""
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                ...sceneCss.overlayStyle
              }}
            />
          )}
          {isMediaLoading ? (
            <div className="media-loading" role="status" aria-busy="true" aria-label="Loading media">
              <span className="spinner" />
            </div>
          ) : null}
        </div>
        {scene.watermarkEnabled && (
          <span
            className="preview-watermark"
            style={{
              ...(scene.watermarkPosition === "bottom-left" || scene.watermarkPosition === "top-left"
                ? { left: 16 }
                : { right: 16 }),
              ...(scene.watermarkPosition === "top-left" || scene.watermarkPosition === "top-right"
                ? { top: 16 }
                : { bottom: 16 }),
              fontSize: scene.watermarkSize
            }}
          >
            {scene.watermarkText}
          </span>
        )}
        {activeLayer ? (
          <button type="button" className="preview-chip" onClick={() => removeLayer(activeLayer.id)}>
            Clear media
          </button>
        ) : null}
        {dropError ? (
          <div role="alert" className="preview-error">
            {dropError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
