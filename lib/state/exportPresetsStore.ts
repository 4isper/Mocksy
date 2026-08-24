"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ExportFormat, ExportPreset, ExportSize } from "@/lib/types/editor";

/**
 * Saved export-dialog configurations ("PNG 2×", "MP4 1280×720", …). Lives in
 * localStorage outside the scene: presets are a device-level preference, not
 * part of the mockup, so they must not churn undo history or share URLs.
 */

/** Upper bound so a runaway UI can't bloat the storage entry. */
export const MAX_EXPORT_PRESETS = 12;

const FORMAT_LABELS: Record<ExportFormat, string> = {
  png: "PNG",
  webp: "WebP",
  svg: "SVG",
  html: "HTML",
  mp4: "MP4",
  webm: "WebM",
  gif: "GIF",
  webpAnim: "WebP",
  pdf: "PDF",
  zip: "ZIP"
};

/** Human-readable preset label derived from the settings it captures. */
export function presetLabel(format: ExportFormat, scale: 1 | 2 | 4, customSize: ExportSize | null): string {
  const base = FORMAT_LABELS[format] ?? String(format).toUpperCase();
  if (customSize && customSize.width > 0 && customSize.height > 0) {
    return `${base} ${customSize.width}×${customSize.height}`;
  }
  return `${base} ${scale}×`;
}

export interface ExportPresetsState {
  presets: ExportPreset[];
  savePreset: (format: ExportFormat, scale: 1 | 2 | 4, customSize: ExportSize | null) => void;
  removePreset: (id: string) => void;
}

export const useExportPresetsStore = create<ExportPresetsState>()(
  persist(
    (set) => ({
      presets: [],
      savePreset: (format, scale, customSize) =>
        set((s) => {
          const label = presetLabel(format, scale, customSize);
          // Re-saving identical settings refreshes nothing — avoid duplicates.
          if (s.presets.some((p) => p.format === format && p.scale === scale && sameSize(p.customSize, customSize))) {
            return {};
          }
          // Newest first; drop the oldest beyond the cap.
          const next = [
            { id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label, format, scale, customSize },
            ...s.presets
          ].slice(0, MAX_EXPORT_PRESETS);
          return { presets: next };
        }),
      removePreset: (id) => set((s) => ({ presets: s.presets.filter((p) => p.id !== id) }))
    }),
    { name: "mocksy-export-presets", partialize: (state) => ({ presets: state.presets }) }
  )
);

function sameSize(a: ExportSize | null, b: ExportSize | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.width === b.width && a.height === b.height;
}
