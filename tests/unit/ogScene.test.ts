import { describe, expect, it } from "vitest";
import { buildOgScene, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/lib/state/ogScene";
import { initialScene } from "@/lib/state/editorScene";
import { buildSceneCss } from "@/lib/render/mockupRenderer";

describe("buildOgScene", () => {
  it("keeps the default gradient and demo media from the initial scene", () => {
    const s = buildOgScene();
    expect(s.gradientFrom).toBe(initialScene.gradientFrom);
    expect(s.gradientTo).toBe(initialScene.gradientTo);
    expect(s.layers).toHaveLength(2);
    for (const layer of s.layers) expect(layer.mediaUrl).toBeTruthy();
  });

  it("lays out two overlay frames at the OG canvas ratio", () => {
    const s = buildOgScene();
    expect(s.frameInstances).toHaveLength(2);
    expect(s.frameInstances[0]?.frame).toBe("iphone16pro");
    expect(s.frameInstances[0]?.scale).toBeLessThan(1);
    for (const inst of s.frameInstances) {
      const layer = s.layers.find((l) => l.id === inst.layerId);
      expect(layer?.mediaUrl).toBeTruthy();
    }
  });

  it("enables screen chrome and glare for a polished shot", () => {
    const s = buildOgScene();
    expect(s.screen.enabled).toBe(true);
    expect(s.screenGlare).toBe(true);
  });

  it("produces an overlay skin + chrome + glare through the shared renderer", () => {
    const s = buildOgScene();
    const inst = s.frameInstances[0]!;
    const css = buildSceneCss({ ...s, frame: inst.frame, activeLayerId: inst.layerId });
    expect(css.frameOverlay).toBe("/devices/iphone16pro.svg");
    expect(css.screenChrome).toBeTruthy();
    expect(css.screenGlareStyle).toBeTruthy();
  });

  it("does not mutate the shared initial scene", () => {
    const before = initialScene.frame;
    buildOgScene();
    expect(initialScene.frame).toBe(before);
    expect(initialScene.screen.enabled).toBe(false);
  });
});
