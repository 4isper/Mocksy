import type { Annotation } from "@/lib/types/editor";

/** Returns the CSS class that plays the live-preview entrance animation for an
 *  annotation, or null when the annotation isn't animated. Shapes/arrows draw
 *  on, text typesets in (a left-to-right wipe); reduced-motion users see the
 *  final state because globals.css zeroes animation durations. Export paths
 *  (canvas/SVG/HTML) render the final state regardless. */
export function annotationPreviewAnimation(annotation: Annotation): { className: string } | null {
  if (!annotation.animated) return null;
  switch (annotation.type) {
    case "arrow":
      return { className: "ann-draw" };
    case "text":
      return { className: "ann-typewriter" };
    default:
      return { className: "ann-fade" };
  }
}
