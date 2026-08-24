import { describe, expect, it, vi } from "vitest";
import { exportProjectToFile, importProjectFromFile } from "@/lib/state/projectFile";
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

  it("imports a scene payload without explicit scene field", async () => {
    // Legacy format or partial payload where scene is at root level
    const file = projectFile({ frame: "tablet" });
    const imported = await importProjectFromFile(file);
    expect(imported.scene.frame).toBe("tablet");
  });

  it("uses filename without extension for name when no name in file", async () => {
    const file = projectFile({ scene: { ...initialScene } }, "project-name.json");
    const imported = await importProjectFromFile(file);
    expect(imported.name).toBe("project-name");
  });
});

describe("exportProjectToFile", () => {
  it("creates a downloadable JSON file with the project name", () => {
    const project = { id: "p1", name: "My Mockup", scene: { ...initialScene }, updatedAt: Date.now() };
    let createdUrl = "";
    const link = {
      href: "",
      download: "",
      click: vi.fn()
    };
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((b: Blob) => {
        createdUrl = "blob:mock-download";
        return "blob:mock-download";
      }),
      revokeObjectURL: vi.fn()
    });
    vi.stubGlobal("document", {
      createElement: vi.fn((tag: string) => {
        if (tag === "a") return link;
        return null;
      }),
      body: { appendChild: vi.fn(), removeChild: vi.fn() }
    });
    exportProjectToFile(project);
    expect(link.download).toBe("My_Mockup.json");
    expect(link.click).toHaveBeenCalled();
    expect(createdUrl).toBe("blob:mock-download");
    vi.unstubAllGlobals();
  });

  it("falls back to mocksy-project for empty name after sanitization", () => {
    const project = { id: "p2", name: "", scene: { ...initialScene }, updatedAt: Date.now() };
    const link = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:"), revokeObjectURL: vi.fn() });
    vi.stubGlobal("document", {
      createElement: vi.fn(() => link),
      body: { appendChild: vi.fn(), removeChild: vi.fn() }
    });
    exportProjectToFile(project);
    expect(link.download).toBe("mocksy-project.json");
    vi.unstubAllGlobals();
  });
});
