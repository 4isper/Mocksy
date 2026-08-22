import type { EditorScene } from "@/lib/types/editor";
import { DEFAULT_SCREEN_CHROME, initialScene } from "@/lib/state/editorScene";
import { makeDemoLayer } from "@/lib/state/layerHelpers";
import { nextFrameInstanceId } from "@/lib/state/ids";
import { frameInstAr } from "@/lib/render/frames";

/** Canvas size of the generated social-preview image (scripts/generate-og.mjs
 *  screenshots the /og route at exactly this viewport). */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/**
 * The scene rendered on the /og route for the social preview image: two
 * flagship phones side by side with demo media, screen chrome and glare on
 * the default gradient — the editor's first-run look, hand-placed so the pair
 * sits large and centered on the wide canvas. Derived from initialScene so it
 * always reflects real defaults.
 */
export function buildOgScene(): EditorScene {
  const aspectRatio = `${OG_IMAGE_WIDTH} / ${OG_IMAGE_HEIGHT}`;
  const layers = [makeDemoLayer(), makeDemoLayer()];
  // Scale that fills the canvas height exactly (see layoutFrameGrid's cap),
  // pulled in to leave breathing room; x places the pair around the center.
  const instAr = frameInstAr("iphone16pro", null, aspectRatio) ?? 390 / 844;
  const scale = (1 / ((OG_IMAGE_WIDTH / OG_IMAGE_HEIGHT) * instAr)) * 0.9;
  const frameInstances = [-0.135, 0.135].map((dx, i) => ({
    id: nextFrameInstanceId(),
    frame: "iphone16pro" as const,
    x: 0.5 + dx,
    y: 0.5,
    scale,
    layerId: layers[i]?.id ?? null
  }));
  return {
    ...initialScene,
    layers,
    frameInstances,
    activeLayerId: layers[0]?.id ?? null,
    annotations: [],
    shadowOpacity: 0.5,
    screenGlare: true,
    screen: { ...DEFAULT_SCREEN_CHROME, enabled: true }
  };
}
