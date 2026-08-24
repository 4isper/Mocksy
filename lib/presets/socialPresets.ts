/** A one-click canvas preset tuned for a social media format: an aspect ratio
 *  for the scene canvas plus the recommended pixel size for raster exports. */
import { parseAspectRatio } from "@/lib/render/aspectRatio";

export { parseAspectRatio };

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
