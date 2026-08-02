import type { AnimationPreset, MockupFrame } from "@/lib/types/editor";

/** Native SVG viewBox size shared by the iPhone overlay skins. The screen
 *  cutout (FrameSpec.cutout) is expressed in these units, so insets and
 *  corner radii are converted off the rendered frame size using these
 *  constants rather than repeating 390/844 at every call site. */
export const SVG_VIEWBOX_WIDTH = 390;
export const SVG_VIEWBOX_HEIGHT = 844;

/** Default viewBox dimensions for skins that match the iPhone proportions
 *  (390x844). Other skins override this per-frame so cutout percentages are
 *  computed off their own viewBox instead of the shared phone size. */
export const DEFAULT_VIEWBOX = { w: SVG_VIEWBOX_WIDTH, h: SVG_VIEWBOX_HEIGHT };

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
  /** The skin's SVG viewBox size. Defaults to 390x844 (iPhone skins); must
   *  match `aspectRatio` so the overlay stretches without distortion. */
  viewBox?: { w: number; h: number };
}

/** ViewBox size used to convert cutout coordinates to frame percentages. */
export function frameViewBox(spec: FrameSpec): { w: number; h: number } {
  return spec.viewBox ?? DEFAULT_VIEWBOX;
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
  iphoneSE: {
    asset: "/devices/iphoneSE.svg",
    padding: 10,
    screenRadius: 10,
    isOverlay: true,
    aspectRatio: "375 / 667",
    // viewBox 375x667; screen rect x10 y34 w355 h577 rx10
    cutout: { x: 10, y: 34, w: 355, h: 577, rx: 10 },
    viewBox: { w: 375, h: 667 }
  },
  ipad: {
    asset: "/devices/ipad.svg",
    padding: 14,
    screenRadius: 12,
    isOverlay: true,
    aspectRatio: "862 / 1140",
    // viewBox 862x1140; screen rect x14 y14 w834 h1112 rx12
    cutout: { x: 14, y: 14, w: 834, h: 1112, rx: 12 },
    viewBox: { w: 862, h: 1140 }
  },
  galaxyTab: {
    asset: "/devices/galaxyTab.svg",
    padding: 18,
    screenRadius: 24,
    isOverlay: true,
    aspectRatio: "800 / 1280",
    // viewBox 800x1280; screen rect x18 y18 w764 h1244 rx24
    cutout: { x: 18, y: 18, w: 764, h: 1244, rx: 24 },
    viewBox: { w: 800, h: 1280 }
  },
  desktop: { asset: null, padding: 10, screenRadius: 8, isOverlay: false, aspectRatio: "16 / 10", cutout: null },
  tablet: { asset: null, padding: 14, screenRadius: 24, isOverlay: false, aspectRatio: "4 / 3", cutout: null },
  macbook: {
    asset: "/devices/macbook.svg",
    padding: 40,
    screenRadius: 6,
    isOverlay: true,
    aspectRatio: "1600 / 1040",
    // viewBox 1600x1040; screen rect x44 y34 w1512 h944 rx6
    cutout: { x: 44, y: 34, w: 1512, h: 944, rx: 6 },
    viewBox: { w: 1600, h: 1040 }
  },
  imac: {
    asset: "/devices/imac.svg",
    padding: 70,
    screenRadius: 10,
    isOverlay: true,
    aspectRatio: "1600 / 1420",
    // viewBox 1600x1420; screen rect x70 y80 w1460 h821 rx10
    cutout: { x: 70, y: 80, w: 1460, h: 821, rx: 10 },
    viewBox: { w: 1600, h: 1420 }
  },
  notebook: {
    asset: "/devices/notebook.svg",
    padding: 80,
    screenRadius: 8,
    isOverlay: true,
    aspectRatio: "1600 / 1000",
    // viewBox 1600x1000; screen rect x80 y40 w1440 h810 rx8
    cutout: { x: 80, y: 40, w: 1440, h: 810, rx: 8 },
    viewBox: { w: 1600, h: 1000 }
  },
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
  "iphoneSE",
  "ipad",
  "galaxyTab",
  "desktop",
  "tablet",
  "macbook",
  "imac",
  "notebook",
  "watch"
];

export const ANIMATION_PRESETS: AnimationPreset[] = ["none", "zoomIn", "zoomOut", "parallax", "panLeft", "panRight", "breathe"];

/** Aspect ratios selectable for the scene canvas. Kept here so the ControlPanel
 *  select and any preset/normalization code share a single source of truth. */
export const ASPECT_RATIOS = ["16 / 9", "4 / 3", "3 / 2", "1 / 1", "9 / 16"];
