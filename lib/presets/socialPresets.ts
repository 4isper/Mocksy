/** A one-click canvas preset tuned for a social media format: an aspect ratio
 *  for the scene canvas plus the recommended pixel size for raster exports. */
export interface SocialPreset {
  id: string;
  /** Scene aspect ratio in "W / H" format (e.g. "4 / 5"). */
  aspectRatio: string;
  /** Recommended export width in px (sets customExportSize). */
  width: number;
  /** Recommended export height in px. */
  height: number;
}

export const SOCIAL_PRESETS: SocialPreset[] = [
  { id: "instagramPost", aspectRatio: "1 / 1", width: 1080, height: 1080 },
  { id: "instagramPortrait", aspectRatio: "4 / 5", width: 1080, height: 1350 },
  { id: "instagramStory", aspectRatio: "9 / 16", width: 1080, height: 1920 },
  { id: "facebookPost", aspectRatio: "16 / 9", width: 1280, height: 720 },
  { id: "xPost", aspectRatio: "16 / 9", width: 1600, height: 900 },
  { id: "linkedinPost", aspectRatio: "16 / 9", width: 1200, height: 675 },
  { id: "pinterest", aspectRatio: "2 / 3", width: 1000, height: 1500 },
  { id: "youtubeThumbnail", aspectRatio: "16 / 9", width: 1280, height: 720 }
];

/** Parses a "W / H" ratio string into its numeric components, or null when the
 *  string is malformed. */
export function parseAspectRatio(ratio: string): { w: number; h: number } | null {
  const parts = ratio.split("/").map((n) => Number(n.trim()));
  const w = parts[0] as number | undefined;
  const h = parts[1] as number | undefined;
  if (w === undefined || h === undefined || !Number.isFinite(w) || !Number.isFinite(h) || h === 0) return null;
  return { w, h };
}
