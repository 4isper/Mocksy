import { ASPECT_RATIOS } from "@/lib/render/frames";

/**
 * Well-known export sizes for distribution platforms (App Store review
 * screenshots, Dribbble shots, X posts, Open Graph previews, Instagram).
 * Applying a preset sets both the exact pixel size and the closest supported
 * scene aspect ratio, so the composition fills the canvas instead of being
 * letterboxed by the custom-size fit logic.
 */
export interface PlatformPreset {
  id: string;
  width: number;
  height: number;
}

export const PLATFORM_PRESETS: PlatformPreset[] = [
  { id: "appStorePhone", width: 1290, height: 2796 },
  { id: "appStoreIpad", width: 2064, height: 2752 },
  { id: "dribbbleShot", width: 1600, height: 1200 },
  { id: "xPost", width: 1600, height: 900 },
  { id: "ogImage", width: 1200, height: 630 },
  { id: "instagramSquare", width: 1080, height: 1080 },
  { id: "instagramPortrait", width: 1080, height: 1350 },
  { id: "story", width: 1080, height: 1920 }
];

/** Upper bound shared with the custom-size inputs in ExportDialog. */
export const MAX_EXPORT_DIMENSION = 8192;

/** Finds the scene aspect ratio whose proportion is nearest to w:h. */
export function closestAspectRatio(width: number, height: number): string {
  if (!(width > 0) || !(height > 0)) return ASPECT_RATIOS[0] ?? "16 / 9";
  const target = width / height;
  let best = ASPECT_RATIOS[0] ?? "16 / 9";
  let bestDiff = Infinity;
  for (const ratio of ASPECT_RATIOS) {
    const parts = ratio.split("/");
    const w = Number(parts[0]);
    const h = Number(parts[1]);
    if (!(w > 0) || !(h > 0)) continue;
    const diff = Math.abs(target - w / h);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = ratio;
    }
  }
  return best;
}

export function findPlatformPreset(id: string): PlatformPreset | undefined {
  return PLATFORM_PRESETS.find((p) => p.id === id);
}
