"use client";

import { useMemo, useRef, useState } from "react";
import type { EditorScene } from "@/lib/types/editor";
import { buildSceneCss } from "@/lib/render/mockupRenderer";
import type { GuideLine } from "@/lib/render/annotationAlign";
import { parseAspectRatioOr } from "@/lib/render/aspectRatio";
import { tiltCss } from "@/lib/render/tilt";
import { useEditorStore } from "@/lib/state/editorStore";
import { useTranslations } from "next-intl";
import { useFrameTransform } from "@/lib/hooks/useFrameTransform";
import { useScenePalette } from "@/lib/hooks/useScenePalette";
import { useCanvasGestures } from "@/lib/hooks/useCanvasGestures";
import { useCanvasDrop } from "@/lib/hooks/useCanvasDrop";
import { AnnotationItem } from "@/components/editor/AnnotationItem";
import { FrameInstanceGrid } from "@/components/editor/FrameInstanceGrid";
import { SingleFrameView } from "@/components/editor/SingleFrameView";
import { PreviewBackground } from "@/components/editor/PreviewBackground";
import { PreviewOverlays } from "@/components/editor/PreviewOverlays";
import { PreviewChips, PreviewGridToggle } from "@/components/editor/PreviewChips";

interface PreviewCanvasProps {
  scene: EditorScene;
}

export function PreviewCanvas({ scene }: PreviewCanvasProps) {
  const t = useTranslations();
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const sceneCss = useMemo(() => buildSceneCss(scene, activeLayerId), [scene, activeLayerId]);
  const isMediaLoading = useEditorStore((s) => s.isMediaLoading);
  const mediaUploadError = useEditorStore((s) => s.mediaUploadError);
  const selectedAnnotationId = useEditorStore((s) => s.selectedAnnotationId);
  const selectedAnnotationIds = useEditorStore((s) => s.selectedAnnotationIds);
  const selectAnnotation = useEditorStore((s) => s.selectAnnotation);
  const selectAnnotations = useEditorStore((s) => s.selectAnnotations);
  const updateAnnotation = useEditorStore((s) => s.updateAnnotation);
  const [guides, setGuides] = useState<GuideLine[]>([]);
  const activeFrameInstanceId = useEditorStore((s) => s.activeFrameInstanceId);
  const selectFrameInstance = useEditorStore((s) => s.selectFrameInstance);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const showGrid = useEditorStore((s) => s.showGrid);
  const gridDivisions = useEditorStore((s) => s.gridDivisions);
  const setShowGrid = useEditorStore((s) => s.setShowGrid);
  const setGridDivisions = useEditorStore((s) => s.setGridDivisions);
  const setVideoDuration = useEditorStore((s) => s.setVideoDuration);
  const setVideoCurrentTime = useEditorStore((s) => s.setVideoCurrentTime);
  const setMediaLoading = useEditorStore((s) => s.setMediaLoading);

  const { analyzeMedia } = useScenePalette(scene, activeLayerId);
  const activeLayer = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
  const frameInstanceCssMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildSceneCss>>();
    for (const inst of scene.frameInstances) {
      const layer = scene.layers.find((l) => l.id !== undefined && l.id === inst.layerId) ?? activeLayer;
      map.set(inst.id, buildSceneCss({ ...scene, frame: inst.frame, layers: layer ? [layer] : [] }));
    }
    return map;
    // activeLayer is derived from activeLayerId, so keying on the id keeps the
    // memo stable across re-renders that don't actually change the scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, activeLayerId]);

  // The whole-mockup zoom/animation is applied to the frame container so the
  // device skin and media scale together, matching the export.
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const tiltPrefix = useMemo(() => tiltCss(scene), [scene.tiltX, scene.tiltY]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrameTransform(frameRef, activeLayer, scene.animationDurationMs, tiltPrefix);

  const { canPan, onTouchStart, onTouchMove, onTouchEnd, onPanDown, onPanMove, onPanUp } = useCanvasGestures({ frameRef, activeLayer });
  const { fileInputKey, isDragging, handleDrop, handleFile, onDragEnter, onDragOver, onDragLeave } = useCanvasDrop({ scene });

  const isMultiFrame = scene.frameInstances.length > 0;
  const selectedInst = scene.frameInstances.find((i) => i.id === activeFrameInstanceId);
  const targetLayerId = selectedInst?.layerId ?? scene.frameInstances[0]?.layerId ?? null;
  const canClearActive = !!activeLayer?.mediaUrl;

  const { w: arW, h: arH } = parseAspectRatioOr(scene.aspectRatio);

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
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
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
        <PreviewBackground sceneCss={sceneCss} showGrid={showGrid} gridDivisions={gridDivisions} />
        {isMultiFrame ? (
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
            handleCanvasFile={(e) => handleFile(e)}
            canvasFileInputKey={fileInputKey}
            isMediaLoading={isMediaLoading}
            setVideoDuration={setVideoDuration}
            setVideoCurrentTime={setVideoCurrentTime}
            setMediaLoading={setMediaLoading}
            selectLayer={selectLayer}
          />
        )}
        {isMultiFrame ? (
          <PreviewChips
            isMultiFrame
            canClearActive={!!scene.layers.find((l) => l.id === targetLayerId)?.mediaUrl}
            targetLayerId={targetLayerId}
            fileInputKey={fileInputKey}
            onFile={handleFile}
          />
        ) : (
          <PreviewChips
            isMultiFrame={false}
            canClearActive={canClearActive}
            targetLayerId={null}
            fileInputKey={fileInputKey}
            onFile={handleFile}
          />
        )}
        {isMultiFrame && scene.layers.every((l) => !l.mediaUrl) ? (
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
        <PreviewOverlays
          scene={scene}
          canvasRef={canvasRef}
          selectedAnnotationId={selectedAnnotationId}
          selectedAnnotationIds={selectedAnnotationIds}
          showGrid={showGrid}
          gridDivisions={gridDivisions}
          guides={guides}
          onSelectAnnotation={selectAnnotation}
          onUpdateAnnotation={updateAnnotation}
          onSelectMany={selectAnnotations}
          onGuides={setGuides}
        />
        <PreviewGridToggle
          showGrid={showGrid}
          gridDivisions={gridDivisions}
          setShowGrid={setShowGrid}
          setGridDivisions={setGridDivisions}
        />
        {mediaUploadError ? (
          <div role="alert" className="preview-error">
            {mediaUploadError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
