import type { MockupFrame } from "@/lib/types/editor";

export interface FrameSpec {
  /** SVG overlay asset path, or null for CSS-only frames (none/iphone/desktop/tablet). */
  asset: string | null;
  /** Padding (px, design units) between outer frame edge and the screen, used by CSS preview. */
  padding: number;
  /** Screen corner radius (px) applied to the media inside the frame. */
  screenRadius: number;
  /** Whether the frame is an overlay asset that sits on top of the media. */
  isOverlay: boolean;
}

export const FRAME_SPECS: Record<MockupFrame, FrameSpec> = {
  none: { asset: null, padding: 0, screenRadius: 20, isOverlay: false },
  iphone: { asset: null, padding: 18, screenRadius: 36, isOverlay: false },
  iphone15: { asset: "/devices/iphone15.svg", padding: 14, screenRadius: 46, isOverlay: true },
  iphone16pro: { asset: "/devices/iphone16pro.svg", padding: 14, screenRadius: 48, isOverlay: true },
  desktop: { asset: null, padding: 10, screenRadius: 8, isOverlay: false },
  tablet: { asset: null, padding: 14, screenRadius: 24, isOverlay: false }
};

export function getFrameSpec(frame: MockupFrame): FrameSpec {
  return FRAME_SPECS[frame] ?? FRAME_SPECS.none;
}

export const FRAME_ORDER: MockupFrame[] = [
  "none",
  "iphone",
  "iphone15",
  "iphone16pro",
  "desktop",
  "tablet"
];
