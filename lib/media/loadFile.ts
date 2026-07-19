import type { MediaType } from "@/lib/types/editor";

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|ogg|ogv|avi|mkv)$/i;
const SUPPORTED_IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i;

export function detectMediaType(file: File): MediaType {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.includes("mp4") || file.type.includes("quicktime") || file.type.includes("webm")) return "video";
  if (VIDEO_EXT.test(file.name)) return "video";
  return "image";
}

export interface LoadedMedia {
  url: string;
  mediaType: MediaType;
  mediaName: string;
}

export class UnsupportedMediaError extends Error {
  constructor(fileName: string) {
    super(`"${fileName}" is not a supported image or video.`);
    this.name = "UnsupportedMediaError";
  }
}

/** True when the file is a renderable image or video for the editor. */
export function isSupportedMedia(file: File): boolean {
  if (file.type.startsWith("image/") || file.type.startsWith("video/")) return true;
  return SUPPORTED_IMAGE_EXT.test(file.name) || VIDEO_EXT.test(file.name);
}

/** Reads a dropped/selected file into an object URL the editor can render. */
export function loadMediaFromFile(file: File): LoadedMedia {
  if (!isSupportedMedia(file)) throw new UnsupportedMediaError(file.name);
  return {
    url: URL.createObjectURL(file),
    mediaType: detectMediaType(file),
    mediaName: file.name
  };
}
