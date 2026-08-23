import type { AnimationPreset, CustomFrame, FrameInstance, MockupFrame } from "@/lib/types/editor";
import { parseAspectRatioOr } from "@/lib/render/aspectRatio";

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
  /** True for the browser frame: renderers draw the scene's browserUrl text
   *  over the skin's address pill (see lib/render/browserChrome.ts). */
  urlBar?: boolean;
}

/** ViewBox size used to convert cutout coordinates to frame percentages. */
export function frameViewBox(spec: FrameSpec): { w: number; h: number } {
  return spec.viewBox ?? DEFAULT_VIEWBOX;
}

/** Static frame specs for every built-in frame. The dynamic "custom" frame is
 *  resolved at render time from the uploaded skin via `customFrameSpec`, so it
 *  has no entry here. */
export const FRAME_SPECS: Record<Exclude<MockupFrame, "custom">, FrameSpec> = {
  none: { asset: null, padding: 0, screenRadius: 20, isOverlay: false, aspectRatio: null, cutout: null },
  iphone: {
    asset: "/devices/iphone.svg",
    padding: 0,
    screenRadius: 55,
    isOverlay: true,
    aspectRatio: "390 / 844",
    viewBox: { w: 390, h: 844 },
    // viewBox 390x844; screen rect x14 y14 w362 h816 rx55 (55pt corner radius)
    cutout: { x: 14, y: 14, w: 362, h: 816, rx: 55 }
  },
  iphone15: {
    asset: "/devices/iphone15.svg",
    padding: 14,
    screenRadius: 55,
    isOverlay: true,
    aspectRatio: "390 / 844",
    // viewBox 390x844; screen rect x14 y14 w362 h816 rx55 (55pt corner radius)
    cutout: { x: 14, y: 14, w: 362, h: 816, rx: 55 }
  },
  iphone16pro: {
    asset: "/devices/iphone16pro.svg",
    padding: 14,
    screenRadius: 55,
    isOverlay: true,
    aspectRatio: "402 / 874",
    // viewBox 402x874 (real logical size); screen rect x14 y14 w374 h846 rx55
    cutout: { x: 14, y: 14, w: 374, h: 846, rx: 55 },
    viewBox: { w: 402, h: 874 }
  },
  pixel8pro: {
    asset: "/devices/pixel8pro.svg",
    padding: 14,
    screenRadius: 34,
    isOverlay: true,
    aspectRatio: "448 / 996",
    viewBox: { w: 448, h: 996 },
    // viewBox 448x996; screen rect x14 y14 w420 h968 rx34 (Pixel corners are
    // tighter than the iPhone's — ~34pt rather than 55pt)
    cutout: { x: 14, y: 14, w: 420, h: 968, rx: 34 }
  },
  galaxy24: {
    asset: "/devices/galaxy24.svg",
    padding: 12,
    screenRadius: 22,
    isOverlay: true,
    aspectRatio: "360 / 780",
    viewBox: { w: 360, h: 780 },
    // viewBox 360x780; screen rect x12 y12 w336 h756 rx22 (Galaxy corners are
    // tighter than the iPhone's — ~22pt rather than 55pt)
    cutout: { x: 12, y: 12, w: 336, h: 756, rx: 22 }
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
    screenRadius: 16,
    isOverlay: true,
    aspectRatio: "834 / 1194",
    viewBox: { w: 834, h: 1194 },
    // viewBox 834x1194; screen rect x14 y14 w806 h1166 rx16 (iPad corners are
    // squarish rather than the iPhone's 55pt radius)
    cutout: { x: 14, y: 14, w: 806, h: 1166, rx: 16 }
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
  desktop: {
    asset: "/devices/desktop.svg",
    padding: 0,
    screenRadius: 8,
    isOverlay: true,
    aspectRatio: "16 / 10",
    viewBox: { w: 1600, h: 1000 },
    // viewBox 1600x1000; screen rect x40 y40 w1520 h840 rx8
    cutout: { x: 40, y: 40, w: 1520, h: 840, rx: 8 }
  },
  tablet: {
    asset: "/devices/tablet.svg",
    padding: 0,
    screenRadius: 24,
    isOverlay: true,
    aspectRatio: "4 / 3",
    viewBox: { w: 1200, h: 900 },
    // viewBox 1200x900; screen rect x40 y30 w1120 h840 rx24
    cutout: { x: 40, y: 30, w: 1120, h: 840, rx: 24 }
  },
  macbook: {
    asset: "/devices/macbook.svg",
    padding: 40,
    screenRadius: 6,
    isOverlay: true,
    aspectRatio: "1600 / 1074",
    // viewBox 1600x1074; screen rect x44 y34 w1512 h982 rx6 (14" MBP display)
    cutout: { x: 44, y: 34, w: 1512, h: 982, rx: 6 },
    viewBox: { w: 1600, h: 1074 }
  },
  imac: {
    asset: "/devices/imac.svg",
    padding: 70,
    screenRadius: 10,
    isOverlay: true,
    aspectRatio: "1600 / 1420",
    // viewBox 1600x1420; screen rect x70 y80 w1460 h821 rx10
    cutout: { x: 70, y: 80, w: 1460, h: 821, rx: 18 },
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
  browser: {
    asset: "/devices/browser.svg",
    padding: 0,
    screenRadius: 20,
    isOverlay: true,
    aspectRatio: "1440 / 1000",
    // viewBox 1440x1000; viewport fills the window below the toolbar
    // (y96). rx matches the window corners; the skin's toolbar fillets
    // cover the media's rounded top corners at the seam.
    cutout: { x: 0, y: 96, w: 1440, h: 904, rx: 20 },
    viewBox: { w: 1440, h: 1000 },
    urlBar: true
  },
  tv: {
    asset: "/devices/tv.svg",
    padding: 24,
    screenRadius: 12,
    isOverlay: true,
    aspectRatio: "1600 / 1000",
    // viewBox 1600x1000; screen rect x40 y24 w1520 h855 rx12 (16/9)
    cutout: { x: 40, y: 40, w: 1520, h: 855, rx: 6 },
    viewBox: { w: 1600, h: 1000 }
  },
  watchUltra: {
    asset: "/devices/watchUltra.svg",
    padding: 22,
    screenRadius: 82,
    isOverlay: true,
    aspectRatio: "410 / 502",
    // viewBox 410x502; screen rect x20 y24 w370 h454 rx82 (real 410x502 display)
    cutout: { x: 20, y: 24, w: 370, h: 454, rx: 82 },
    viewBox: { w: 410, h: 502 }
  },
  watch: {
    asset: "/devices/watch.svg",
    padding: 0,
    screenRadius: 90,
    isOverlay: true,
    aspectRatio: "396 / 484",
    // viewBox 396x484; screen rect x22 y27 w352 h430 rx90 (rounded rect, not a circle)
    cutout: { x: 22, y: 27, w: 352, h: 430, rx: 90 },
    viewBox: { w: 396, h: 484 }
  }
};

export function getFrameSpec(frame: MockupFrame, customFrame?: CustomFrame | null): FrameSpec {
  if (frame === "custom" && customFrame) return customFrameSpec(customFrame);
  return FRAME_SPECS[frame as Exclude<MockupFrame, "custom">] ?? FRAME_SPECS.none;
}

/** Height/width ratio (h/w) a frame instance adopts, or null when the frame
 *  follows the scene ("none"). Mirrors computeFrameInstances so auto-layouts
 *  can cap their scale to the exact box the renderer will produce. */
export function frameInstAr(
  frame: MockupFrame,
  customFrame?: CustomFrame | null,
  sceneAspectRatio = "16 / 9"
): number | null {
  const spec = getFrameSpec(frame, customFrame);
  const ratioSrc = spec.aspectRatio ?? (frame === "none" ? sceneAspectRatio : "1 / 1");
  const { w: rW, h: rH } = parseAspectRatioOr(ratioSrc);
  return rH / rW;
}

/** Box of a frame instance as fractions of the canvas width (w) and height
 *  (h), honoring landscape rotation. The two fractions relate to DIFFERENT
 *  axes, so a rotated box does not simply trade places: physically the box's
 *  width becomes the portrait height and vice versa. Mirrors
 *  computeFrameInstances so preview, guides, auto-layouts and exports share
 *  one source of truth. */
export function frameInstanceSize(
  inst: Pick<FrameInstance, "frame" | "scale" | "orientation">,
  customFrame?: CustomFrame | null,
  sceneAspectRatio = "16 / 9"
): { w: number; h: number } {
  const parsed = parseAspectRatioOr(sceneAspectRatio);
  const instAr = frameInstAr(inst.frame, customFrame, sceneAspectRatio) ?? 1;
  if (inst.orientation === "landscape") {
    // Physical: width' = portraitHeightPx, height' = portraitWidthPx.
    return { w: inst.scale * instAr, h: inst.scale * (parsed.w / parsed.h) };
  }
  return { w: inst.scale, h: inst.scale * instAr * (parsed.w / parsed.h) };
}

/** Half-extents of a frame instance's box as fractions of the canvas (w along
 *  the canvas width, h along the canvas height). The box is centered on the
 *  instance's (x, y). Mirrors computeFrameInstances so smart guides snap
 *  against the same box the renderer draws. */
export function frameInstanceHalfExtents(
  inst: Pick<FrameInstance, "frame" | "scale" | "orientation">,
  customFrame?: CustomFrame | null,
  sceneAspectRatio = "16 / 9"
): { w: number; h: number } {
  const size = frameInstanceSize(inst, customFrame, sceneAspectRatio);
  return { w: size.w / 2, h: size.h / 2 };
}

/** Builds a FrameSpec from a user-uploaded SVG skin. The media fills the whole
 *  viewBox behind the overlay; the SVG's transparent screen area is what shows
 *  it through, so the cutout defaults to the full viewBox (rx 0) and the SVG
 *  body does the shaping. */
export function customFrameSpec(customFrame: CustomFrame): FrameSpec {
  const vb = customFrame.viewBox;
  return {
    asset: customFrame.asset,
    padding: 0,
    screenRadius: 0,
    isOverlay: true,
    aspectRatio: `${vb.w} / ${vb.h}`,
    cutout: customFrame.cutout,
    viewBox: vb
  };
}

/** Every valid frame value, including the dynamic "custom" upload. Used by
 *  scene normalization so a share URL / stored scene can restore frame "custom"
 *  when its customFrame payload survives. */
export const ALL_FRAMES: MockupFrame[] = [...Object.keys(FRAME_SPECS) as MockupFrame[], "custom"];

/** Built-in frames shown in the picker (the dynamic "custom" upload is added
 *  separately by the FramePicker). */
export const FRAME_ORDER: Exclude<MockupFrame, "custom">[] = [
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
  "browser",
  "tv",
  "watchUltra",
  "watch"
];

export const ANIMATION_PRESETS: AnimationPreset[] = ["none", "zoomIn", "zoomOut", "parallax", "panLeft", "panRight", "breathe", "float", "sway"];

/** Aspect ratios selectable for the scene canvas. Kept here so the ControlPanel
 *  select and any preset/normalization code share a single source of truth. */
export const ASPECT_RATIOS = ["16 / 9", "4 / 3", "3 / 2", "1 / 1", "4 / 5", "2 / 3", "9 / 16"];

/** Operating system family a frame belongs to. Drives the on-screen chrome
 *  (status bar, home indicator, dock) so an Android phone doesn't get the iOS
 *  home indicator and a desktop frame doesn't get a mobile status bar. */
export type DeviceOS = "ios" | "android" | "desktop";

/** Maps a frame to its OS family for chrome rendering. */
export function frameOs(frame: MockupFrame | undefined): DeviceOS {
  switch (frame) {
    case "pixel8pro":
    case "galaxy24":
      return "android";
    case "desktop":
    case "tablet":
    case "notebook":
    case "browser":
    case "tv":
      return "desktop";
    default:
      return "ios";
  }
}
