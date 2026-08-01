import type { EditorScene, SceneStylePreset } from "@/lib/types/editor";

export type BackgroundKind = "transparent" | "solid" | "gradient" | "pattern";

export interface BackgroundPreset {
  id: string;
  name: string;
  kind: BackgroundKind;
  /** Solid color, or the gradient's starting color (used for the swatch). */
  swatch: string;
  backgroundColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  patternId?: import("@/lib/types/editor").PatternId;
}

export const backgroundPresets: BackgroundPreset[] = [
  { id: "transparent", name: "Transparent", kind: "transparent", swatch: "transparent" },
  { id: "zinc", name: "Zinc", kind: "solid", swatch: "#09090b", backgroundColor: "#09090b" },
  { id: "slate", name: "Slate", kind: "solid", swatch: "#0f172a", backgroundColor: "#0f172a" },
  { id: "rose", name: "Rose", kind: "solid", swatch: "#4c0519", backgroundColor: "#4c0519" },
  { id: "blue-violet", name: "Blue → Violet", kind: "gradient", swatch: "#1d4ed8", gradientFrom: "#1d4ed8", gradientTo: "#7c3aed" },
  { id: "sunset", name: "Sunset", kind: "gradient", swatch: "#f97316", gradientFrom: "#f97316", gradientTo: "#db2777" },
  { id: "mint", name: "Mint", kind: "gradient", swatch: "#059669", gradientFrom: "#059669", gradientTo: "#0ea5e9" },
  { id: "dots", name: "Dots", kind: "pattern", swatch: "#18181b", patternId: "dots" },
  { id: "grid", name: "Grid", kind: "pattern", swatch: "#18181b", patternId: "grid" },
  { id: "diagonal", name: "Diagonal", kind: "pattern", swatch: "#18181b", patternId: "diagonal" },
  { id: "noise", name: "Noise", kind: "pattern", swatch: "#18181b", patternId: "noise" }
];

/** Named appearance presets. Each carries the scene's frame, frame style,
 *  background, shadow and watermark — but never the media layers — so
 *  applying one restyles the mockup in one click without dropping the
 *  user's uploaded photo or video. */
export const sceneStylePresets: SceneStylePreset[] = [
  {
    id: "dark-studio",
    name: "Dark Studio",
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
    name: "Soft Glass",
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
    name: "Bold Gradient",
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
    name: "Minimal",
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
    name: "Warm",
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

