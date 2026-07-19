import type { EditorScene, MediaType } from "@/lib/types/editor";

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|ogg|ogv|avi|mkv)$/i;

/** True when a media type or filename indicates video. */
export function isVideoSource(mediaType: MediaType, mediaName: string | null): boolean {
  if (mediaType === "video") return true;
  return Boolean(mediaName && VIDEO_EXT.test(mediaName));
}

/** True when the scene's loaded media should render as a <video>. */
export function isVideoScene(scene: EditorScene): boolean {
  return isVideoSource(scene.mediaType, scene.mediaName);
}
