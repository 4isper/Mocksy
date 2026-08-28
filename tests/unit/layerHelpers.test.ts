import { describe, expect, it } from "vitest";
import {
  makeAnnotation,
  makeDemoLayer,
  activeLayer,
  activePosterTime,
  patchActive
} from "@/lib/state/layerHelpers";
import { initialScene } from "@/lib/state/editorStore";

describe("layerHelpers", () => {
  it("makeAnnotation sets type-specific defaults", () => {
    const arrow = makeAnnotation("arrow");
    expect(arrow.type).toBe("arrow");
    expect(arrow.strokeWidth).toBe(4);
    expect(arrow.text).toBe("");

    const circle = makeAnnotation("circle");
    expect(circle.w).toBe(0.2);
    expect(circle.h).toBe(0.2);

    const text = makeAnnotation("text");
    expect(text.type).toBe("text");
    expect(text.strokeWidth).toBe(0);
    expect(text.text).toBe("Label");
    expect(text.fontWeight).toBe("bold");
  });

  it("makeAnnotation assigns a unique id", () => {
    const a = makeAnnotation("arrow");
    const b = makeAnnotation("arrow");
    expect(a.id).not.toBe(b.id);
  });

  it("makeDemoLayer returns a valid image layer", () => {
    const layer = makeDemoLayer();
    expect(layer.mediaType).toBe("image");
    expect(layer.zoom).toBe(1);
    expect(layer.videoMuted).toBe(true);
  });

  it("activeLayer falls back to the first layer", () => {
    const scene = { ...initialScene };
    expect(activeLayer(scene)?.id).toBe(scene.layers[0]!.id);
    const target = scene.layers[0]!;
    expect(activeLayer(scene, target.id)?.id).toBe(target.id);
  });

  it("activeLayer returns undefined for an empty scene", () => {
    const scene = { ...initialScene, layers: [] };
    expect(activeLayer(scene)).toBeUndefined();
  });

  it("activePosterTime reads the active video poster time", () => {
    const layer = makeDemoLayer();
    layer.videoPosterTime = 1.5;
    const scene = { ...initialScene, layers: [layer], activeLayerId: layer.id };
    expect(activePosterTime(scene, layer.id)).toBe(1.5);
    expect(activePosterTime({ ...initialScene, layers: [] })).toBe(0);
  });

  it("patchActive returns a new layers array with the patch applied", () => {
    const layer = makeDemoLayer();
    const scene = { ...initialScene, layers: [layer], activeLayerId: layer.id };
    const patched = patchActive(scene, { zoom: 2 });
    expect(patched[0]!.zoom).toBe(2);
    expect(scene.layers[0]!.zoom).toBe(1);
    expect(patched).not.toBe(scene.layers);
  });

  it("patchActive returns the same array when the target layer is missing", () => {
    const layer = makeDemoLayer();
    const scene = { ...initialScene, layers: [layer], activeLayerId: "ghost-layer" };
    expect(patchActive(scene, { zoom: 2 }, "ghost-layer")).toBe(scene.layers);
  });
});
