import type { AnimationPreset, MockupFrame, StylePreset } from "@/lib/types/editor";

export interface TemplatePreset {
  id: string;
  name: string;
  description: string;
  frame: MockupFrame;
  stylePreset: StylePreset;
  animationPreset: AnimationPreset;
  zoom: number;
}

export const templatePresets: TemplatePreset[] = [
  { id: "hero-glass", name: "Hero Glass", description: "Light glass iPhone, zoom-in", frame: "iphone", stylePreset: "glassLight", animationPreset: "zoomIn", zoom: 1.1 },
  { id: "dark-product", name: "Dark Product", description: "Dark glass desktop, parallax", frame: "desktop", stylePreset: "glassDark", animationPreset: "parallax", zoom: 1.03 },
  { id: "minimal", name: "Minimal", description: "Clean, no frame", frame: "none", stylePreset: "default", animationPreset: "none", zoom: 1 },
  { id: "iphone15-zoom", name: "iPhone 15 Zoom", description: "iPhone 15, zoom-in", frame: "iphone15", stylePreset: "default", animationPreset: "zoomIn", zoom: 1.05 },
  { id: "iphone16pro-glass", name: "16 Pro Glass", description: "16 Pro glass, parallax", frame: "iphone16pro", stylePreset: "glassLight", animationPreset: "parallax", zoom: 1.04 }
];

export type BackgroundKind = "transparent" | "solid" | "gradient";

export interface BackgroundPreset {
  id: string;
  name: string;
  kind: BackgroundKind;
  /** Solid color, or the gradient's starting color (used for the swatch). */
  swatch: string;
  backgroundColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
}

export const backgroundPresets: BackgroundPreset[] = [
  { id: "transparent", name: "Transparent", kind: "transparent", swatch: "transparent" },
  { id: "zinc", name: "Zinc", kind: "solid", swatch: "#09090b", backgroundColor: "#09090b" },
  { id: "slate", name: "Slate", kind: "solid", swatch: "#0f172a", backgroundColor: "#0f172a" },
  { id: "rose", name: "Rose", kind: "solid", swatch: "#4c0519", backgroundColor: "#4c0519" },
  { id: "blue-violet", name: "Blue → Violet", kind: "gradient", swatch: "#1d4ed8", gradientFrom: "#1d4ed8", gradientTo: "#7c3aed" },
  { id: "sunset", name: "Sunset", kind: "gradient", swatch: "#f97316", gradientFrom: "#f97316", gradientTo: "#db2777" },
  { id: "mint", name: "Mint", kind: "gradient", swatch: "#059669", gradientFrom: "#059669", gradientTo: "#0ea5e9" }
];
