import { describe, expect, it } from "vitest";
import { resolveExportTransform, waitForImage } from "@/lib/export/exportImage";
import { sampleVideoTransform } from "@/lib/render/videoComposer";
import { initialScene } from "@/lib/state/editorStore";
import type { AnimationPreset, EditorScene, MediaLayer } from "@/lib/types/editor";

function layer(overrides: Partial<MediaLayer> = {}): MediaLayer {
  return { ...initialScene.layers[0]!, id: overrides.id ?? "layer-test", ...overrides };
}

function sceneWith(preset: AnimationPreset, zoom = 1): EditorScene {
  const l = layer({ animationPreset: preset, zoom });
  return { ...initialScene, layers: [l], activeLayerId: l.id };
}

describe("resolveExportTransform", () => {
  it("uses the base zoom and media offset for a static (none) scene", () => {
    const scene = sceneWith("none", 1.4);
    scene.layers[0]!.mediaOffsetX = 0.5;
    scene.layers[0]!.mediaOffsetY = -0.25;
    expect(resolveExportTransform(scene)).toEqual({ zoom: 1.4, offsetX: 0.5, offsetY: -0.25 });
  });

  it("samples the mid-animation frame for zoomIn", () => {
    // zoomIn: 1 -> 1.12, so progress 0.5 lands between.
    const t = resolveExportTransform(sceneWith("zoomIn"));
    expect(t.zoom).toBeGreaterThan(1);
    expect(t.zoom).toBeLessThan(1.12);
  });

  it("samples the mid-animation frame for parallax (non-zero offset)", () => {
    const t = resolveExportTransform(sceneWith("parallax"));
    expect(t.offsetX).not.toBe(0);
    expect(t.offsetY).not.toBe(0);
  });

  it("matches the live preview transform at progress 0.5", () => {
    // The exported frame should coincide with the preview's mid-animation
    // sample so PNG and preview don't diverge in composition.
    const scene = sceneWith("zoomOut");
    const expected = sampleVideoTransform(scene.layers[0]!, 0.5);
    expect(resolveExportTransform(scene)).toEqual({
      zoom: expected.zoom,
      offsetX: expected.x,
      offsetY: expected.y
    });
  });
});

describe("waitForImage", () => {
  it("resolves immediately for an already-loaded image", async () => {
    const img = { complete: true, naturalWidth: 100 } as unknown as HTMLImageElement;
    await expect(waitForImage(img)).resolves.toBeUndefined();
  });

  it("resolves when the image loads", async () => {
    const img = {} as HTMLImageElement & { onload?: () => void };
    const promise = waitForImage(img);
    img.onload?.();
    await expect(promise).resolves.toBeUndefined();
  });

  it("rejects when the image errors", async () => {
    const img = {} as HTMLImageElement & { onerror?: () => void };
    const promise = waitForImage(img);
    img.onerror?.();
    await expect(promise).rejects.toThrow("Image load failed");
  });

  it("rejects on timeout if the image never loads", async () => {
    const img = {} as HTMLImageElement;
    const promise = waitForImage(img, 10);
    await expect(promise).rejects.toThrow("Image load timed out");
  });
});
