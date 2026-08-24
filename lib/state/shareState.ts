import type { EditorScene } from "@/lib/types/editor";
import { normalizeScene } from "@/lib/state/normalizeScene";
import { stripSceneMedia } from "@/lib/state/templateFile";
import { DEMO_MEDIA_NAME, DEMO_MEDIA_URL } from "@/lib/media/demoMedia";

/** Above this length the URL becomes impractical to share (some browsers cap
 *  URLs around 64KB; long data: media also can't be pasted reliably). Demo
 *  media is already stripped, but a large uploaded asset still can blow this.
 *  The limit is checked AFTER deflate compression, so scenes that used to
 *  overflow may now fit. */
const MAX_SHARE_URL_LENGTH = 16000;

/** Marker left in place of the demo data: URL so the reader knows exactly which
  * layers were the demo and can restore real demo media for them alone — without
  * resurrecting the demo in layers the user genuinely cleared. */
const DEMO_MEDIA_PLACEHOLDER = "__mocksy_demo__";

/** Compressed payloads carry this prefix so the reader can tell them apart
 *  from legacy raw-JSON params (which start with "{"). */
const COMPRESSED_PREFIX = "z.";

export class ShareUrlTooLarge extends Error {
  constructor() {
    super("Share link is too large");
    this.name = "ShareUrlTooLarge";
  }
}

/** Strips the bundled demo media out of the scene before serialization so
 *  share links don't carry the app's own assets (the reader restores them). */
function stripDemoMedia(scene: EditorScene): EditorScene {
  const hasDemo = scene.layers.some((l) => l.mediaUrl === DEMO_MEDIA_URL);
  if (!hasDemo) return scene;
  return {
    ...scene,
    layers: scene.layers.map((l) =>
      l.mediaUrl === DEMO_MEDIA_URL
        ? { ...l, mediaUrl: DEMO_MEDIA_PLACEHOLDER, mediaType: "none" as const, mediaName: null }
        : l
    )
  };
}

/** Base64url (URL-safe, unpadded) of raw bytes. btoa is available everywhere
 *  the editor runs; chunked String.fromCharCode avoids call-stack overflows
 *  on multi-KB payloads. */
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deflateJson(json: string): Promise<Uint8Array | null> {
  const CS = (globalThis as { CompressionStream?: typeof CompressionStream }).CompressionStream;
  if (!CS) return null;
  try {
    const stream = new Blob([json]).stream().pipeThrough(new CS("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

async function inflateJson(bytes: Uint8Array): Promise<string | null> {
  const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
  if (!DS) return null;
  try {
    const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(new DS("deflate"));
    return await new Response(stream).text();
  } catch {
    return null;
  }
}

/**
 * Serializes the scene into a shareable URL. When the browser supports
 * CompressionStream the JSON payload is deflated and stored base64url-encoded
 * behind a `z.` prefix (typically several times shorter than raw JSON);
 * otherwise it falls back to the legacy raw-JSON param that every reader
 * understands. Throws ShareUrlTooLarge when even the compressed link exceeds
 * the practical URL budget.
 */
export async function sceneToShareUrl(scene: EditorScene): Promise<string> {
  const serialized = JSON.stringify(stripDemoMedia(scene));
  const url = new URL(window.location.href);
  // URLSearchParams percent-encodes the value on its own; pre-encoding with
  // encodeURIComponent here used to double-encode the payload (~2x the special
  // characters, eating half the URL budget for nothing).
  const compressed = await deflateJson(serialized);
  url.searchParams.set("scene", compressed ? COMPRESSED_PREFIX + bytesToBase64Url(compressed) : serialized);
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
 *  fails. Legacy-only: compressed (`z.`) values are not valid JSON here. */
export function readSceneFromUrl(): EditorScene | null {
  const url = new URL(window.location.href);
  const raw = url.searchParams.get("scene");
  if (!raw || raw.startsWith(COMPRESSED_PREFIX)) return null;
  const scene = parseLegacyShareScene(raw);
  if (!scene) return null;
  return restoreDemoMedia(scene);
}

/**
 * Async reader that understands BOTH formats: current deflate-compressed
 * links and legacy raw-JSON links. Used by the app bootstrap, which awaits it
 * once before hydrating projects.
 */
export async function readSharedSceneFromUrl(): Promise<EditorScene | null> {
  const url = new URL(window.location.href);
  const raw = url.searchParams.get("scene");
  if (!raw) return null;

  if (raw.startsWith(COMPRESSED_PREFIX)) {
    try {
      const json = await inflateJson(base64UrlToBytes(raw.slice(COMPRESSED_PREFIX.length)));
      if (!json) return null;
      const scene = normalizeScene(JSON.parse(json));
      return restoreDemoMedia(scene);
    } catch {
      return null;
    }
  }

  const scene = parseLegacyShareScene(raw);
  if (!scene) return null;
  return restoreDemoMedia(scene);
}

function parseLegacyShareScene(raw: string): EditorScene | null {
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

/** Re-injects the demo data: URL into the layers that were the demo. Only
  * layers carrying `DEMO_MEDIA_PLACEHOLDER` (set when the share URL was built)
  * are restored, so a layer the user genuinely cleared stays empty. Legacy
  * links stored the stripped demo as a bare `null`; if the entire scene had no
  * media at all we still restore the demo for those (the whole scene was demo). */
function restoreDemoMedia(scene: EditorScene): EditorScene {
  const allStripped = !scene.layers.some((l) => l.mediaUrl);
  const hasDemoMarker = scene.layers.some((l) => l.mediaUrl === DEMO_MEDIA_PLACEHOLDER);
  if (!allStripped && !hasDemoMarker) return scene;
  return {
    ...scene,
    layers: scene.layers.map((l) => {
      if (l.mediaUrl === DEMO_MEDIA_PLACEHOLDER) {
        return { ...l, mediaUrl: DEMO_MEDIA_URL, mediaType: "image", mediaName: DEMO_MEDIA_NAME };
      }
      if (l.mediaUrl == null && allStripped) {
        return { ...l, mediaUrl: DEMO_MEDIA_URL, mediaType: "image", mediaName: DEMO_MEDIA_NAME };
      }
      return l;
    })
  };
}

/** Removes the `scene` query param from the address bar after it has been
 *  consumed, so reloads load the persisted project list instead of re-importing
 *  the same share scene (and stacking duplicate projects). */
export function clearSceneFromUrl(): void {
  clearQueryParam("scene");
}

/** Removes the `template` query param after it has been applied, so a reload
 *  doesn't keep re-importing the template over the user's edits. */
export function clearTemplateFromUrl(): void {
  clearQueryParam("template");
}

function clearQueryParam(name: string): void {
  if (typeof window === "undefined" || !window.history) return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(name)) return;
  url.searchParams.delete(name);
  window.history.replaceState({}, "", url.toString());
}

/**
 * Serializes a media-free template of the scene into a shareable `?template=`
 * URL — same codec as share links, but every media payload is stripped first
 * (the reader opens an empty canvas with the scene's appearance). Throws
 * ShareUrlTooLarge when the link exceeds the practical URL budget.
 */
export async function sceneToTemplateUrl(scene: EditorScene): Promise<string> {
  const serialized = JSON.stringify(stripSceneMedia(scene));
  const url = new URL(window.location.href);
  const compressed = await deflateJson(serialized);
  url.searchParams.set("template", compressed ? COMPRESSED_PREFIX + bytesToBase64Url(compressed) : serialized);
  if (url.toString().length > MAX_SHARE_URL_LENGTH) {
    throw new ShareUrlTooLarge();
  }
  return url.toString();
}

/** Reads and normalizes the `?template=` payload. Unlike share links, no demo
 *  media is restored: templates are appearance-only by definition. The result
 *  is stripped again defensively so hand-edited links can't smuggle media. */
export async function readTemplateFromUrl(): Promise<EditorScene | null> {
  const raw = new URL(window.location.href).searchParams.get("template");
  if (!raw) return null;

  let scene: EditorScene | null;
  if (raw.startsWith(COMPRESSED_PREFIX)) {
    try {
      const json = await inflateJson(base64UrlToBytes(raw.slice(COMPRESSED_PREFIX.length)));
      scene = json ? normalizeScene(JSON.parse(json)) : null;
    } catch {
      return null;
    }
  } else {
    scene = parseLegacyShareScene(raw);
  }
  return scene ? stripSceneMedia(scene) : null;
}
