"use client";

import type { EditorScene } from "@/lib/types/editor";
import { watermarkEdges } from "@/lib/render/watermark";
import { AnnotationItem } from "@/components/editor/AnnotationItem";

/** The letterboxed overlay that hosts percentage-positioned annotations and the
 *  watermark, aligned to the exported frame box via the same `--canvas-ar-*`
 *  size container units. */
export function PreviewOverlays({
  scene,
  canvasRef,
  selectedAnnotationId,
  showGrid,
  gridDivisions,
  onSelectAnnotation,
  onUpdateAnnotation
}: {
  scene: EditorScene;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  selectedAnnotationId: string | null;
  showGrid: boolean;
  gridDivisions: number;
  onSelectAnnotation: (id: string | null) => void;
  onUpdateAnnotation: (id: string, patch: Partial<EditorScene["annotations"][number]>) => void;
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
          selected={a.id === selectedAnnotationId}
          canvasRef={canvasRef}
          snapDivisions={showGrid ? gridDivisions : null}
          onSelect={onSelectAnnotation}
          onUpdate={onUpdateAnnotation}
        />
      ))}
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
