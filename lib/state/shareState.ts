import type { EditorScene } from "@/lib/types/editor";

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
    return JSON.parse(decodeURIComponent(raw)) as EditorScene;
  } catch {
    return null;
  }
}
