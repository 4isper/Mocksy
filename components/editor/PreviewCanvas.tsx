"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { EditorScene } from "@/lib/types/editor";
import { buildSceneCss } from "@/lib/render/mockupRenderer";
import { collectOverlayClipDefs } from "@/lib/render/squircle";
import type { GuideLine } from "@/lib/render/annotationAlign";
import { parseAspectRatioOr } from "@/lib/render/aspectRatio";
import { tiltCss } from "@/lib/render/tilt";
import { resolveZoomScale } from "@/lib/render/previewViewport";
import { useEditorStore } from "@/lib/state/editorStore";
import { useTranslations } from "next-intl";
import { useFrameTransform } from "@/lib/hooks/useFrameTransform";
import { useScenePalette } from "@/lib/hooks/useScenePalette";
import { useCanvasGestures } from "@/lib/hooks/useCanvasGestures";
import { useCanvasDrop } from "@/lib/hooks/useCanvasDrop";
import { useCanvasViewport } from "@/lib/hooks/useCanvasViewport";
import { ContextMenu, type ContextMenuItem } from "@/components/editor/ContextMenu";
import { FrameInstanceGrid } from "@/components/editor/FrameInstanceGrid";
import { SingleFrameView } from "@/components/editor/SingleFrameView";
import { PreviewBackground } from "@/components/editor/PreviewBackground";
import { PreviewOverlays } from "@/components/editor/PreviewOverlays";
import { PreviewChips, PreviewGridToggle, PreviewZoomControl } from "@/components/editor/PreviewChips";

interface PreviewCanvasProps {
  scene: EditorScene;
}

export function PreviewCanvas({ scene }: PreviewCanvasProps) {
  const t = useTranslations();
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const sceneCss = useMemo(() => buildSceneCss(scene, activeLayerId), [scene, activeLayerId]);
  // The scene background moves into the zoom layer (see JSX below); the rest
  // of the container style stays on the canvas box itself.
  const { background: sceneBackground, backgroundSize: sceneBackgroundSize, ...containerStyle } = sceneCss.container;
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
  // View zoom/pan state is consumed inside <PreviewZoomLayer> so continuous
  // panning re-renders only that wrapper instead of the whole scene subtree.
  const setShowGrid = useEditorStore((s) => s.setShowGrid);
  const setGridDivisions = useEditorStore((s) => s.setGridDivisions);
  const setVideoDuration = useEditorStore((s) => s.setVideoDuration);
  const setVideoCurrentTime = useEditorStore((s) => s.setVideoCurrentTime);
  const setMediaLoading = useEditorStore((s) => s.setMediaLoading);
  const addAnnotation = useEditorStore((s) => s.addAnnotation);
  const duplicateAnnotation = useEditorStore((s) => s.duplicateAnnotation);
  const reorderAnnotation = useEditorStore((s) => s.reorderAnnotation);
  const removeAnnotation = useEditorStore((s) => s.removeAnnotation);
  const removeAnnotations = useEditorStore((s) => s.removeAnnotations);
  const duplicateFrameInstance = useEditorStore((s) => s.duplicateFrameInstance);
  const reorderFrameInstance = useEditorStore((s) => s.reorderFrameInstance);
  const removeFrameInstance = useEditorStore((s) => s.removeFrameInstance);
  const updateFrameInstance = useEditorStore((s) => s.updateFrameInstance);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);

  const { analyzeMedia } = useScenePalette(scene, activeLayerId);
  const activeLayer = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
  const frameInstanceCssMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildSceneCss>>();
    for (const inst of scene.frameInstances) {
      const layer = scene.layers.find((l) => l.id !== undefined && l.id === inst.layerId) ?? activeLayer;
      map.set(inst.id, buildSceneCss({ ...scene, frame: inst.frame, frameMaterial: inst.material, screen: inst.screen ?? scene.screen, layers: layer ? [layer] : [] }));
    }
    return map;
    // activeLayer is derived from activeLayerId, so keying on the id keeps the
    // memo stable across re-renders that don't actually change the scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, activeLayerId]);

  // The whole-mockup zoom/animation is applied to the frame container so the
  // device skin and media scale together, matching the export.
  const frameRef = useRef<HTMLDivElement>(null);
  // Per-layer <video> elements (single-frame mode): the timeline seek targets
  // the active layer's own video — a shared ref would track whichever video
  // mounted last and scrub the wrong clip when several are visible.
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const canvasRef = useRef<HTMLDivElement>(null);
  const tiltPrefix = useMemo(() => tiltCss(scene), [scene.tiltX, scene.tiltY]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrameTransform(frameRef, activeLayer, scene.animationDurationMs, tiltPrefix);

  const { canPan, onTouchStart, onTouchEnd, onTouchCancel, onPanDown, onPanMove, onPanUp } = useCanvasGestures({ frameRef, activeLayer });
  const { fileInputKey, isDragging, handleDrop, handleFile, onDragEnter, onDragOver, onDragLeave } = useCanvasDrop({ scene });
  const view = useCanvasViewport({ canvasRef });

  const isMultiFrame = scene.frameInstances.length > 0;
  const selectedInst = scene.frameInstances.find((i) => i.id === activeFrameInstanceId);
  const targetLayerId = selectedInst?.layerId ?? scene.frameInstances[0]?.layerId ?? null;
  const canClearActive = !!activeLayer?.mediaUrl;

  const { w: arW, h: arH } = parseAspectRatioOr(scene.aspectRatio);

  /** Builds the context-menu items for the right-clicked target: a frame
   *  instance, an annotation, or the empty canvas (add-annotation actions). */
  const openContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      e.preventDefault();
      const frameEl = target.closest("[data-frame-instance-id]");
      const annEl = target.closest("[data-annotation-id]");

      if (frameEl) {
        const id = frameEl.getAttribute("data-frame-instance-id");
        if (!id) return;
        selectFrameInstance(id);
        const inst = scene.frameInstances.find((fi) => fi.id === id);
        const nextOrientation = inst?.orientation === "landscape" ? "portrait" : "landscape";
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          items: [
            { id: "rotate", label: t("editor.ctxRotate"), onSelect: () => updateFrameInstance(id, { orientation: nextOrientation }) },
            { id: "dup", label: t("editor.ctxDuplicate"), onSelect: () => duplicateFrameInstance(id) },
            { id: "front", label: t("editor.ctxBringToFront"), onSelect: () => reorderFrameInstance(id, "front") },
            { id: "back", label: t("editor.ctxSendToBack"), onSelect: () => reorderFrameInstance(id, "back") },
            { id: "remove", label: t("editor.ctxRemove"), danger: true, separatorBefore: true, onSelect: () => removeFrameInstance(id) }
          ]
        });
        return;
      }

      if (annEl) {
        const id = annEl.getAttribute("data-annotation-id");
        if (!id) return;
        selectAnnotation(id);
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          items: [
            { id: "dup", label: t("editor.ctxDuplicate"), onSelect: () => duplicateAnnotation(id) },
            { id: "front", label: t("editor.ctxBringToFront"), onSelect: () => reorderAnnotation(id, "front") },
            { id: "back", label: t("editor.ctxSendToBack"), onSelect: () => reorderAnnotation(id, "back") },
            { id: "remove", label: t("editor.ctxDelete"), danger: true, separatorBefore: true, onSelect: () => removeAnnotation(id) }
          ]
        });
        return;
      }

      // Empty canvas: annotation shortcuts plus deselect.
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          { id: "add-text", label: t("editor.ctxAddText"), onSelect: () => addAnnotation("text") },
          { id: "add-arrow", label: t("editor.ctxAddArrow"), onSelect: () => addAnnotation("arrow") },
          { id: "add-rect", label: t("editor.ctxAddRect"), onSelect: () => addAnnotation("rect") },
          { id: "add-circle", label: t("editor.ctxAddCircle"), onSelect: () => addAnnotation("circle") },
          { id: "add-blur", label: t("editor.ctxAddBlur"), onSelect: () => addAnnotation("blur") },
          { id: "deselect", label: t("editor.ctxDeselect"), separatorBefore: true, onSelect: () => {
            selectAnnotation(null);
            selectFrameInstance(null);
          } }
        ]
      });
    },
    [t, selectAnnotation, selectFrameInstance, addAnnotation, duplicateAnnotation, reorderAnnotation, removeAnnotation, duplicateFrameInstance, reorderFrameInstance, removeFrameInstance, updateFrameInstance, scene.frameInstances]
  );

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
        outline: isDragging ? "2px dashed var(--accent)" : "2px dashed transparent"
      }}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      <div
        id="preview-canvas"
        ref={canvasRef}
        tabIndex={0}
        role="group"
        aria-label={t("editor.canvasAria")}
        onPointerDown={(e) => {
          // Deselect any active annotation when clicking empty canvas. Clicks
          // on annotations/watermark use stopPropagation, so they won't bubble
          // here and won't steal the selection.
          const target = e.target as HTMLElement;
          if (target.closest("[data-annotation]") || target.closest(".preview-watermark")) return;
          selectAnnotation(null);
        }}
        onPointerDownCapture={view.onPointerDownCapture}
        onPointerMove={view.onPointerMove}
        onPointerUp={view.onPointerUp}
        onPointerCancel={view.onPointerCancel}
        onDoubleClick={view.onDoubleClickReset}
        onContextMenu={openContextMenu}
        onKeyDown={(e) => {
          // Delete/Backspace removes every selected annotation (multi-select
          // included) when the canvas is focused.
          // Never fire while typing in the inline annotation editor (or any
          // other contentEditable): the caret's Backspace must not delete the
          // annotation itself.
          const target = e.target instanceof HTMLElement ? e.target : null;
          if (target?.isContentEditable) return;
          if ((e.key === "Delete" || e.key === "Backspace") && selectedAnnotationIds.length > 0) {
            e.preventDefault();
            removeAnnotations(selectedAnnotationIds);
            selectAnnotation(null);
          }
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
          cursor: view.viewCursor,
          ...containerStyle
        }}
      >
        {/* View-zoom/pan layer: transforms scene content only; chips, alerts
            and menus stay unscaled outside of it. Isolated subscriber so pan
            gestures don't re-render the whole subtree — children keep their
            element identity across zoom updates. Mirrors #preview-canvas's
            flex centering — buildSceneCss sizes the frame against its parent
            box, so without this the device sticks to the top-left corner
            instead of centering like the canvas export does. */}
        <PreviewZoomLayer>
        {/* The scene background paints inside the zoom layer so zooming
            magnifies the whole artboard (background included), matching what
            an export looks like up close. UI chrome stays outside. */}
        {sceneBackground ? (
          <div
            data-scene-bg
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: sceneBackground,
              ...(sceneBackgroundSize ? { backgroundSize: sceneBackgroundSize } : {}),
              pointerEvents: "none"
            }}
          />
        ) : null}
        <PreviewBackground sceneCss={sceneCss} showGrid={showGrid} gridDivisions={gridDivisions} />
        <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
          <defs>
            {collectOverlayClipDefs(scene).map((def) => (
              <clipPath key={def.id} id={def.id} clipPathUnits="objectBoundingBox">
                <path d={def.d} />
              </clipPath>
            ))}
          </defs>
        </svg>
        {isMultiFrame ? (
          <FrameInstanceGrid
            scene={scene}
            activeLayer={activeLayer}
            frameInstanceCssMap={frameInstanceCssMap}
            activeFrameInstanceId={activeFrameInstanceId}
            selectFrameInstance={selectFrameInstance}
            analyzeMedia={analyzeMedia}
            setVideoDuration={setVideoDuration}
            setMediaLoading={setMediaLoading}
            canvasRef={canvasRef}
            snapDivisions={showGrid ? gridDivisions : null}
            onGuides={setGuides}
          />
        ) : (
          <SingleFrameView
            scene={scene}
            sceneCss={sceneCss}
            canPan={canPan}
            frameRef={frameRef}
            videoRefs={videoRefs}
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
          onRemoveAnnotation={removeAnnotation}
          onSelectMany={selectAnnotations}
          onGuides={setGuides}
        />
        </PreviewZoomLayer>
        {/* Upload/Clear chips and the empty-canvas hint are UI chrome: they
            live outside the zoom layer so they stay fixed-size and readable
            at any zoom level. */}
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
            className="drop-hint"
          >
            <span>{t("editor.dropToStart")}</span>
          </div>
        ) : null}
        <PreviewGridToggle
          showGrid={showGrid}
          gridDivisions={gridDivisions}
          setShowGrid={setShowGrid}
          setGridDivisions={setGridDivisions}
        />
        <PreviewZoomControl />
        {mediaUploadError ? (
          <div role="alert" className="preview-error">
            {mediaUploadError}
          </div>
        ) : null}
        {contextMenu ? (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={contextMenu.items}
            onClose={() => setContextMenu(null)}
          />
        ) : null}
      </div>
    </div>
  );
}

/** Isolated subscriber for the view zoom/pan state: re-renders only this
 *  transform wrapper when the user pans or zooms, while `children` keep their
 *  element identity so the scene subtree bails out of reconciliation.
 *  Transform order matters — translate is applied in canvas pixels, then the
 *  content scales around the center (screen = pan + scale·content). */
function PreviewZoomLayer({ children }: { children: React.ReactNode }) {
  const previewZoom = useEditorStore((s) => s.previewZoom);
  const previewPan = useEditorStore((s) => s.previewPan);
  const scale = resolveZoomScale(previewZoom);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${scale})`,
        transformOrigin: "center"
      }}
    >
      {children}
    </div>
  );
}
