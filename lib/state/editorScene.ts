import type { EditorScene, MockupFrame, ScreenChrome } from "@/lib/types/editor";
import { ASPECT_RATIOS } from "@/lib/render/frames";
import { layoutFrameGrid } from "@/lib/state/editorHelpers";
import { makeDemoLayer, nextLayerId } from "@/lib/state/editorHelpers";

/** Default screen decoration. Exported so normalization can fall back to it. */
export const DEFAULT_SCREEN_CHROME: ScreenChrome = {
  enabled: false,
  style: "lock",
  theme: "dark",
  showStatusBar: true,
  showClock: true,
  showDate: true,
  showDock: true,
  showHomeIndicator: true,
  time: "9:41",
  date: "Tuesday, August 4"
};

/** Default URL shown in the browser frame's address bar. */
export const DEFAULT_BROWSER_URL = "mocksy.app";

export const initialScene: EditorScene = {
  layers: [makeDemoLayer()],
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
  annotations: [],
  watermarkText: "Mocksy",
  watermarkEnabled: false,
  watermarkPosition: "bottom-right",
  watermarkSize: 13,
  watermarkImageUrl: null,
  aspectRatio: ASPECT_RATIOS[0] ?? "16 / 9",
  animationDurationMs: 3000,
  screen: DEFAULT_SCREEN_CHROME,
  browserUrl: DEFAULT_BROWSER_URL
};
// The first layer is the active one by default.
initialScene.activeLayerId = initialScene.layers[0]?.id ?? null;

/**
 * A fresh scene seeded with a grid of demo layers and matching frame
 * instances. Shared by the editor bootstrap, the projects store and the
 * reset action so every "new" scene starts from the same default.
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
