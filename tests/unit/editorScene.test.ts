import { describe, expect, it } from "vitest";
import { buildFreshScene, initialScene, makeDemoScene } from "@/lib/state/editorScene";

describe("editorScene", () => {
  it("initialScene defaults to a single active demo layer", () => {
    expect(initialScene.layers).toHaveLength(1);
    expect(initialScene.activeLayerId).toBe(initialScene.layers[0]!.id);
    expect(initialScene.frameInstances).toEqual([]);
  });

  it("makeDemoScene builds a 2-frame horizontal grid with fresh layers", () => {
    const scene = makeDemoScene();
    expect(scene.frameInstances).toHaveLength(2);
    expect(scene.layers).toHaveLength(2);
    expect(scene.frameInstances[0]!.layerId).toBe(scene.layers[0]!.id);
    expect(scene.frameInstances[1]!.layerId).toBe(scene.layers[1]!.id);
    expect(scene.activeLayerId).toBe(scene.layers[0]!.id);
    expect(scene.annotations).toEqual([]);
  });

  it("makeDemoScene layers are distinct from the initial scene's layer", () => {
    const scene = makeDemoScene();
    expect(scene.layers[0]!.id).not.toBe(initialScene.layers[0]!.id);
  });

  it("buildFreshScene honors the requested frame, count and direction", () => {
    const scene = buildFreshScene("desktop", 3, "vertical");
    expect(scene.frameInstances).toHaveLength(3);
    expect(scene.layers).toHaveLength(3);
    expect(scene.frameInstances.every((i) => i.frame === "desktop")).toBe(true);
    // vertical layout centers horizontally (x = 0.5)
    expect(scene.frameInstances[0]!.x).toBe(0.5);
  });

  it("buildFreshScene with count 0 yields no layers or instances", () => {
    const scene = buildFreshScene("iphone", 0, "horizontal");
    expect(scene.frameInstances).toHaveLength(0);
    expect(scene.layers).toHaveLength(0);
    expect(scene.activeLayerId).toBeNull();
  });

  it("buildFreshScene inherits the rest of the initial scene defaults", () => {
    const scene = buildFreshScene();
    expect(scene.aspectRatio).toBe(initialScene.aspectRatio);
    expect(scene.backgroundMode).toBe(initialScene.backgroundMode);
    expect(scene.animationDurationMs).toBe(initialScene.animationDurationMs);
    expect(scene.backgroundAudioUrl).toBeNull();
  });
});
