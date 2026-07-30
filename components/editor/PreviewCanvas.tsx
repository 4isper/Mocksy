"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import type { EditorScene } from "@/lib/types/editor";
import { buildSceneCss } from "@/lib/render/mockupRenderer";
import { loadMediaFromFile, UnsupportedMediaError } from "@/lib/media/loadFile";
import { extractPalette, mergeWeightedPalettes, paletteColorsFlat } from "@/lib/media/palette";
import type { PaletteResult } from "@/lib/media/palette";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";
import { useFrameTransform } from "@/lib/hooks/useFrameTransform";
import { AnnotationItem } from "@/components/editor/AnnotationItem";
import { useScenePalette } from "@/lib/hooks/useScenePalette";
import { FrameInstanceGrid } from "@/components/editor/FrameInstanceGrid";
import { SingleFrameView } from "@/components/editor/SingleFrameView";

/** Duration of one animation loop in the preview, matching the video export. */
const ANIMATION_DURATION_MS = 3000;

interface PreviewCanvasProps {
  scene: EditorScene;
}

export function PreviewCanvas({ scene }: PreviewCanvasProps) {
  const t = useTranslations();
  const sceneCss = useMemo(() => buildSceneCss(scene), [scene]);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [canvasFileInputKey, setCanvasFileInputKey] = useState(0);
  const setMedia = useEditorStore((s) => s.setMedia);
  const addLayer = useEditorStore((s) => s.addLayer);
  const setVideoDuration = useEditorStore((s) => s.setVideoDuration);
  const setVideoCurrentTime = useEditorStore((s) => s.setVideoCurrentTime);
  const videoCurrentTime = useEditorStore((s) => s.videoCurrentTime);
  const isMediaLoading = useEditorStore((s) => s.isMediaLoading);
  const setMediaLoading = useEditorStore((s) => s.setMediaLoading);
  const setScenePalette = useEditorStore((s) => s.setScenePalette);
  const selectedAnnotationId = useEditorStore((s) => s.selectedAnnotationId);
  const selectAnnotation = useEditorStore((s) => s.selectAnnotation);
  const updateAnnotation = useEditorStore((s) => s.updateAnnotation);
  const activeFrameInstanceId = useEditorStore((s) => s.activeFrameInstanceId);
  const selectFrameInstance = useEditorStore((s) => s.selectFrameInstance);

  // Cache palette results per media URL so we don't re-analyse the same media
  // when it appears in multiple frame instances or across layer switches.
  const paletteCacheRef = useRef(new Map<string, PaletteResult>());

  // Recompute a merged palette from all visible media, applying area-based
  // weighting in multi-frame mode. Stores a flat hex string array for the
  // store (compatible with pickGradientPair / ControlPanel).
  const computeMergedPalette = useCallback(() => {
    const isMultiFrame = scene.frameInstances.length > 0;
    if (!isMultiFrame) {
      // Single-frame mode: use the active layer's media palette.
      const active = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
      const cached = active?.mediaUrl ? paletteCacheRef.current.get(active.mediaUrl) : null;
      setScenePalette(cached ? paletteColorsFlat(cached) : null);
      return;
    }
    // Multi-frame mode: collect cached palettes from all visible frame
    // instances and merge them weighted by on-screen area (scale²).
    const inputs: { colors: PaletteResult["colors"]; average: string; weight: number }[] = [];
    for (const inst of scene.frameInstances) {
      const layer = scene.layers.find((l) => l.id === inst.layerId);
      if (!layer || layer.hidden || !layer.mediaUrl) continue;
      const cached = paletteCacheRef.current.get(layer.mediaUrl);
      if (!cached) continue;
      inputs.push({ colors: cached.colors, average: cached.average, weight: inst.scale * inst.scale });
    }
    if (inputs.length === 0) {
      setScenePalette(null);
      return;
    }
    const merged = mergeWeightedPalettes(inputs);
    setScenePalette(merged.colors.length > 0 ? paletteColorsFlat(merged) : null);
  }, [scene, setScenePalette]);

  // Extract palette from a loaded media element, cache by its src URL, then
  // recompute the merged palette for the current scene mode.
  const analyzeMedia = (el: HTMLImageElement | HTMLVideoElement) => {
    const src = (el as HTMLImageElement).currentSrc || (el as HTMLVideoElement).currentSrc || (el as HTMLVideoElement).src;
    if (!src) return;
    try {
      const result = extractPalette(el, 5);
      paletteCacheRef.current.set(src, result);
    } catch {
      paletteCacheRef.current.delete(src);
    }
    computeMergedPalette();
  };

  // When the active layer changes in single-frame mode, try to re-extract the
  // palette from the DOM element (onLoad won't re-fire for a cached image).
  useEffect(() => {
    const isMultiFrame = scene.frameInstances.length > 0;
    if (isMultiFrame) return;
    const frame = document.querySelector<HTMLElement>("[data-mockup-frame]");
    if (!frame) return;
    const el = frame.querySelector<HTMLImageElement | HTMLVideoElement>("img, video");
    if (!el) {
      // If no element is rendered but the active layer has a cached palette,
      // use that rather than clearing — makes layer switches instant.
      const active = scene.layers.find((l) => l.id === scene.activeLayerId);
      if (active?.mediaUrl && paletteCacheRef.current.has(active.mediaUrl)) {
        computeMergedPalette();
        return;
      }
      setScenePalette(null);
      return;
    }
    const ready = el instanceof HTMLVideoElement ? el.readyState >= 2 : el.complete && el.naturalWidth > 0;
    if (ready) analyzeMedia(el);
    else computeMergedPalette();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.activeLayerId]);

  // Recompute the merged palette whenever visible frame instances or layer
  // media/hidden state changes (e.g. adding/removing a frame instance,
  // toggling visibility, replacing a layer's media).
  useEffect(() => {
    computeMergedPalette();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.frameInstances, scene.layers.map((l) => (l.mediaUrl ?? "") + l.hidden).join("|")]);
  const activeLayer = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
  const frameInstanceCssMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildSceneCss>>();
    for (const inst of scene.frameInstances) {
      const layer = scene.layers.find((l) => l.id === inst.layerId) ?? activeLayer;
      map.set(inst.id, buildSceneCss({ ...scene, frame: inst.frame, layers: layer ? [layer] : [] }));
    }
    return map;
  }, [scene, activeLayer]);

  // The whole-mockup zoom/animation is applied to the frame container so the
  // device skin and media scale together, matching the export.
   const frameRef = useRef<HTMLDivElement>(null);
   const videoRef = useRef<HTMLVideoElement | null>(null);
   const canvasRef = useRef<HTMLDivElement>(null);
   useFrameTransform(frameRef, activeLayer);

  // Mirror the Timeline scrubber (driven by VideoOptions) onto the actual
  // <video>. The onTimeUpdate handler also writes videoCurrentTime back to the
  // store, so we only seek when the change is large enough to be a user scrub
  // rather than playback echo — otherwise we'd fight the playing video.
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
  }, [videoCurrentTime]);

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

  // Drag-to-pan the active media inside the frame, mirroring the Position
  // X/Y sliders. Pointer events cover mouse and single-finger touch; a
  // two-finger touch is claimed by the pinch-zoom handler instead. The
  // frame's offsetWidth is its untransformed layout size, so the delta
  // maps cleanly onto the CSS object-position basis the sliders drive.
  const panState = useRef<{ x: number; y: number; offX: number; offY: number } | null>(null);
  const canPan = !!activeLayer?.mediaUrl;
  const onPanDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Let the Clear button and watermark keep their own click behavior.
    if (target.closest("button") || target.closest(".preview-watermark")) return;
    if (!activeLayer?.mediaUrl) return;
    panState.current = {
      x: e.clientX,
      y: e.clientY,
      offX: activeLayer.mediaOffsetX,
      offY: activeLayer.mediaOffsetY
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPanMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = panState.current;
    const el = frameRef.current;
    if (!s || !el) return;
    const w = el.offsetWidth || 1;
    const h = el.offsetHeight || 1;
    const nx = Math.max(-1, Math.min(1, s.offX + ((e.clientX - s.x) / w) * 2));
    const ny = Math.max(-1, Math.min(1, s.offY + ((e.clientY - s.y) / h) * 2));
    const st = useEditorStore.getState();
    st.setMediaOffsetX(nx);
    st.setMediaOffsetY(ny);
  };
  const onPanUp = (e: React.PointerEvent<HTMLDivElement>) => {
    panState.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    try {
      const { url, mediaType, mediaName } = await loadMediaFromFile(file);
      setDropError(null);
      // Drop adds a new layer on top of the stack.
      addLayer(url, mediaType, mediaName);
    } catch (err) {
      setDropError(err instanceof UnsupportedMediaError ? err.message : t("editor.uploadError"));
    }
  };

  const handleCanvasFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const { url, mediaType, mediaName } = await loadMediaFromFile(file);
      setDropError(null);
      addLayer(url, mediaType, mediaName);
    } catch (err) {
      setDropError(err instanceof UnsupportedMediaError ? err.message : t("editor.uploadError"));
    } finally {
      setCanvasFileInputKey((k) => k + 1);
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
        ref={canvasRef}
        onPointerDown={() => selectAnnotation(null)}
        style={{
          // Contain inside the size container: take the larger of the two
          // axes that still fits the other, so the canvas keeps its aspect
          // ratio instead of being stretched by a fixed 100% width.
          width: "min(100cqw, calc(100cqh * var(--canvas-ar-w) / var(--canvas-ar-h)))",
          height: "min(100cqh, calc(100cqw * var(--canvas-ar-h) / var(--canvas-ar-w)))",
          aspectRatio: scene.aspectRatio,
          position: "relative",
          borderRadius: 12,
          overflow: "hidden",
          ...sceneCss.container
        }}
      >
        {sceneCss.backgroundImage ? (
          <div
            data-bg
            aria-hidden
            style={{
              position: "absolute",
              inset: -(sceneCss.backgroundBlur + 6),
              zIndex: 0,
              backgroundImage: `url("${sceneCss.backgroundImage}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: sceneCss.backgroundBlur > 0 ? `blur(${sceneCss.backgroundBlur}px)` : undefined,
              pointerEvents: "none"
            }}
          />
        ) : null}
        {scene.frameInstances.length > 0 ? (
          <FrameInstanceGrid
            scene={scene}
            activeLayer={activeLayer}
            frameInstanceCssMap={frameInstanceCssMap}
            activeFrameInstanceId={activeFrameInstanceId}
            selectFrameInstance={selectFrameInstance}
            analyzeMedia={analyzeMedia}
          />
        ) : (
          <SingleFrameView
            scene={scene}
            sceneCss={sceneCss}
            canPan={canPan}
            frameRef={frameRef}
            videoRef={videoRef}
            onPanDown={onPanDown}
            onPanMove={onPanMove}
            onPanUp={onPanUp}
            analyzeMedia={analyzeMedia}
            handleCanvasFile={handleCanvasFile}
            canvasFileInputKey={canvasFileInputKey}
            isMediaLoading={isMediaLoading}
            setVideoDuration={setVideoDuration}
            setVideoCurrentTime={setVideoCurrentTime}
            setMediaLoading={setMediaLoading}
            videoCurrentTime={videoCurrentTime}
          />
        )}
        {scene.annotations.map((a) => (
          <AnnotationItem
            key={a.id}
            annotation={a}
            selected={a.id === selectedAnnotationId}
            canvasRef={canvasRef}
            onSelect={selectAnnotation}
            onUpdate={updateAnnotation}
          />
        ))}
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
        <label className="preview-chip" style={{ top: 8 }}>
          <span>{t("editor.uploadMedia")}</span>
          <input type="file" accept="image/*,video/*" onChange={handleCanvasFile} key={canvasFileInputKey} style={{ display: "none" }} />
        </label>
        {activeLayer?.mediaUrl ? (
          <button type="button" className="preview-chip" style={{ top: 40 }} onClick={() => setMedia(null, "none", null)}>
            {t("editor.clearMedia")}
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
