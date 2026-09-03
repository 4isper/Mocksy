import type { EditorScene, MockupFrame, ScreenChrome } from "@/lib/types/editor";
import { ASPECT_RATIOS } from "@/lib/render/frames";
import { layoutFrameGrid } from "@/lib/state/editorHelpers";
import { makeDemoLayer, nextLayerId } from "@/lib/state/editorHelpers";
import { NOTIFICATION_APPS } from "@/lib/render/screenChrome";

/** Default screen decoration. Exported so normalization can fall back to it. */
export const DEFAULT_SCREEN_CHROME: ScreenChrome = {
  enabled: false,
  style: "lock",
  theme: "dark",
  showStatusBar: true,
  showClock: true,
  showDate: true,
  showNotifications: false,
  showLockShortcuts: true,
  showDock: true,
  showHomeIndicator: true,
  time: "9:41",
  date: "Tuesday, August 4",
  clockSizeFactor: 0.105,
  clockYFactor: 0.175,
  clockColor: null,
  dockBackground: null,
  dockColors: null,
  dockIcons: null,
  androidGridIcons: null,
  gridCols: null,
  gridRows: null,
  folders: null,
  widgets: null,
  notifications: NOTIFICATION_APPS
};

/** Default URL shown in the browser frame's address bar. */
export const DEFAULT_BROWSER_URL = "mocksy.app";

export const initialScene: EditorScene = {
  // Deterministic id: this module-level scene is rendered during SSR, and a
  // Date.now-based id would differ between server and client HTML.
  layers: [makeDemoLayer("layer-demo")],
  activeLayerId: null,
  frame: "iphone",
  frameInstances: [],
  customFrame: null,
  stylePreset: "default",
  shadowOpacity: 0.4,
  borderRadius: 20,
  tiltX: 0,
  tiltY: 0,
  backgroundMode: "gradient",
  backgroundColor: "#111827",
  gradientFrom: "#1d4ed8",
  gradientTo: "#7c3aed",
  gradientVia: null,
  gradientType: "linear",
  gradientAngle: 120,
  patternId: null,
  backgroundImageUrl: null,
  backgroundBlur: 0,
  backgroundAudioUrl: null,
  backgroundAudioName: null,
  audioFadeIn: 0,
  audioFadeOut: 0,
  annotations: [],
  watermarkText: "Mocksy",
  watermarkEnabled: false,
  watermarkPosition: "bottom-right",
  watermarkSize: 13,
  watermarkImageUrl: null,
  aspectRatio: ASPECT_RATIOS[0] ?? "16 / 9",
  animationDurationMs: 3000,
  screen: DEFAULT_SCREEN_CHROME,
  screenGlare: false,
  floorReflection: false,
  browserUrl: DEFAULT_BROWSER_URL,
  browserChromeTheme: "light"
};
// The first layer is the active one by default.
initialScene.activeLayerId = initialScene.layers[0]?.id ?? null;

/**
 * A blank canvas: the same defaults as a fresh app (background, frame, style,
 * screen chrome) but no layers, no frame instances, no annotations or media.
 * Used by the reset action so "reset" means a clean slate instead of another
 * round of demo content.
 */
export function buildEmptyScene(): EditorScene {
  return {
    ...initialScene,
    layers: [],
    frameInstances: [],
    annotations: [],
    activeLayerId: null
  };
}

/**
 * A fresh scene seeded with a grid of demo layers and matching frame
 * instances. Shared by the editor bootstrap and the projects store so every
 * "new" scene starts from the same default.
 */
export function buildFreshScene(
  frame: MockupFrame = "iphone",
  count = 2,
  direction: "horizontal" | "vertical" = "horizontal"
): EditorScene {
  const instances = layoutFrameGrid(frame, count, direction, initialScene.aspectRatio, null);
  const layers = Array.from({ length: count }, () => ({
    ...makeDemoLayer(),
    id: nextLayerId()
  }));
  const frameInstances = instances.map((inst, i) => ({
    ...inst,
    layerId: layers[i]?.id ?? null
  }));
  return {
    ...initialScene,
    layers,
    frameInstances,
    activeLayerId: layers[0]?.id ?? null,
    annotations: []
  };
}

/**
 * The default demo scene used when there is no saved project: a 2-frame
 * horizontal grid so first-time visitors immediately see the multi-frame
 * capability.
 */
export function makeDemoScene(): EditorScene {
  return buildFreshScene();
}

/**
 * Upgrades a legacy single-frame scene (no `frameInstances`, device type held
 * only in top-level `frame`) to a single movable instance. Such scenes arise
 * from old autosaves / share URLs / the pre-hydration `initialScene`: the
 * device renders centered but cannot be moved or scaled, the frames list stays
 * hidden, and annotations can paint behind it. A migrated scene behaves exactly
 * like a multi-frame scene with one device — the case users confirm works.
 *
 * Empty scenes (no layers, e.g. after reset) and frameless (`frame: "none"`)
 * scenes are left untouched: there is no device to make movable.
 */
export function upgradeLegacySingleFrameScene(scene: EditorScene): EditorScene {
  if (scene.frameInstances.length > 0) return scene;
  if (scene.frame === "none") return scene;
  if (scene.layers.length === 0) return scene;
  const [pos] = layoutFrameGrid(scene.frame, 1, "horizontal", scene.aspectRatio, scene.customFrame);
  if (!pos) return scene;
  return {
    ...scene,
    frameInstances: [{ ...pos, layerId: scene.activeLayerId ?? scene.layers[0]?.id ?? null }]
  };
}
