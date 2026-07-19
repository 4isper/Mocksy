import type { EditorScene } from "@/lib/types/editor";
import { normalizeScene } from "@/lib/state/normalizeScene";

export function sceneToShareUrl(scene: EditorScene): string {
  const serialized = encodeURIComponent(JSON.stringify(scene));
  const url = new URL(window.location.href);
  url.searchParams.set("scene", serialized);
  return url.toString();
}

export function readSceneFromUrl(): EditorScene | null {
  const url = new URL(window.location.href);
  const raw = url.searchParams.get("scene");
  if (!raw) return null;
  try {
    return normalizeScene(JSON.parse(decodeURIComponent(raw)));
  } catch {
    return null;
  }
}
