import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditorScene } from "@/lib/types/editor";
import { initialScene } from "@/lib/state/editorStore";
import { stripSceneMedia, importTemplateFromFile, exportTemplateToFile } from "@/lib/state/templateFile";
import { normalizeScene } from "@/lib/state/normalizeScene";
import { sanitizeFilename } from "@/lib/export/filename";

function scene(overrides: Partial<EditorScene> = {}): EditorScene {
  return {
    ...initialScene,
    layers: initialScene.layers.map((l) => ({
      ...l,
      mediaUrl: "data:image/png;base64,AAA",
      mediaType: "image" as const,
      mediaName: "photo.png"
    })),
    backgroundImageUrl: "data:image/png;base64,BBB",
    backgroundAudioUrl: "data:audio/mp3;base64,CCC",
    backgroundAudioName: "loop.mp3",
    watermarkImageUrl: "data:image/png;base64,DDD",
    ...overrides
  };
}

describe("stripSceneMedia", () => {
  it("removes media payloads from every layer", () => {
    const out = stripSceneMedia(scene());
    for (const layer of out.layers) {
      expect(layer.mediaUrl).toBeNull();
      expect(layer.mediaType).toBe("none");
      expect(layer.mediaName).toBeNull();
    }
  });

  it("keeps everything visual about the scene", () => {
    const source = scene({ frame: "browser", browserUrl: "example.com", stylePreset: "glassDark" });
    const out = stripSceneMedia(source);
    expect(out.frame).toBe("browser");
    expect(out.browserUrl).toBe("example.com");
    expect(out.stylePreset).toBe("glassDark");
    expect(out.annotations).toEqual(source.annotations);
    expect(out.screen).toEqual(source.screen);
  });

  it("clears background image/audio and logo watermark", () => {
    const out = stripSceneMedia(scene());
    expect(out.backgroundImageUrl).toBeNull();
    expect(out.backgroundAudioUrl).toBeNull();
    expect(out.backgroundAudioName).toBeNull();
    expect(out.watermarkImageUrl).toBeNull();
    // Text watermark settings survive — they are part of the look.
    expect(out.watermarkText).toBe(initialScene.watermarkText);
  });

  it("survives a normalization round-trip without resurrecting media", () => {
    const stripped = stripSceneMedia(scene());
    const normalized = normalizeScene(JSON.parse(JSON.stringify(stripped)));
    for (const layer of normalized.layers) {
      expect(layer.mediaUrl).toBeNull();
    }
    expect(normalized.backgroundImageUrl).toBeNull();
  });
});

describe("importTemplateFromFile", () => {
  it("rejects files over the size cap", async () => {
    const file = new File(["x".repeat(6 * 1024 * 1024)], "big.mocksy.json", { type: "application/json" });
    await expect(importTemplateFromFile(file)).rejects.toThrow(/too large/i);
  });

  it("rejects unknown template formats", async () => {
    const payload = JSON.stringify({ format: "some-other-format", scene: {} });
    const file = new File([payload], "tpl.mocksy.json", { type: "application/json" });
    await expect(importTemplateFromFile(file)).rejects.toThrow(/unsupported template format/i);
  });

  it("accepts a template payload and strips its media", async () => {
    const payload = JSON.stringify({ format: "mocksy-template", version: 1, name: "T", scene: scene() });
    const file = new File([payload], "tpl.mocksy.json", { type: "application/json" });
    const out = await importTemplateFromFile(file);
    expect(out.layers[0]!.mediaUrl).toBeNull();
    expect(out.backgroundImageUrl).toBeNull();
  });

  it("accepts a bare scene JSON and normalizes + strips it too", async () => {
    const file = new File([JSON.stringify(scene())], "scene.json", { type: "application/json" });
    const out = await importTemplateFromFile(file);
    expect(out.layers[0]!.mediaUrl).toBeNull();
  });

  it("rejects a null payload", async () => {
    const file = new File(["null"], "t.mocksy.json", { type: "application/json" });
    await expect(importTemplateFromFile(file)).rejects.toThrow(/not a valid template file/i);
  });

  it("rejects a non-object scalar payload", async () => {
    const file = new File(['"just a string"'], "t.mocksy.json", { type: "application/json" });
    await expect(importTemplateFromFile(file)).rejects.toThrow(/not a valid template file/i);
  });
});

describe("exportTemplateToFile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("downloads a sanitized .mocksy.json blob", () => {
    const createObjectURL = vi.fn((_: unknown) => "blob:fake");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const anchor = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("document", { createElement: (tag: string) => (tag === "a" ? anchor : {}) });

    exportTemplateToFile(scene({ frame: "browser" }), "My Template!");

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0]![0];
    expect(blob).toBeInstanceOf(Blob);
    expect(anchor.download).toBe(`${sanitizeFilename("My Template!") || "mocksy-template"}.mocksy.json`);
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });

  it("falls back to the default name when the sanitized name is empty", () => {
    const createObjectURL = vi.fn((_: unknown) => "blob:fake");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const anchor = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("document", { createElement: () => anchor });

    exportTemplateToFile(scene(), "");

    expect(anchor.download).toBe("mocksy-template.mocksy.json");
  });
});
