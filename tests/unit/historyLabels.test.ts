import { describe, expect, it } from "vitest";
import { describeHistoryStep } from "@/lib/state/historyLabels";
import { initialScene } from "@/lib/state/editorScene";
import type { EditorScene } from "@/lib/types/editor";

const clone = (s: EditorScene): EditorScene => JSON.parse(JSON.stringify(s));

describe("describeHistoryStep", () => {
  it("labels the initial vs next as canvas by default", () => {
    const next = clone(initialScene);
    next.aspectRatio = "1 / 1";
    expect(describeHistoryStep(initialScene, next)).toBe("canvas");
  });

  it("detects layer edits", () => {
    const next = clone(initialScene);
    next.layers[0]!.zoom = 1.5;
    expect(describeHistoryStep(initialScene, next)).toBe("layers");
  });

  it("detects added/removed layers", () => {
    const next = clone(initialScene);
    next.layers.push({ ...next.layers[0]!, id: "extra", mediaUrl: null });
    expect(describeHistoryStep(initialScene, next)).toBe("layers");
  });

  it("detects annotations", () => {
    const next = clone(initialScene);
    next.annotations.push({ id: "a1", type: "text", x: 0, y: 0, w: 0.1, h: 0.1, text: "hi", color: "#000", strokeWidth: 2, fontSize: 16 });
    expect(describeHistoryStep(initialScene, next)).toBe("annotations");
  });

  it("detects frame changes", () => {
    const next = clone(initialScene);
    next.frame = "macbook";
    expect(describeHistoryStep(initialScene, next)).toBe("frame");
  });

  it("detects background changes (gradient stop)", () => {
    const next = clone(initialScene);
    next.gradientTo = "#abcdef";
    expect(describeHistoryStep(initialScene, next)).toBe("background");
  });

  it("detects style changes", () => {
    const next = clone(initialScene);
    next.stylePreset = "glassDark";
    expect(describeHistoryStep(initialScene, next)).toBe("style");
  });

  it("detects screen chrome changes", () => {
    const next = clone(initialScene);
    next.screen.showClock = !next.screen.showClock;
    expect(describeHistoryStep(initialScene, next)).toBe("screen");
  });

  it("detects watermark changes", () => {
    const next = clone(initialScene);
    next.watermarkText = "hello";
    expect(describeHistoryStep(initialScene, next)).toBe("watermark");
  });
});
