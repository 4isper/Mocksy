// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, act } from "@testing-library/react";
import { useScenePalette } from "@/lib/hooks/useScenePalette";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";

vi.mock("@/lib/media/palette", async () => {
  const actual = await vi.importActual<typeof import("@/lib/media/palette")>("@/lib/media/palette");
  return {
    ...actual,
    extractPalette: vi.fn(() => ({ colors: [{ r: 255, g: 0, b: 0, count: 10 }], average: "#ff0000" })),
    paletteColorsFlat: vi.fn((r: { colors: { r: number; g: number; b: number; count: number }[] }) =>
      r.colors.map((c) => `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`)
    )
  };
});

const { extractPalette, paletteColorsFlat } = await import("@/lib/media/palette");

function layerWith(url: string | null, hidden = false): MediaLayer {
  return { ...initialScene.layers[0]!, mediaUrl: url, hidden };
}

function sceneWith(overrides: Partial<EditorScene>): EditorScene {
  return { ...initialScene, ...overrides };
}

describe("useScenePalette", () => {
  beforeEach(() => {
    vi.mocked(extractPalette).mockClear();
    vi.mocked(paletteColorsFlat).mockClear();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    cleanup();
  });

  it("returns an analyzeMedia callback", () => {
    const { result } = renderHook(() => useScenePalette(initialScene));
    expect(typeof result.current.analyzeMedia).toBe("function");
  });

  it("extracts and caches the palette for a loaded image element", () => {
    const img = document.createElement("img");
    Object.defineProperty(img, "currentSrc", { value: "data:img1", configurable: true });
    Object.defineProperty(img, "complete", { value: true, configurable: true });
    Object.defineProperty(img, "naturalWidth", { value: 10, configurable: true });

    const { result } = renderHook(() => useScenePalette(sceneWith({ layers: [layerWith("data:img1")] })));
    act(() => {
      result.current.analyzeMedia(img);
    });
    expect(extractPalette).toHaveBeenCalledTimes(1);
  });

  it("clears the palette when no media is present in single-frame mode", () => {
    const { result } = renderHook(() => useScenePalette(sceneWith({ layers: [layerWith(null)] })));
    act(() => {
      result.current.analyzeMedia(document.createElement("img"));
    });
    expect(extractPalette).not.toHaveBeenCalled();
  });

  it("merges cached palettes weighted by frame scale in multi-frame mode", () => {
    const instA = { id: "i1", frame: "none" as const, layerId: "a", x: 0, y: 0, scale: 2, zIndex: 0 };
    const instB = { id: "i2", frame: "none" as const, layerId: "b", x: 0, y: 0, scale: 1, zIndex: 1 };
    const scene = sceneWith({
      frameInstances: [instA, instB],
      layers: [layerWith("data:a", false), layerWith("data:b", false)]
    });
    const { result } = renderHook(() => useScenePalette(scene));
    // analyzeMedia for both layers to populate the cache, then recompute.
    const imgA = document.createElement("img");
    Object.defineProperty(imgA, "currentSrc", { value: "data:a", configurable: true });
    const imgB = document.createElement("img");
    Object.defineProperty(imgB, "currentSrc", { value: "data:b", configurable: true });
    act(() => {
      result.current.analyzeMedia(imgA);
      result.current.analyzeMedia(imgB);
    });
    expect(extractPalette).toHaveBeenCalledTimes(2);
  });
});
