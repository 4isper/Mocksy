/**
 * Annotation and watermark chrome (fonts, strokes, insets, arrowheads) is
 * authored in pixels against a reference artboard width. Both the live
 * preview and every exporter derive the same factor from their target width,
 * so overlays keep their proportions relative to the mockup no matter how
 * large the browser window or the exported bitmap is — resizing the page
 * scales the whole artboard uniformly instead of leaving px-sized chrome
 * behind.
 */
export const OVERLAY_REFERENCE_WIDTH = 800;

/** Overlay scale factor for a given artboard width; 1 below/without a real
 *  measurement so test environments with zero-size canvases stay stable. */
export function overlayScaleFor(width: number): number {
  return width > 0 ? width / OVERLAY_REFERENCE_WIDTH : 1;
}
