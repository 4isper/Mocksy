import type { EditorScene } from "@/lib/types/editor";
import { getFrameSpec, frameViewBox } from "@/lib/render/frames";
import { RENDER } from "@/lib/render/canvasDrawing";

export interface FrameBox {
  x: number;
  y: number;
  width: number;
  height: number;
  outerRadius: number;
  innerX: number;
  innerY: number;
  innerW: number;
  innerH: number;
  innerRadius: number;
}

export interface RenderTransform {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

/** Animation pan keyframes store small offsets (e.g. ±20). The live preview
 *  displaces the frame by that many units × this factor (CSS px), so the
 *  canvas export must shift the frame box by the same factor × pixelRatio to
 *  keep "what you see previews what you export". Shared so the two can't drift.
 */
export const PAN_OFFSET_SCALE = 2;

function panOffset(transform: RenderTransform | undefined, dpiScale: number): { panX: number; panY: number } {
  return {
    panX: (transform?.offsetX ?? 0) * PAN_OFFSET_SCALE * dpiScale,
    panY: (transform?.offsetY ?? 0) * PAN_OFFSET_SCALE * dpiScale
  };
}

export function computeFrameBox(
  scene: EditorScene,
  canvasWidth: number,
  canvasHeight: number,
  pixelRatio: number,
  frameWidth?: number,
  frameHeight?: number,
  transform?: RenderTransform,
  frameX?: number,
  frameY?: number,
  activeLayerId: string | null = scene.activeLayerId
): FrameBox {
  const spec = getFrameSpec(scene.frame, scene.customFrame);
  const dpiScale = pixelRatio;
  const activeLayerForRender = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
   const actualZoom = Math.max(RENDER.minZoom, transform?.zoom ?? activeLayerForRender?.zoom ?? 1);
   const defaultFrameW = Math.min(RENDER.defaultFrameWidth, (canvasWidth / dpiScale) * RENDER.defaultFrameFill) * dpiScale;
  const frameW = (typeof frameWidth === "number" && frameWidth > 0 ? frameWidth : defaultFrameW) * actualZoom;
  const frameH = (typeof frameHeight === "number" && frameHeight > 0 ? frameHeight : frameW * (10 / 16)) * actualZoom;
  const { panX, panY } = panOffset(transform, dpiScale);
  const x = (typeof frameX === "number" ? frameX : (canvasWidth - frameW) / 2) + panX;
  const y = (typeof frameY === "number" ? frameY : (canvasHeight - frameH) / 2) + panY;
  const cutout = spec.cutout;
  const vb = frameViewBox(spec);
  const padX = cutout ? (cutout.x / vb.w) * frameW : spec.padding * dpiScale * actualZoom;
  const padY = cutout ? (cutout.y / vb.h) * frameH : spec.padding * dpiScale * actualZoom;
  const isCircular = scene.frame === "watch";
  const outerRadius = isCircular
    ? Math.min(frameW, frameH) / 2
    : (spec.isOverlay ? spec.screenRadius : scene.borderRadius + spec.padding) * dpiScale * actualZoom;
  const innerX = x + padX;
  const innerY = y + padY;
  const innerW = cutout ? (cutout.w / vb.w) * frameW : frameW - padX * 2;
  const innerH = cutout ? (cutout.h / vb.h) * frameH : frameH - padY * 2;
  const innerRadius = isCircular
    ? Math.min(innerW, innerH) / 2
    : cutout
      ? Math.max(0, (cutout.rx / cutout.w) * innerW, (cutout.rx / cutout.h) * innerH)
      : Math.max(0, spec.screenRadius * dpiScale * actualZoom);
  return { x, y, width: frameW, height: frameH, outerRadius, innerX, innerY, innerW, innerH, innerRadius };
}

export function computeFrameInstances(
  scene: EditorScene,
  canvasWidth: number,
  canvasHeight: number,
  pixelRatio: number,
  transform?: RenderTransform,
  activeLayerId: string | null = scene.activeLayerId
): FrameBox[] {
  const instances = scene.frameInstances.length > 0 ? scene.frameInstances : [];
  if (instances.length === 0) return [];
  const dpiScale = pixelRatio;
  const activeLayer = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
   const actualZoom = Math.max(RENDER.minZoom, transform?.zoom ?? activeLayer?.zoom ?? 1);

  return instances.map((inst) => {
    const spec = getFrameSpec(inst.frame, scene.customFrame);
    const instScale = inst.scale ?? 1;
    const ratioSrc = spec.aspectRatio ?? (inst.frame === "none" ? scene.aspectRatio : "1 / 1");
    const [rW, rH] = ratioSrc.split("/").map((n) => Number(n.trim()));
    const instAr = (rH ?? 1) / (rW ?? 1);

    const w = instScale * canvasWidth * actualZoom;
    const h = w * instAr;
    const { panX, panY } = panOffset(transform, dpiScale);
    const x = inst.x * canvasWidth - w / 2 + panX;
    const y = inst.y * canvasHeight - h / 2 + panY;

    const cutout = spec.cutout;
    const vb = frameViewBox(spec);
    const padX = cutout ? (cutout.x / vb.w) * w : spec.padding * dpiScale * actualZoom;
    const padY = cutout ? (cutout.y / vb.h) * h : spec.padding * dpiScale * actualZoom;
    const outerRadius = spec.isOverlay ? 0 : (inst.frame === "watch" ? Math.min(w, h) / 2 : scene.borderRadius + spec.padding) * dpiScale * actualZoom;

    return {
      x,
      y,
      width: w,
      height: h,
      outerRadius,
      innerX: x + padX,
      innerY: y + padY,
      innerW: cutout ? (cutout.w / vb.w) * w : w - padX * 2,
      innerH: cutout ? (cutout.h / vb.h) * h : h - padY * 2,
      innerRadius: cutout
        ? Math.max(0, (cutout.rx / cutout.w) * (w - padX * 2), (cutout.rx / cutout.h) * (h - padY * 2))
        : spec.screenRadius * dpiScale * actualZoom
    };
  });
}

