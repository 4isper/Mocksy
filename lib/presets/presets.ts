import type { EditorScene, SceneStylePreset } from "@/lib/types/editor";

export type BackgroundKind = "transparent" | "solid" | "gradient" | "pattern";

export interface BackgroundPreset {
  id: string;
  kind: BackgroundKind;
  /** Solid color, or the gradient's starting color (used for the swatch). */
  swatch: string;
  backgroundColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  patternId?: import("@/lib/types/editor").PatternId;
}

export const backgroundPresets: BackgroundPreset[] = [
  { id: "transparent", kind: "transparent", swatch: "transparent" },
  { id: "zinc", kind: "solid", swatch: "#09090b", backgroundColor: "#09090b" },
  { id: "slate", kind: "solid", swatch: "#0f172a", backgroundColor: "#0f172a" },
  { id: "rose", kind: "solid", swatch: "#4c0519", backgroundColor: "#4c0519" },
  { id: "emerald", kind: "solid", swatch: "#022c22", backgroundColor: "#022c22" },
  { id: "indigo", kind: "solid", swatch: "#1e1b4b", backgroundColor: "#1e1b4b" },
  { id: "amber", kind: "solid", swatch: "#451a03", backgroundColor: "#451a03" },
  { id: "ivory", kind: "solid", swatch: "#faf9f6", backgroundColor: "#faf9f6" },
  { id: "blue-violet", kind: "gradient", swatch: "#1d4ed8", gradientFrom: "#1d4ed8", gradientTo: "#7c3aed" },
  { id: "sunset", kind: "gradient", swatch: "#f97316", gradientFrom: "#f97316", gradientTo: "#db2777" },
  { id: "mint", kind: "gradient", swatch: "#059669", gradientFrom: "#059669", gradientTo: "#0ea5e9" },
  { id: "ocean", kind: "gradient", swatch: "#06b6d4", gradientFrom: "#06b6d4", gradientTo: "#3b82f6" },
  { id: "aurora", kind: "gradient", swatch: "#10b981", gradientFrom: "#10b981", gradientTo: "#22d3ee" },
  { id: "candy", kind: "gradient", swatch: "#f472b6", gradientFrom: "#f472b6", gradientTo: "#c084fc" },
  { id: "fire", kind: "gradient", swatch: "#ef4444", gradientFrom: "#ef4444", gradientTo: "#f59e0b" },
  { id: "ice", kind: "gradient", swatch: "#e0f2fe", gradientFrom: "#e0f2fe", gradientTo: "#bae6fd" },
  { id: "dots", kind: "pattern", swatch: "#18181b", patternId: "dots" },
  { id: "grid", kind: "pattern", swatch: "#18181b", patternId: "grid" },
  { id: "diagonal", kind: "pattern", swatch: "#18181b", patternId: "diagonal" },
  { id: "noise", kind: "pattern", swatch: "#18181b", patternId: "noise" },
  { id: "plus", kind: "pattern", swatch: "#18181b", patternId: "plus" },
  { id: "cross", kind: "pattern", swatch: "#18181b", patternId: "cross" },
  { id: "triangle", kind: "pattern", swatch: "#18181b", patternId: "triangle" }
];

/** Named appearance presets. Each carries the scene's frame, frame style,
 *  background, shadow and watermark — but never the media layers — so
 *  applying one restyles the mockup in one click without dropping the
 *  user's uploaded photo or video. */
export const sceneStylePresets: SceneStylePreset[] = [
  {
    id: "dark-studio",
    frame: "iphone",
    stylePreset: "default",
    backgroundMode: "solid",
    backgroundColor: "#09090b",
    gradientFrom: "#09090b",
    gradientTo: "#09090b",
    gradientVia: null,
    gradientType: "linear",
    shadowOpacity: 0.45,
    borderRadius: 20,
    watermarkEnabled: false,
    watermarkText: "Mocksy",
    watermarkPosition: "bottom-right",
    watermarkSize: 13
  },
  {
    id: "soft-glass",
    frame: "iphone16pro",
    stylePreset: "glassLight",
    backgroundMode: "gradient",
    backgroundColor: "#1d4ed8",
    gradientFrom: "#1d4ed8",
    gradientTo: "#7c3aed",
    gradientVia: null,
    gradientType: "linear",
    shadowOpacity: 0.4,
    borderRadius: 28,
    watermarkEnabled: false,
    watermarkText: "Mocksy",
    watermarkPosition: "bottom-right",
    watermarkSize: 13
  },
  {
    id: "bold-gradient",
    frame: "desktop",
    stylePreset: "glassDark",
    backgroundMode: "gradient",
    backgroundColor: "#f97316",
    gradientFrom: "#f97316",
    gradientTo: "#db2777",
    gradientVia: null,
    gradientType: "linear",
    shadowOpacity: 0.5,
    borderRadius: 16,
    watermarkEnabled: true,
    watermarkText: "Made with Mocksy",
    watermarkPosition: "bottom-right",
    watermarkSize: 14
  },
  {
    id: "minimal",
    frame: "none",
    stylePreset: "default",
    backgroundMode: "solid",
    backgroundColor: "#ffffff",
    gradientFrom: "#ffffff",
    gradientTo: "#ffffff",
    gradientVia: null,
    gradientType: "linear",
    shadowOpacity: 0.12,
    borderRadius: 8,
    watermarkEnabled: false,
    watermarkText: "Mocksy",
    watermarkPosition: "bottom-right",
    watermarkSize: 12
  },
  {
    id: "warm",
    frame: "iphone15",
    stylePreset: "glassDark",
    backgroundMode: "gradient",
    backgroundColor: "#f59e0b",
    gradientFrom: "#f59e0b",
    gradientTo: "#ef4444",
    gradientVia: null,
    gradientType: "linear",
    shadowOpacity: 0.42,
    borderRadius: 24,
    watermarkEnabled: false,
    watermarkText: "Mocksy",
    watermarkPosition: "bottom-left",
    watermarkSize: 13
  }
];

/** Returns the scene-appearance fields defined by a style preset. Media
 *  layers and aspect ratio are intentionally left out so callers apply the
 *  result via setScene without disturbing the active media. */
export function applySceneStylePreset(preset: SceneStylePreset): Partial<EditorScene> {
  return {
    frame: preset.frame,
    stylePreset: preset.stylePreset,
    backgroundMode: preset.backgroundMode,
    backgroundColor: preset.backgroundColor,
    gradientFrom: preset.gradientFrom,
    gradientTo: preset.gradientTo,
    gradientVia: preset.gradientVia,
    gradientType: preset.gradientType,
    shadowOpacity: preset.shadowOpacity,
    borderRadius: preset.borderRadius,
    watermarkEnabled: preset.watermarkEnabled,
    watermarkText: preset.watermarkText,
    watermarkPosition: preset.watermarkPosition,
    watermarkSize: preset.watermarkSize
  };
}

const SURPRISE_STYLE_PRESETS: EditorScene["stylePreset"][] = ["default", "glassLight", "glassDark", "outline"];
const SURPRISE_RADII = [8, 12, 16, 20, 24, 28, 36];

function pick<T>(arr: readonly T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

/**
 * Builds a random scene appearance for the "Surprise me" action: a random
 * frame style, a solid/gradient/pattern background sampled from the built-in
 * swatches, and matching shadow/corner values. Deliberately leaves media
 * layers, the device frame choice, the watermark and annotations untouched —
 * it restyles the scene without changing its content. Pure: takes an optional
 * RNG so tests (and future replay) can be deterministic.
 */
export function randomSceneStyle(rand: () => number = Math.random): Partial<EditorScene> {
  const stylePreset = pick(SURPRISE_STYLE_PRESETS, rand);
  const roll = rand();

  if (roll < 0.5) {
    // Gradient backgrounds get a 50% share — they are the most visual.
    const gradients = backgroundPresets.filter((p) => p.kind === "gradient");
    const g = pick(gradients, rand);
    return {
      stylePreset,
      backgroundMode: "gradient",
      backgroundColor: g.swatch,
      gradientFrom: g.gradientFrom!,
      gradientTo: g.gradientTo!,
      gradientVia: null,
      gradientType: rand() < 0.75 ? "linear" : "radial",
      gradientAngle: Math.floor(rand() * 360),
      shadowOpacity: Math.round((0.2 + rand() * 0.4) * 100) / 100,
      borderRadius: pick(SURPRISE_RADII, rand)
    };
  }

  if (roll < 0.8) {
    const solids = backgroundPresets.filter((p) => p.kind === "solid");
    const s = pick(solids, rand);
    return {
      stylePreset,
      backgroundMode: "solid",
      backgroundColor: s.backgroundColor!,
      shadowOpacity: Math.round((0.2 + rand() * 0.4) * 100) / 100,
      borderRadius: pick(SURPRISE_RADII, rand)
    };
  }

  const patterns = backgroundPresets.filter((p) => p.kind === "pattern");
  return {
    stylePreset,
    backgroundMode: "pattern",
    patternId: pick(patterns, rand).patternId!,
    shadowOpacity: Math.round((0.2 + rand() * 0.4) * 100) / 100,
    borderRadius: pick(SURPRISE_RADII, rand)
  };
}

