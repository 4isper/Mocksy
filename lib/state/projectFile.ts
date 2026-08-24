"use client";

import type { EditorScene, Project } from "@/lib/types/editor";
import { normalizeScene } from "@/lib/state/normalizeScene";
import { nextProjectId } from "@/lib/state/ids";
import { sanitizeFilename } from "@/lib/export/filename";

/** Triggers a browser download of a project as a JSON file. */
export function exportProjectToFile(project: Project): void {
  const payload = JSON.stringify(project, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeFilename(project.name) || "mocksy-project"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Reads a project JSON file and returns a normalized Project. The scene is
 * run through normalizeScene so a malformed/corrupted file can never crash
 * the editor; a generated id/updatedAt keeps it distinct from any existing
 * project. Throws if the file cannot be parsed as JSON or exceeds the
 * size limit (5 MB).
 */
export async function importProjectFromFile(file: File): Promise<Project> {
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`);
  }
  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;
  const raw = parsed as Record<string, unknown>;
  const scene: EditorScene = normalizeScene(raw?.scene ?? raw);
  const name =
    parsed && typeof parsed === "object" && typeof (parsed as Record<string, unknown>).name === "string"
      ? ((parsed as Record<string, unknown>).name as string)
      : (file.name.replace(/\.json$/i, "") || "Imported mockup");
  return {
    id: nextProjectId(),
    name,
    scene,
    updatedAt: Date.now()
  };
}
