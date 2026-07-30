import type { MediaType } from "@/lib/types/editor";

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|ogg|ogv|avi|mkv)$/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|aac|flac|m4a|wma)$/i;
const SUPPORTED_IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i;

export function detectMediaType(file: File): MediaType {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.includes("mp4") || file.type.includes("quicktime") || file.type.includes("webm")) return "video";
  if (VIDEO_EXT.test(file.name)) return "video";
  return "image";
}

export function isAudioFile(file: File): boolean {
  if (file.type.startsWith("audio/")) return true;
  return AUDIO_EXT.test(file.name);
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

/** Encodes a Blob/File as a `data:` URL using base64. Works in the
 *  browser and in the Node test runner (no FileReader dependency), so the
 *  same code path serves uploads and unit tests. The resulting data: URL is
 *  a self-contained, same-origin-clean string: it survives a localStorage
 *  round-trip and embeds directly into a share URL, unlike a one-shot
 *  `blob:` URL which dies on reload and can't travel to another device. */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const base64 = arrayBufferToBase64(buf);
  const mime = blob.type || "application/octet-stream";
  return `data:${mime};base64,${base64}`;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(new Uint8Array(buf)).toString("base64");
  }
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function loadMediaFromFile(file: File): Promise<LoadedMedia> {
  if (!isSupportedMedia(file)) throw new UnsupportedMediaError(file.name);
  const url = await blobToDataUrl(file);
  return {
    url,
    mediaType: detectMediaType(file),
    mediaName: file.name
  };
}
