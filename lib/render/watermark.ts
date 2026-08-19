import type { WatermarkPosition } from "@/lib/types/editor";

/** Resolves a watermark position into its horizontal/vertical edge anchors. */
export function watermarkEdges(position: WatermarkPosition): { onLeft: boolean; onTop: boolean } {
  return {
    onLeft: position === "bottom-left" || position === "top-left",
    onTop: position === "top-right" || position === "top-left"
  };
}
