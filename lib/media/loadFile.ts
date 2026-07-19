import type { MediaType } from "@/lib/types/editor";

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|ogg|ogv|avi|mkv)$/i;

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

/** Reads a dropped/selected file into an object URL the editor can render. */
export function loadMediaFromFile(file: File): LoadedMedia {
  return {
    url: URL.createObjectURL(file),
    mediaType: detectMediaType(file),
    mediaName: file.name
  };
}
