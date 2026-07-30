import type { AnimationPreset, MockupFrame } from "@/lib/types/editor";

/** Native SVG viewBox size shared by the iPhone overlay skins. The screen
 *  cutout (FrameSpec.cutout) is expressed in these units, so insets and
 *  corner radii are converted off the rendered frame size using these
 *  constants rather than repeating 390/844 at every call site. */
export const SVG_VIEWBOX_WIDTH = 390;
export const SVG_VIEWBOX_HEIGHT = 844;

export interface FrameSpec {
  /** SVG overlay asset path, or null for CSS-only frames (none/iphone/desktop/tablet). */
  asset: string | null;
  /** Padding (px, design units) between outer frame edge and the screen, used by CSS preview. */
  padding: number;
  /** Screen corner radius (px) applied to the media inside the frame. */
  screenRadius: number;
  /** Whether the frame is an overlay asset that sits on top of the media. */
  isOverlay: boolean;
  /** Native aspect ratio the frame should adopt (e.g. phone skins), or null to follow the scene. */
  aspectRatio: string | null;
  /** Transparent screen cutout in SVG viewBox units, used to inset/round the
   *  media so it matches the skin at any rendered size. Null for non-overlay. */
  cutout: { x: number; y: number; w: number; h: number; rx: number } | null;
}

export const FRAME_SPECS: Record<MockupFrame, FrameSpec> = {
  none: { asset: null, padding: 0, screenRadius: 20, isOverlay: false, aspectRatio: null, cutout: null },
  iphone: { asset: null, padding: 18, screenRadius: 36, isOverlay: false, aspectRatio: "390 / 844", cutout: null },
  iphone15: {
    asset: "/devices/iphone15.svg",
    padding: 14,
    screenRadius: 46,
    isOverlay: true,
    aspectRatio: "390 / 844",
    // viewBox 390x844; screen rect x14 y14 w362 h816 rx46
    cutout: { x: 14, y: 14, w: 362, h: 816, rx: 46 }
  },
  iphone16pro: {
    asset: "/devices/iphone16pro.svg",
    padding: 14,
    screenRadius: 48,
    isOverlay: true,
    aspectRatio: "390 / 844",
    // viewBox 390x844; screen rect x14 y14 w362 h816 rx48
    cutout: { x: 14, y: 14, w: 362, h: 816, rx: 48 }
  },
  pixel8pro: {
    asset: "/devices/pixel8pro.svg",
    padding: 14,
    screenRadius: 44,
    isOverlay: true,
    aspectRatio: "390 / 844",
    // viewBox 390x844; screen rect x14 y14 w362 h816 rx44
    cutout: { x: 14, y: 14, w: 362, h: 816, rx: 44 }
  },
  galaxy24: {
    asset: "/devices/galaxy24.svg",
    padding: 12,
    screenRadius: 32,
    isOverlay: true,
    aspectRatio: "390 / 844",
    // viewBox 390x844; screen rect x12 y12 w366 h820 rx32
    cutout: { x: 12, y: 12, w: 366, h: 820, rx: 32 }
  },
  desktop: { asset: null, padding: 10, screenRadius: 8, isOverlay: false, aspectRatio: "16 / 10", cutout: null },
  tablet: { asset: null, padding: 14, screenRadius: 24, isOverlay: false, aspectRatio: "4 / 3", cutout: null },
  watch: { asset: null, padding: 18, screenRadius: 999, isOverlay: false, aspectRatio: "1 / 1", cutout: null }
};

export function getFrameSpec(frame: MockupFrame): FrameSpec {
  return FRAME_SPECS[frame] ?? FRAME_SPECS.none;
}

export const FRAME_ORDER: MockupFrame[] = [
  "none",
  "iphone",
  "iphone15",
  "iphone16pro",
  "pixel8pro",
  "galaxy24",
  "desktop",
  "tablet",
  "watch"
];

export const ANIMATION_PRESETS: AnimationPreset[] = ["none", "zoomIn", "zoomOut", "parallax"];

/** Aspect ratios selectable for the scene canvas. Kept here so the ControlPanel
 *  select and any preset/normalization code share a single source of truth. */
export const ASPECT_RATIOS = ["16 / 9", "4 / 3", "3 / 2", "1 / 1", "9 / 16"];
