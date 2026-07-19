import type { AnimationPreset, MockupFrame, StylePreset } from "@/lib/types/editor";

export interface TemplatePreset {
  id: string;
  name: string;
  frame: MockupFrame;
  stylePreset: StylePreset;
  animationPreset: AnimationPreset;
  zoom: number;
}

export const templatePresets: TemplatePreset[] = [
  { id: "hero-glass", name: "Hero Glass", frame: "iphone", stylePreset: "glassLight", animationPreset: "zoomIn", zoom: 1.1 },
  { id: "dark-product", name: "Dark Product", frame: "desktop", stylePreset: "glassDark", animationPreset: "parallax", zoom: 1.03 },
  { id: "minimal", name: "Minimal", frame: "none", stylePreset: "default", animationPreset: "none", zoom: 1 },
  { id: "iphone15-zoom", name: "iPhone 15 Zoom", frame: "iphone15", stylePreset: "default", animationPreset: "zoomIn", zoom: 1.05 },
  { id: "iphone16pro-glass", name: "16 Pro Glass", frame: "iphone16pro", stylePreset: "glassLight", animationPreset: "parallax", zoom: 1.04 }
];
