import { describe, expect, it } from "vitest";
import { importProjectFromFile } from "@/lib/state/projectFile";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene, Project } from "@/lib/types/editor";

function projectFile(content: unknown, filename = "shot.json"): File {
  const text = typeof content === "string" ? content : JSON.stringify(content);
  return new File([text], filename, { type: "application/json" });
}

describe("projectFile", () => {
  it("imports a valid project and keeps its name and scene", async () => {
    const scene: EditorScene = { ...initialScene, frame: "watch" };
    const file = projectFile({ id: "p1", name: "My shot", scene, updatedAt: 123 } satisfies Project);
    const imported = await importProjectFromFile(file);
    expect(imported.name).toBe("My shot");
    expect(imported.scene.frame).toBe("watch");
    // A fresh id is assigned so an imported file can't alias an existing project.
    expect(imported.id).not.toBe("p1");
    expect(typeof imported.updatedAt).toBe("number");
  });

  it("throws on malformed JSON so the caller can surface the error", async () => {
    const file = projectFile("this is not json");
    await expect(importProjectFromFile(file)).rejects.toThrow();
  });

  it("falls back to the filename when the project has no name", async () => {
    const file = projectFile({ scene: { ...initialScene } }, "legacy-shot.json");
    const imported = await importProjectFromFile(file);
    expect(imported.name).toBe("legacy-shot");
  });

  it("normalizes a partial or legacy scene into a valid scene", async () => {
    // A legacy payload that only carries a top-level mediaUrl should be
    // migrated into a single media layer rather than crashing.
    const file = projectFile({ mediaUrl: "data:image/png;base64,abc" });
    const imported = await importProjectFromFile(file);
    expect(Array.isArray(imported.scene.layers)).toBe(true);
    expect(imported.scene.layers.length).toBeGreaterThan(0);
    expect(imported.scene.layers[0]!.mediaUrl).toBe("data:image/png;base64,abc");
  });

  it("throws on oversized files so the caller can surface the error", async () => {
    const oversized = new File(
      [JSON.stringify({ scene: { ...initialScene, frame: "watch" } })],
      "huge.json",
      { type: "application/json" }
    );
    // 5 MB + 1 byte — just over the limit.
    Object.defineProperty(oversized, "size", { value: 5 * 1024 * 1024 + 1 });
    await expect(importProjectFromFile(oversized)).rejects.toThrow("too large");
  });
});
