import type { EditorScene } from "@/lib/types/editor";
import { normalizeScene } from "@/lib/state/normalizeScene";
import { DEMO_MEDIA_NAME, DEMO_MEDIA_URL } from "@/lib/media/demoMedia";

export function sceneToShareUrl(scene: EditorScene): string {
  // The demo media is a long data: URI bundled into the app; encoding it into
  // every share link bloats the URL for no reason since the reader restores
  // the same demo by default. Drop it when the scene is still on demo media.
  const payload =
    scene.mediaUrl === DEMO_MEDIA_URL
      ? { ...scene, mediaUrl: null, mediaType: "none", mediaName: null }
      : scene;
  const serialized = encodeURIComponent(JSON.stringify(payload));
  const url = new URL(window.location.href);
  url.searchParams.set("scene", serialized);
  return url.toString();
}

export function readSceneFromUrl(): EditorScene | null {
  const url = new URL(window.location.href);
  const raw = url.searchParams.get("scene");
  if (!raw) return null;
  try {
    const scene = normalizeScene(JSON.parse(decodeURIComponent(raw)));
    // A share URL omits the demo media to stay short; restore it so the
    // canvas isn't blank when the link is opened.
    if (!scene.mediaUrl) {
      return { ...scene, mediaUrl: DEMO_MEDIA_URL, mediaType: "image", mediaName: DEMO_MEDIA_NAME };
    }
    return scene;
  } catch {
    return null;
  }
}
