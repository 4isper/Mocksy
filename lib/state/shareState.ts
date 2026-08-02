import type { EditorScene } from "@/lib/types/editor";
import { normalizeScene } from "@/lib/state/normalizeScene";
import { DEMO_MEDIA_NAME, DEMO_MEDIA_URL } from "@/lib/media/demoMedia";

/** Above this length the URL becomes impractical to share (some browsers cap
 *  URLs around 64KB; long data: media also can't be pasted reliably). Demo
 *  media is already stripped, but a large uploaded asset still can blow this. */
const MAX_SHARE_URL_LENGTH = 16000;

export class ShareUrlTooLarge extends Error {
  constructor() {
    super("Share link is too large");
    this.name = "ShareUrlTooLarge";
  }
}

export function sceneToShareUrl(scene: EditorScene): string {
  // The demo media is a long data: URI bundled into the app; encoding it into
  // every share link bloats the URL for no reason since the reader restores
  // the same demo by default. Drop demo layers (replaced on read).
  const hasDemo = scene.layers.some((l) => l.mediaUrl === DEMO_MEDIA_URL);
  const payload = hasDemo
    ? {
        ...scene,
        layers: scene.layers.map((l) =>
          l.mediaUrl === DEMO_MEDIA_URL
            ? { ...l, mediaUrl: null, mediaType: "none" as const, mediaName: null }
            : l
        )
      }
    : scene;
  const serialized = JSON.stringify(payload);
  const url = new URL(window.location.href);
  // URLSearchParams percent-encodes the value on its own; pre-encoding with
  // encodeURIComponent here used to double-encode the payload (~2x the special
  // characters, eating half the URL budget for nothing).
  url.searchParams.set("scene", serialized);
  if (url.toString().length > MAX_SHARE_URL_LENGTH) {
    // A full-resolution uploaded image/video can't travel in a URL — point the
    // user at the project-file export instead of producing a broken link.
    throw new ShareUrlTooLarge();
  }
  return url.toString();
}

/** Parses the `scene` query value. URLSearchParams already decoded the single
 *  percent-encoding of current links; older links carried an extra
 *  encodeURIComponent layer, so fall back to decoding that when the first parse
 *  fails. */
function parseShareScene(raw: string): EditorScene | null {
  try {
    return normalizeScene(JSON.parse(raw));
  } catch {
    try {
      return normalizeScene(JSON.parse(decodeURIComponent(raw)));
    } catch {
      return null;
    }
  }
}

export function readSceneFromUrl(): EditorScene | null {
  const url = new URL(window.location.href);
  const raw = url.searchParams.get("scene");
  if (!raw) return null;
  const scene = parseShareScene(raw);
  if (!scene) return null;
  // A share URL omits the demo media to stay short; restore it so the
  // canvas isn't blank when the link is opened.
  if (!scene.layers.some((l) => l.mediaUrl)) {
    return {
      ...scene,
      layers: scene.layers.map((l) =>
        l.mediaUrl == null ? { ...l, mediaUrl: DEMO_MEDIA_URL, mediaType: "image", mediaName: DEMO_MEDIA_NAME } : l
      )
    };
  }
  return scene;
}

/** Removes the `scene` query param from the address bar after it has been
 *  consumed, so reloads load the persisted project list instead of re-importing
 *  the same share scene (and stacking duplicate projects). */
export function clearSceneFromUrl(): void {
  if (typeof window === "undefined" || !window.history) return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("scene")) return;
  url.searchParams.delete("scene");
  window.history.replaceState({}, "", url.toString());
}
