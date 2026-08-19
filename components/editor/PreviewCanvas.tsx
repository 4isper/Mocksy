"use client";

import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import type { EditorScene } from "@/lib/types/editor";
import { buildSceneCss } from "@/lib/render/mockupRenderer";
import { GRID_DIVISION_OPTIONS } from "@/lib/render/grid";
import { loadMediaFromFile, UnsupportedMediaError } from "@/lib/media/loadFile";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";
import { Check } from "lucide-react";
import { useFrameTransform } from "@/lib/hooks/useFrameTransform";
import { tiltCss } from "@/lib/render/tilt";
import { useScenePalette } from "@/lib/hooks/useScenePalette";
import { AnnotationItem } from "@/components/editor/AnnotationItem";
import { FrameInstanceGrid } from "@/components/editor/FrameInstanceGrid";
import { SingleFrameView } from "@/components/editor/SingleFrameView";

interface PreviewCanvasProps {
  scene: EditorScene;
}

export function PreviewCanvas({ scene }: PreviewCanvasProps) {
  const t = useTranslations();
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const sceneCss = useMemo(() => buildSceneCss(scene, activeLayerId), [scene, activeLayerId]);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [canvasFileInputKey, setCanvasFileInputKey] = useState(0);
  const setMedia = useEditorStore((s) => s.setMedia);
  const setVideoDuration = useEditorStore((s) => s.setVideoDuration);
  const setVideoCurrentTime = useEditorStore((s) => s.setVideoCurrentTime);
  const isMediaLoading = useEditorStore((s) => s.isMediaLoading);
  const setMediaLoading = useEditorStore((s) => s.setMediaLoading);
  const mediaUploadError = useEditorStore((s) => s.mediaUploadError);
  const setMediaUploadError = useEditorStore((s) => s.setMediaUploadError);
  const selectedAnnotationId = useEditorStore((s) => s.selectedAnnotationId);
  const selectAnnotation = useEditorStore((s) => s.selectAnnotation);
  const updateAnnotation = useEditorStore((s) => s.updateAnnotation);
  const activeFrameInstanceId = useEditorStore((s) => s.activeFrameInstanceId);
  const selectFrameInstance = useEditorStore((s) => s.selectFrameInstance);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const showGrid = useEditorStore((s) => s.showGrid);
  const gridDivisions = useEditorStore((s) => s.gridDivisions);
  const setShowGrid = useEditorStore((s) => s.setShowGrid);
  const setGridDivisions = useEditorStore((s) => s.setGridDivisions);

  const { analyzeMedia } = useScenePalette(scene, activeLayerId);
  const activeLayer = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
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
   const scaleRef = useRef<HTMLDivElement>(null);
   const tiltPrefix = useMemo(() => tiltCss(scene), [scene.tiltX, scene.tiltY]); // eslint-disable-line react-hooks/exhaustive-deps
   useFrameTransform(frameRef, activeLayer, scene.animationDurationMs, tiltPrefix);

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
    // JSON project import: drag a .json mockup file onto the canvas
    if (file.type === "application/json" || file.name.endsWith(".json")) {
      try {
        const { importProjectFromFile } = await import("@/lib/state/projectFile");
        const project = await importProjectFromFile(file);
        const { useProjectsStore } = await import("@/lib/state/projectsStore");
        useProjectsStore.getState().importProject(project);
        setMediaUploadError(null);
      } catch {
        setMediaUploadError(t("projects.importError"));
      }
      return;
    }
    try {
      const { url, mediaType, mediaName } = await loadMediaFromFile(file);
      setMediaUploadError(null);
      // Dropping onto the canvas replaces the active layer's media, matching
      // the Media panel upload — not a brand-new layer every time.
      setMedia(url, mediaType, mediaName);
    } catch (err) {
      setMediaUploadError(err instanceof UnsupportedMediaError ? err.message : t("editor.uploadError"));
    }
  };

  const handleCanvasFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const { url, mediaType, mediaName } = await loadMediaFromFile(file);
      setMediaUploadError(null);
      setMedia(url, mediaType, mediaName);
    } catch (err) {
      setMediaUploadError(err instanceof UnsupportedMediaError ? err.message : t("editor.uploadError"));
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
        // Let the component own pinch/pan gestures on the frame itself (the
        // frame element sets its own `touch-action: none`), but allow vertical
        // page scrolling when the user drags on the canvas margins on mobile,
        // so the editor page isn't trapped behind a scroll-blocking panel.
        touchAction: "pan-y",
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
        onPointerDown={(e) => {
          // Deselect any active annotation when clicking empty canvas. Clicks
          // on annotations/watermark use stopPropagation, so they won't bubble
          // here and won't steal the selection.
          const target = e.target as HTMLElement;
          if (target.closest("[data-annotation]") || target.closest(".preview-watermark")) return;
          selectAnnotation(null);
        }}
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
        {showGrid ? (
          <div
            data-grid-overlay
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 0,
              pointerEvents: "none",
              backgroundImage: [
                "repeating-linear-gradient(to right, rgba(255,255,255,0.07) 0 1px, transparent 1px 100%)",
                "repeating-linear-gradient(to bottom, rgba(255,255,255,0.07) 0 1px, transparent 1px 100%)"
              ].join(", "),
              backgroundSize: `${100 / gridDivisions}% ${100 / gridDivisions}%`
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
            setVideoDuration={setVideoDuration}
            canvasRef={canvasRef}
            snapDivisions={showGrid ? gridDivisions : null}
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
            selectLayer={selectLayer}
          />
         )}
        {scene.frameInstances.length > 0 ? (
          (() => {
            const selectedInst = scene.frameInstances.find((i) => i.id === activeFrameInstanceId);
            const selectedLayerId = selectedInst?.layerId ?? null;
            const selectedLayer = selectedLayerId ? scene.layers.find((l) => l.id === selectedLayerId) : undefined;
            const targetLayerId = selectedLayerId ?? scene.frameInstances[0]?.layerId ?? null;
            if (!targetLayerId) return null;
            const handleMultiFile = async (event: ChangeEvent<HTMLInputElement>) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                const { url, mediaType, mediaName } = await loadMediaFromFile(file);
                setMediaUploadError(null);
                useEditorStore.getState().setMediaOnLayer(targetLayerId, url, mediaType, mediaName);
              } catch (err) {
                setMediaUploadError(err instanceof UnsupportedMediaError ? err.message : t("editor.uploadError"));
              } finally {
                setCanvasFileInputKey((k) => k + 1);
              }
            };
            return (
              <div className="preview-chip-stack" style={{ top: 8, left: 8 }}>
                {!selectedLayer?.mediaUrl ? (
                  <label className="preview-chip">
                    <span>{t("editor.uploadMedia")}</span>
                    <input type="file" accept="image/*,video/*" onChange={handleMultiFile} key={canvasFileInputKey} style={{ display: "none" }} />
                  </label>
                ) : (
                  <button type="button" className="preview-chip" onClick={() => useEditorStore.getState().setMediaOnLayer(targetLayerId, null, "none", null)}>
                    {t("editor.clearMedia")}
                  </button>
                )}
              </div>
            );
          })()
        ) : null}
        {scene.frameInstances.length > 0 && scene.layers.every((l) => !l.mediaUrl) ? (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: "var(--text-dim)",
              fontSize: 14,
              textAlign: "center",
              pointerEvents: "none",
              zIndex: 2
            }}
          >
            <span>{t("editor.dropToStart")}</span>
          </div>
        ) : null}
        <div
          ref={scaleRef}
          style={{
            // Overlap the letterboxed frame box exactly (same sizing as
            // #preview-canvas) so percentage-positioned annotations/watermark
            // line up with the exported canvas, which also maps them to the
            // full frame box. A plain `inset:0` overlay would span the whole
            // container and drift whenever the frame is letterboxed.
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(100cqw, calc(100cqh * var(--canvas-ar-w) / var(--canvas-ar-h)))",
            height: "min(100cqh, calc(100cqw * var(--canvas-ar-h) / var(--canvas-ar-w)))",
            aspectRatio: scene.aspectRatio,
            transformOrigin: "top left",
            pointerEvents: "none"
          }}
        >
        {scene.annotations.map((a) => (
          <AnnotationItem
            key={a.id}
            annotation={a}
            selected={a.id === selectedAnnotationId}
            canvasRef={canvasRef}
            snapDivisions={showGrid ? gridDivisions : null}
            onSelect={selectAnnotation}
            onUpdate={updateAnnotation}
          />
        ))}
        {scene.watermarkEnabled && (
          scene.watermarkImageUrl ? (
            <img
              className="preview-watermark preview-watermark-logo"
              src={scene.watermarkImageUrl}
              alt=""
              style={{
                ...(scene.watermarkPosition === "bottom-left" || scene.watermarkPosition === "top-left"
                  ? { left: 16 }
                  : { right: 16 }),
                ...(scene.watermarkPosition === "top-left" || scene.watermarkPosition === "top-right"
                  ? { top: 16 }
                  : { bottom: 16 }),
                height: scene.watermarkSize
              }}
            />
          ) : (
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
          )
        )}
        </div>
        {scene.frameInstances.length === 0 ? (
          <div className="preview-chip-stack" style={{ top: 8, left: 8 }}>
            <label className="preview-chip">
              <span>{t("editor.uploadMedia")}</span>
              <input type="file" accept="image/*,video/*" onChange={handleCanvasFile} key={canvasFileInputKey} style={{ display: "none" }} />
            </label>
            {activeLayer?.mediaUrl ? (
              <button type="button" className="preview-chip" onClick={() => setMedia(null, "none", null)}>
                {t("editor.clearMedia")}
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="preview-chip-stack" style={{ bottom: 8, right: 8 }}>
          <button
            type="button"
            className="preview-chip"
            aria-pressed={showGrid}
            aria-label={t("editor.grid")}
            onClick={() => setShowGrid(!showGrid)}
          >
            {showGrid ? <Check size={12} /> : ""}{t("editor.grid")}
          </button>
          {showGrid ? (
            <select
              className="preview-chip"
              style={{ cursor: "pointer" }}
              value={gridDivisions}
              aria-label={t("editor.gridDivisions")}
              onChange={(e) => setGridDivisions(Number(e.target.value))}
            >
              {GRID_DIVISION_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          ) : null}
        </div>
        {mediaUploadError ? (
          <div role="alert" className="preview-error">
            {mediaUploadError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
