/**
 * Canvas layer factory shared by the main-thread and worker render paths.
 * OffscreenCanvas keeps every code path identical in both contexts; the
 * document canvas fallback preserves behaviour where OffscreenCanvas is
 * unavailable (older browsers, test environments).
 */
export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

export function createLayerCanvas(width: number, height: number): AnyCanvas {
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(w, h);
  }
  if (typeof document === "undefined") {
    // SSR/tests without canvas support: return a stub whose getContext fails.
    return { width: w, height: h, getContext: () => null } as unknown as HTMLCanvasElement;
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/** 2D context for any canvas kind, typed for the shared drawing helpers. */
export function layerContext(canvas: AnyCanvas): CanvasRenderingContext2D | null {
  return canvas.getContext("2d") as CanvasRenderingContext2D | null;
}
