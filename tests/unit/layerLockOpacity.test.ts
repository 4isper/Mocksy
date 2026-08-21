import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useEditorStore, initialScene } from "@/lib/state/editorStore";
import { isLayerLocked, patchActive } from "@/lib/state/editorHelpers";
import { buildSvgMarkup } from "@/lib/export/svgMarkup";
import { pickClipboardMedia } from "@/lib/media/clipboard";
import { createFrameAlignCommands } from "@/lib/commands/frameCommands";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";

const store = () => useEditorStore.getState();

function layer(overrides: Partial<MediaLayer>): MediaLayer {
  return { ...initialScene.layers[0]!, id: overrides.id ?? "layer-test", ...overrides };
}

function sceneWithLayers(layers: MediaLayer[], activeLayerId: string | null = layers[0]?.id ?? null): EditorScene {
  return { ...initialScene, layers, activeLayerId };
}

beforeEach(() => {
  useEditorStore.setState({ scene: initialScene, past: [], future: [] });
});

afterEach(() => {
  useEditorStore.setState({ scene: initialScene, past: [], future: [] });
});

describe("layer opacity", () => {
  it("defaults to 100 on new layers and normalizes out-of-range values", async () => {
    const { makeDemoLayer } = await import("@/lib/state/editorHelpers");
    expect(makeDemoLayer().opacity).toBe(100);
    const { normalizeScene } = await import("@/lib/state/normalizeScene");
    const raw = { ...initialScene, layers: [{ ...initialScene.layers[0]!, opacity: 999 }] };
    expect(normalizeScene(raw).layers[0]!.opacity).toBe(100);
    const low = normalizeScene({ ...initialScene, layers: [{ ...initialScene.layers[0]!, opacity: -5 }] });
    expect(low.layers[0]!.opacity).toBe(0);
  });

  it("setOpacity records an undo step", () => {
    store().setOpacity(40);
    expect(store().scene.layers[0]!.opacity).toBe(40);
    expect(store().past.length).toBe(1);
    store().undo();
    expect(store().scene.layers[0]!.opacity ?? 100).toBe(100);
  });

  it("flows into the CSS media style only when not neutral", async () => {
    const { buildSceneCss } = await import("@/lib/render/mockupRenderer");
    const neutral = buildSceneCss(sceneWithLayers([layer({ opacity: 100 })]));
    expect(neutral.mediaStyle.opacity).toBeUndefined();
    const faded = buildSceneCss(sceneWithLayers([layer({ opacity: 25 })]));
    expect(faded.mediaStyle.opacity).toBeCloseTo(0.25, 6);
  });

  it("applies to the SVG media group but not the device skin", () => {
    const scene = sceneWithLayers([layer({ opacity: 50, mediaUrl: "data:image/png;base64,x" })]);
    const markup = buildSvgMarkup(scene, {
      width: 800,
      height: 450,
      backgroundHref: null,
      groups: [{
        box: { x: 10, y: 10, width: 300, height: 400, outerRadius: 20, innerX: 20, innerY: 20, innerW: 280, innerH: 380, innerRadius: 16 },
        mediaHref: "data:image/png;base64,x",
        mediaWidth: 100,
        mediaHeight: 100,
        isOverlay: false,
        overlayInner: null,
        opacity: 50
      }]
    });
    expect(markup).toContain('<g opacity="0.5">');
    // The frame rect itself must stay outside the faded group.
    const afterMedia = markup.slice(markup.indexOf('opacity="0.5"'));
    expect(afterMedia.indexOf("<rect")).toBeGreaterThan(-1);
  });
});

describe("layer lock", () => {
  it("toggles via toggleLayersLocked with undo", () => {
    const id = store().scene.layers[0]!.id;
    store().toggleLayersLocked([id]);
    expect(store().scene.layers[0]!.locked).toBe(true);
    store().undo();
    expect(store().scene.layers[0]!.locked ?? false).toBe(false);
  });

  it("blocks content edits while locked", () => {
    store().toggleLayersLocked([store().scene.layers[0]!.id]);
    const before = store().scene;
    store().setZoom(1.4);
    store().setBrightness(150);
    store().updateActiveLayer({ rotation: 90 });
    store().renameLayer(store().scene.layers[0]!.id, "renamed");
    store().setMedia(null, "none", null);
    expect(store().scene).toBe(before);
    expect(store().past.length).toBe(1); // only the lock toggle itself
  });

  it("still allows visibility toggle and duplication while locked", () => {
    const id = store().scene.layers[0]!.id;
    store().toggleLayersLocked([id]);
    store().toggleLayerHidden(id);
    expect(store().scene.layers[0]!.hidden).toBe(true);
    store().duplicateLayer(id);
    expect(store().scene.layers.length).toBe(2);
  });

  it("protects locked layers from removal", () => {
    const lockedId = "l-locked";
    const freeId = "l-free";
    useEditorStore.setState({
      scene: sceneWithLayers([layer({ id: lockedId, locked: true }), layer({ id: freeId })], freeId)
    });
    store().removeLayer(lockedId);
    expect(store().scene.layers.some((l) => l.id === lockedId)).toBe(true);
    store().removeLayers([lockedId, freeId]);
    expect(store().scene.layers.some((l) => l.id === lockedId)).toBe(true);
    expect(store().scene.layers.some((l) => l.id === freeId)).toBe(false);
  });

  it("isLayerLocked falls back to the first layer when no id is given", () => {
    const scene = sceneWithLayers([layer({ id: "a", locked: true }), layer({ id: "b" })]);
    expect(isLayerLocked(scene, "a")).toBe(true);
    expect(isLayerLocked(scene, "b")).toBe(false);
    expect(isLayerLocked(scene, null)).toBe(true);
    expect(isLayerLocked(sceneWithLayers([]), null)).toBe(false);
  });

  it("patchActive leaves a locked layer untouched", () => {
    const scene = sceneWithLayers([layer({ id: "a", locked: true })]);
    expect(patchActive(scene, { zoom: 2 }, "a")).toBe(scene.layers);
  });
});

describe("align/distribute store actions", () => {
  function twoFrames() {
    return [
      { id: "f1", frame: "none" as const, x: 0.3, y: 0.5, scale: 0.25, layerId: null },
      { id: "f2", frame: "none" as const, x: 0.7, y: 0.8, scale: 0.25, layerId: null }
    ];
  }

  it("alignFrameInstances no-ops below 2 instances", () => {
    const before = store().scene;
    store().alignFrameInstances("left");
    expect(store().scene).toBe(before);
  });

  it("alignFrameInstances aligns and pushes one undo step", () => {
    useEditorStore.setState({ scene: { ...initialScene, frameInstances: twoFrames() } });
    store().alignFrameInstances("left");
    const [a, b] = store().scene.frameInstances;
    expect(a!.x).toBeCloseTo(b!.x, 6);
    expect(store().past.length).toBe(1);
    store().undo();
    expect(store().scene.frameInstances[0]!.x).toBeCloseTo(0.3, 6);
  });

  it("distributeFrameInstances needs 3 instances", () => {
    useEditorStore.setState({ scene: { ...initialScene, frameInstances: twoFrames() } });
    const before = store().scene;
    store().distributeFrameInstances("horizontal");
    expect(store().scene).toBe(before);
  });
});

describe("frame align commands", () => {
  const t = (key: string) => key;

  it("disable align below 2 instances and distribute below 3", () => {
    const empty = createFrameAlignCommands(t, sceneWithLayers([layer({})]));
    expect(empty.every((c) => c.disabled)).toBe(true);

    const two = createFrameAlignCommands(t, {
      ...initialScene,
      frameInstances: [
        { id: "f1", frame: "iphone", x: 0.3, y: 0.5, scale: 1, layerId: null },
        { id: "f2", frame: "iphone", x: 0.7, y: 0.5, scale: 1, layerId: null }
      ]
    } as EditorScene);
    expect(two.filter((c) => c.id.startsWith("align-")).every((c) => !c.disabled)).toBe(true);
    expect(two.filter((c) => c.id.startsWith("distribute-")).every((c) => c.disabled)).toBe(true);
  });
});

describe("pickClipboardMedia", () => {
  const file = (name = "shot.png") => new File(["x"], name, { type: "image/png" });

  it("prefers the first file (screenshot paste)", () => {
    const picked = pickClipboardMedia({ files: [file()], getText: () => "https://example.com/a.png" });
    expect(picked).toEqual({ kind: "file", file: expect.any(File) });
  });

  it("falls back to an http(s) text URL", () => {
    expect(pickClipboardMedia({ getText: () => " https://example.com/a.png " })).toEqual({
      kind: "url",
      url: "https://example.com/a.png"
    });
  });

  it("returns null for plain text or nothing at all", () => {
    expect(pickClipboardMedia({ getText: () => "just text" })).toBeNull();
    expect(pickClipboardMedia({ files: null, getText: () => "" })).toBeNull();
    expect(pickClipboardMedia(undefined)).toBeNull();
  });
});
