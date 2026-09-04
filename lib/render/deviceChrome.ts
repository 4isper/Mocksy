import type { MockupFrame } from "@/lib/types/editor";

/** Per-frame chrome layout spec. All coordinates are fractions of the chrome
 *  box (the screen cutout or CSS-only frame rect) passed to the renderers. */
export interface ChromeSpec {
  /** Status bar: baseline Y for the time text (fraction of h). */
  statusBarTimeY: number;
  /** Status bar: left offset for the time text (fraction of w). */
  statusBarTimeX: number;
  /** Status bar: font size (fraction of h). */
  statusBarFontSize: number;
  /** Status bar: right cluster (wifi/signal/battery) starts at this inset from
   *  the right edge (fraction of w). */
  statusBarRightInset: number;
  /** Home indicator at the bottom of the screen, or null (e.g. iPhone SE with
   *  a physical home button). */
  homeIndicator: { bottomOffset: number; width: number; height: number } | null;
  /** Dock geometry for the home screen. */
  dock: { bottomOffset: number; height: number; iconSize: number };
  /** Whether lock-screen shortcuts (flashlight/camera) are rendered. */
  lockShortcuts: boolean;
  /** Default clock Y position factor for lock screens (fraction of h). */
  clockYFactor: number;
  /** Default clock font-size factor for lock screens (fraction of h). */
  clockSizeFactor: number;
}

/* ── Per-frame specs ──────────────────────────────────────────────────── */

const IPHONE_14: ChromeSpec = {
  statusBarTimeY: 0.04,
  statusBarTimeX: 0.055,
  statusBarFontSize: 0.018,
  statusBarRightInset: 0.05,
  homeIndicator: { bottomOffset: 0.04, width: 0.36, height: 0.009 },
  dock: { bottomOffset: 0.064, height: 0.112, iconSize: 0.15 },
  lockShortcuts: true,
  clockYFactor: 0.175,
  clockSizeFactor: 0.105,
};

const IPHONE_15: ChromeSpec = {
  statusBarTimeY: 0.026,
  statusBarTimeX: 0.052,
  statusBarFontSize: 0.018,
  statusBarRightInset: 0.052,
  homeIndicator: { bottomOffset: 0.016, width: 0.36, height: 0.009 },
  dock: { bottomOffset: 0.064, height: 0.112, iconSize: 0.15 },
  lockShortcuts: true,
  clockYFactor: 0.175,
  clockSizeFactor: 0.105,
};

const IPHONE_16_PRO: ChromeSpec = {
  statusBarTimeY: 0.026,
  statusBarTimeX: 0.05,
  statusBarFontSize: 0.018,
  statusBarRightInset: 0.05,
  homeIndicator: { bottomOffset: 0.016, width: 0.346, height: 0.008 },
  dock: { bottomOffset: 0.064, height: 0.112, iconSize: 0.15 },
  lockShortcuts: true,
  clockYFactor: 0.175,
  clockSizeFactor: 0.105,
};

const PIXEL_8_PRO: ChromeSpec = {
  statusBarTimeY: 0.03,
  statusBarTimeX: 0.14,
  statusBarFontSize: 0.017,
  statusBarRightInset: 0.05,
  homeIndicator: { bottomOffset: 0.016, width: 0.22, height: 0.006 },
  dock: { bottomOffset: 0.064, height: 0.1, iconSize: 0.13 },
  lockShortcuts: false,
  clockYFactor: 0.16,
  clockSizeFactor: 0.09,
};

const GALAXY_24: ChromeSpec = {
  statusBarTimeY: 0.03,
  statusBarTimeX: 0.05,
  statusBarFontSize: 0.017,
  statusBarRightInset: 0.05,
  homeIndicator: { bottomOffset: 0.016, width: 0.22, height: 0.006 },
  dock: { bottomOffset: 0.064, height: 0.1, iconSize: 0.13 },
  lockShortcuts: false,
  clockYFactor: 0.16,
  clockSizeFactor: 0.09,
};

const IPHONE_SE: ChromeSpec = {
  statusBarTimeY: 0.028,
  statusBarTimeX: 0.06,
  statusBarFontSize: 0.018,
  statusBarRightInset: 0.06,
  homeIndicator: null,
  dock: { bottomOffset: 0.06, height: 0.11, iconSize: 0.15 },
  lockShortcuts: false,
  clockYFactor: 0.2,
  clockSizeFactor: 0.1,
};

const IPAD: ChromeSpec = {
  statusBarTimeY: 0.022,
  statusBarTimeX: 0.04,
  statusBarFontSize: 0.016,
  statusBarRightInset: 0.04,
  homeIndicator: null,
  dock: { bottomOffset: 0.05, height: 0.09, iconSize: 0.09 },
  lockShortcuts: false,
  clockYFactor: 0.18,
  clockSizeFactor: 0.1,
};

const GALAXY_TAB: ChromeSpec = {
  statusBarTimeY: 0.022,
  statusBarTimeX: 0.04,
  statusBarFontSize: 0.016,
  statusBarRightInset: 0.04,
  homeIndicator: null,
  dock: { bottomOffset: 0.05, height: 0.09, iconSize: 0.09 },
  lockShortcuts: false,
  clockYFactor: 0.18,
  clockSizeFactor: 0.1,
};

const DESKTOP: ChromeSpec = {
  statusBarTimeY: 0.03,
  statusBarTimeX: 0.04,
  statusBarFontSize: 0.018,
  statusBarRightInset: 0.04,
  homeIndicator: null,
  dock: { bottomOffset: 0.06, height: 0.1, iconSize: 0.12 },
  lockShortcuts: false,
  clockYFactor: 0.18,
  clockSizeFactor: 0.1,
};

const WATCH: ChromeSpec = {
  statusBarTimeY: 0.03,
  statusBarTimeX: 0.06,
  statusBarFontSize: 0.02,
  statusBarRightInset: 0.06,
  homeIndicator: null,
  dock: { bottomOffset: 0.06, height: 0.1, iconSize: 0.14 },
  lockShortcuts: false,
  clockYFactor: 0.22,
  clockSizeFactor: 0.12,
};

const FRAME_CHROME: Record<string, ChromeSpec> = {
  iphone: IPHONE_14,
  iphone15: IPHONE_15,
  iphone16pro: IPHONE_16_PRO,
  pixel8pro: PIXEL_8_PRO,
  galaxy24: GALAXY_24,
  iphoneSE: IPHONE_SE,
  ipad: IPAD,
  galaxyTab: GALAXY_TAB,
  desktop: DESKTOP,
  tablet: DESKTOP,
  macbook: DESKTOP,
  imac: DESKTOP,
  notebook: DESKTOP,
  browser: DESKTOP,
  tv: DESKTOP,
  watch: WATCH,
  watchUltra: WATCH,
};

const DEFAULT_CHROME: ChromeSpec = {
  statusBarTimeY: 0.026,
  statusBarTimeX: 0.062,
  statusBarFontSize: 0.021,
  statusBarRightInset: 0.05,
  homeIndicator: { bottomOffset: 0.016, width: 0.36, height: 0.009 },
  dock: { bottomOffset: 0.064, height: 0.112, iconSize: 0.15 },
  lockShortcuts: true,
  clockYFactor: 0.175,
  clockSizeFactor: 0.105,
};

/** Returns per-frame chrome metrics for rendering the on-screen decoration. */
export function getChromeSpec(frame: MockupFrame | undefined): ChromeSpec {
  if (!frame) return DEFAULT_CHROME;
  return FRAME_CHROME[frame] ?? DEFAULT_CHROME;
}
