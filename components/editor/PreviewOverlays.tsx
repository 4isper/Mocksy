"use client";

import type { EditorScene } from "@/lib/types/editor";
import { watermarkEdges } from "@/lib/render/watermark";
import type { GuideLine } from "@/lib/render/annotationAlign";
import { AnnotationItem } from "@/components/editor/AnnotationItem";

/** The letterboxed overlay that hosts percentage-positioned annotations and the
 *  watermark, aligned to the exported frame box via the same `--canvas-ar-*`
 *  size container units. */
export function PreviewOverlays({
  scene,
  canvasRef,
  selectedAnnotationId,
  selectedAnnotationIds,
  showGrid,
  gridDivisions,
  guides,
  onSelectAnnotation,
  onUpdateAnnotation,
  onSelectMany,
  onGuides
}: {
  scene: EditorScene;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  selectedAnnotationId: string | null;
  selectedAnnotationIds: string[];
  showGrid: boolean;
  gridDivisions: number;
  /** Smart-guide lines to draw while dragging an annotation. */
  guides: GuideLine[];
  onSelectAnnotation: (id: string | null, additive?: boolean) => void;
  onUpdateAnnotation: (id: string, patch: Partial<EditorScene["annotations"][number]>) => void;
  onSelectMany: (ids: string[]) => void;
  onGuides: (guides: GuideLine[]) => void;
}) {
  return (
    <div
      style={{
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
          selected={selectedAnnotationIds.includes(a.id)}
          others={scene.annotations.filter((o) => o.id !== a.id)}
          canvasRef={canvasRef}
          snapDivisions={showGrid ? gridDivisions : null}
          onSelect={onSelectAnnotation}
          onSelectMany={onSelectMany}
          onUpdate={onUpdateAnnotation}
          onGuides={onGuides}
        />
      ))}
      {guides.map((g, i) =>
        g.axis === "x" ? (
          <div
            key={`guide-x-${i}`}
            style={{ position: "absolute", left: `${g.pos * 100}%`, top: 0, bottom: 0, width: 1, background: "var(--accent)", pointerEvents: "none", zIndex: 5, opacity: 0.8 }}
          />
        ) : (
          <div
            key={`guide-y-${i}`}
            style={{ position: "absolute", top: `${g.pos * 100}%`, left: 0, right: 0, height: 1, background: "var(--accent)", pointerEvents: "none", zIndex: 5, opacity: 0.8 }}
          />
        )
      )}
      {scene.watermarkEnabled &&
        (scene.watermarkImageUrl ? (
          <img
            className="preview-watermark preview-watermark-logo"
            src={scene.watermarkImageUrl}
            alt=""
            style={{
              ...(watermarkEdges(scene.watermarkPosition).onLeft ? { left: 16 } : { right: 16 }),
              ...(watermarkEdges(scene.watermarkPosition).onTop ? { top: 16 } : { bottom: 16 }),
              height: scene.watermarkSize
            }}
          />
        ) : (
          <span
            className="preview-watermark"
            style={{
              ...(watermarkEdges(scene.watermarkPosition).onLeft ? { left: 16 } : { right: 16 }),
              ...(watermarkEdges(scene.watermarkPosition).onTop ? { top: 16 } : { bottom: 16 }),
              fontSize: scene.watermarkSize
            }}
          >
            {scene.watermarkText}
          </span>
        ))}
    </div>
  );
}
