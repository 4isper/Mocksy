import type { MediaLayer, MediaType } from "@/lib/types/editor";

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|ogg|ogv|avi|mkv)$/i;

/** True when a media type or filename indicates video. */
export function isVideoSource(mediaType: MediaType, mediaName: string | null): boolean {
  if (mediaType === "video") return true;
  return Boolean(mediaName && VIDEO_EXT.test(mediaName));
}

/** True when the layer's media should render as a <video>. */
export function isVideoLayer(layer: MediaLayer): boolean {
  return isVideoSource(layer.mediaType, layer.mediaName);
}

/** True when any layer in the scene is a video. */
export function hasVideoLayer(layers: MediaLayer[]): boolean {
  return layers.some(isVideoLayer);
}
