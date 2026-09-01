// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PreviewCanvas } from "@/components/editor/PreviewCanvas";
import { useEditorStore } from "@/lib/state/editorStore";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";

const mockLoadFile = vi.hoisted(() => ({
  loadMediaFromFile: vi.fn(),
  UnsupportedMediaError: class UnsupportedMediaError extends Error {}
}));
vi.mock("@/lib/media/loadFile", () => mockLoadFile);

// Stub rAF so useFrameTransform doesn't hang
vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(42));
vi.stubGlobal("cancelAnimationFrame", vi.fn());

beforeEach(() => {
  mockLoadFile.loadMediaFromFile.mockReset();
  vi.spyOn(HTMLElement.prototype, "setPointerCapture").mockImplementation(() => {});
  vi.spyOn(HTMLElement.prototype, "hasPointerCapture").mockReturnValue(true);
  vi.spyOn(HTMLElement.prototype, "releasePointerCapture").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useEditorStore.setState({
    scene: { ...initialScene },
    isMediaLoading: false,
    scenePalette: null,
    selectedAnnotationId: null,
    showGrid: false,
    gridDivisions: 12,
  });
});

function renderScene(overrides?: Partial<EditorScene>) {
  const scene: EditorScene = {
    ...initialScene,
    ...overrides,
    layers: overrides?.layers ?? initialScene.layers,
    annotations: overrides?.annotations ?? [],
  };
  return render(<PreviewCanvas scene={scene} />);
}

describe("PreviewCanvas", () => {
  it("renders the preview canvas", () => {
    renderScene();
    const canvas = document.querySelector("#preview-canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("renders upload media label", () => {
    renderScene();
    expect(screen.getByText("editor.uploadMedia")).toBeInTheDocument();
  });

  it("renders drop hint when no media on any layer", () => {
    const scene: EditorScene = {
      ...initialScene,
      layers: [{ ...initialScene.layers[0]!, mediaUrl: null, mediaType: "none" }],
      annotations: [],
    };
    render(<PreviewCanvas scene={scene} />);
    expect(screen.getByText("editor.dropToStart")).toBeInTheDocument();
  });

  it("renders clear media button when there is media", () => {
    renderScene();
    expect(screen.getByText("editor.clearMedia")).toBeInTheDocument();
  });

  it("renders watermark text when enabled", () => {
    renderScene({ watermarkEnabled: true, annotations: [] });
    expect(screen.getByText("Mocksy")).toBeInTheDocument();
  });

  it("renders watermark in bottom-right by default", () => {
    renderScene({ watermarkEnabled: true, annotations: [] });
    const watermark = screen.getByText("Mocksy");
    expect(watermark.className).toBe("preview-watermark");
  });

  it("does not render watermark when disabled", () => {
    renderScene();
    expect(screen.queryByText("Mocksy")).not.toBeInTheDocument();
  });

  it("renders annotations when present", () => {
    const annotations = [
      { id: "a1", type: "text" as const, text: "Hello", x: 0, y: 0, w: 0.2, h: 0.1, color: "#fff", fontSize: 24, strokeWidth: 2 },
    ];
    renderScene({ annotations });
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders loading indicator when isMediaLoading is true", () => {
    useEditorStore.setState({ isMediaLoading: true });
    const scene: EditorScene = {
      ...initialScene,
      layers: [{ ...initialScene.layers[0]!, mediaUrl: null }],
      annotations: [],
    };
    render(<PreviewCanvas scene={scene} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders frame overlay for overlay frames", () => {
    const scene: EditorScene = {
      ...initialScene,
      frame: "iphone16pro",
      annotations: [],
    };
    render(<PreviewCanvas scene={scene} />);
    const canvas = document.querySelector("#preview-canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("hides the grid overlay by default", () => {
    renderScene();
    expect(document.querySelector("[data-grid-overlay]")).not.toBeInTheDocument();
  });

  it("renders the grid overlay when enabled", () => {
    useEditorStore.setState({ showGrid: true, gridDivisions: 8 });
    renderScene();
    const overlay = document.querySelector("[data-grid-overlay]");
    expect(overlay).toBeInTheDocument();
    expect(overlay?.getAttribute("style") ?? "").toContain("12.5% 12.5%");
  });

  it("toggles the grid via the chip button", () => {
    renderScene();
    const toggle = screen.getByRole("button", { name: "editor.grid" });
    fireEvent.click(toggle);
    expect(useEditorStore.getState().showGrid).toBe(true);
    fireEvent.click(toggle);
    expect(useEditorStore.getState().showGrid).toBe(false);
  });

  it("deletes every selected annotation on Delete", () => {
    const annotations = [
      { id: "a1", type: "text" as const, text: "one", x: 0, y: 0, w: 0.2, h: 0.1, color: "#fff", fontSize: 24, strokeWidth: 2 },
      { id: "a2", type: "text" as const, text: "two", x: 0, y: 0, w: 0.2, h: 0.1, color: "#fff", fontSize: 24, strokeWidth: 2 },
    ];
    useEditorStore.setState({ selectedAnnotationId: "a2", selectedAnnotationIds: ["a1", "a2"] });
    renderScene({ annotations });
    const canvas = document.querySelector("#preview-canvas")!;
    fireEvent.keyDown(canvas, { key: "Delete" });
    expect(useEditorStore.getState().scene.annotations).toHaveLength(0);
    expect(useEditorStore.getState().selectedAnnotationIds).toEqual([]);
  });

  it("deletes the single selected annotation on Backspace", () => {
    const annotations = [
      { id: "a1", type: "text" as const, text: "one", x: 0, y: 0, w: 0.2, h: 0.1, color: "#fff", fontSize: 24, strokeWidth: 2 },
    ];
    useEditorStore.setState({ selectedAnnotationId: "a1", selectedAnnotationIds: ["a1"] });
    renderScene({ annotations });
    const canvas = document.querySelector("#preview-canvas")!;
    fireEvent.keyDown(canvas, { key: "Backspace" });
    expect(useEditorStore.getState().scene.annotations).toHaveLength(0);
    expect(useEditorStore.getState().selectedAnnotationIds).toEqual([]);
  });
});

describe("PreviewCanvas media upload", () => {
  const file = new File(["fake"], "photo.png", { type: "image/png" });

  it("replaces the active layer media on drop", async () => {
    mockLoadFile.loadMediaFromFile.mockResolvedValue({
      url: "data:image/png;base64,abc",
      mediaType: "image",
      mediaName: "photo.png"
    });
    renderScene();
    const before = useEditorStore.getState().scene.layers.length;
    const activeId = useEditorStore.getState().activeLayerId;
    fireEvent.drop(document.querySelector(".panel")!, { dataTransfer: { files: [file] } });
    await vi.waitFor(() => {
      const scene = useEditorStore.getState().scene;
      // Dropping onto the canvas replaces the active layer's media rather
      // than stacking a brand-new layer every time.
      expect(scene.layers.length).toBe(before);
      const active = scene.layers.find((l) => l.id === activeId);
      expect(active?.mediaUrl).toBe("data:image/png;base64,abc");
    });
  });

  it("replaces the active layer media on file input change", async () => {
    mockLoadFile.loadMediaFromFile.mockResolvedValue({
      url: "data:image/png;base64,xyz",
      mediaType: "image",
      mediaName: "photo.png"
    });
    renderScene();
    const activeId = useEditorStore.getState().activeLayerId;
    const input = document.querySelector('.preview-chip-stack input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { files: [file] } });
    await vi.waitFor(() => {
      const scene = useEditorStore.getState().scene;
      const active = scene.layers.find((l) => l.id === activeId);
      expect(active?.mediaUrl).toBe("data:image/png;base64,xyz");
    });
  });

  it("shows an empty-state hint in multi-frame mode with no media", () => {
    renderScene({
      layers: [{ ...initialScene.layers[0]!, id: "x", mediaUrl: null }],
      frameInstances: [{ id: "i1", frame: "iphone", layerId: "x", x: 0.5, y: 0.5, scale: 0.5 }],
      annotations: []
    });
    expect(screen.getByText("editor.dropToStart")).toBeInTheDocument();
  });

  it("shows a drop error for unsupported media", async () => {
    mockLoadFile.loadMediaFromFile.mockRejectedValue(new mockLoadFile.UnsupportedMediaError("unsupported message"));
    renderScene();
    fireEvent.drop(document.querySelector(".panel")!, { dataTransfer: { files: [file] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("unsupported message");
  });

  it("shows the generic upload error for unexpected failures", async () => {
    mockLoadFile.loadMediaFromFile.mockRejectedValue(new Error("boom"));
    renderScene();
    fireEvent.drop(document.querySelector(".panel")!, { dataTransfer: { files: [file] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("editor.uploadError");
  });

  it("clears the active media", () => {
    renderScene();
    fireEvent.click(screen.getByText("editor.clearMedia"));
    const layer = useEditorStore.getState().scene.layers[0];
    expect(layer?.mediaUrl).toBeNull();
    expect(layer?.mediaType).toBe("none");
  });

  it("tracks drag enter/leave to show the drop outline", () => {
    renderScene();
    const panel = document.querySelector(".panel") as HTMLElement;
    fireEvent.dragEnter(panel);
    expect(panel.style.outline).toContain("var(--accent)");
    fireEvent.dragLeave(panel);
    expect(panel.style.outline).toContain("transparent");
  });

  it("ignores drops without a file", async () => {
    renderScene();
    const before = useEditorStore.getState().scene.layers.length;
    fireEvent.drop(document.querySelector(".panel")!, { dataTransfer: { files: [] } });
    expect(useEditorStore.getState().scene.layers.length).toBe(before);
  });
});

describe("PreviewCanvas grid divisions", () => {
  it("changes grid divisions via the select", () => {
    renderScene();
    fireEvent.click(screen.getByRole("button", { name: "editor.grid" }));
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "16" } });
    expect(useEditorStore.getState().gridDivisions).toBe(16);
  });
});

describe("PreviewCanvas gestures", () => {
  it("zooms the layer media via two-finger pinch starting on the frame", () => {
    renderScene();
    const frame = document.querySelector("[data-mockup-frame]") as HTMLElement;
    const touch = (x: number, y: number) => ({ clientX: x, clientY: y });
    fireEvent.touchStart(frame, { touches: [touch(0, 0), touch(100, 0)] });
    fireEvent.touchMove(frame, { touches: [touch(0, 0), touch(150, 0)] });
    expect(useEditorStore.getState().scene.layers[0]?.zoom).toBeCloseTo(1.5);
    fireEvent.touchEnd(frame, { touches: [touch(0, 0)] });
  });

  it("pinch on empty canvas changes the view zoom instead of the layer", () => {
    renderScene();
    const canvas = document.querySelector("#preview-canvas") as HTMLElement;
    const touch = (x: number, y: number) => ({ clientX: x, clientY: y });
    // Native listeners are attached directly to the canvas element.
    fireEvent.touchStart(canvas, { touches: [touch(10, 10), touch(110, 10)] });
    fireEvent.touchMove(canvas, { touches: [touch(10, 10), touch(160, 10)] });
    // Layer media zoom is untouched…
    expect(useEditorStore.getState().scene.layers[0]?.zoom).toBeCloseTo(1);
    // …and the view zoomed in from fit to a numeric scale.
    expect(useEditorStore.getState().previewZoom).not.toBe("fit");
  });

  it("pans the media on pointer drag", () => {
    renderScene();
    const frame = document.querySelector("[data-mockup-frame]") as HTMLElement;
    fireEvent.pointerDown(frame, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(frame, { pointerId: 1, clientX: 101, clientY: 100 });
    const layer = useEditorStore.getState().scene.layers[0];
    expect(layer?.mediaOffsetX).toBe(1);
    expect(layer?.mediaOffsetY).toBe(0);
    fireEvent.pointerUp(frame, { pointerId: 1, clientX: 101, clientY: 100 });
  });

  it("does not start panning without media", () => {
    const scene: EditorScene = {
      ...initialScene,
      layers: [{ ...initialScene.layers[0]!, mediaUrl: null, mediaType: "none" }],
      annotations: [],
    };
    render(<PreviewCanvas scene={scene} />);
    const frame = document.querySelector("[data-mockup-frame]") as HTMLElement;
    fireEvent.pointerDown(frame, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(frame, { pointerId: 1, clientX: 120, clientY: 100 });
    expect(useEditorStore.getState().scene.layers[0]?.mediaOffsetX).toBe(0);
  });
});

describe("PreviewCanvas multi-frame", () => {
  it("renders one instance per frame and selects on Enter", () => {
    const layers: MediaLayer[] = [{ ...initialScene.layers[0]!, id: "l1", mediaUrl: null, mediaType: "none" }];
    const instances = [
      { id: "i1", frame: "iphone16pro" as const, x: 0.1, y: 0.2, scale: 0.5, layerId: "l1" },
      { id: "i2", frame: "iphone16pro" as const, x: 0.5, y: 0.5, scale: 0.5, layerId: "l1" },
    ];
    renderScene({ layers, frameInstances: instances });
    expect(document.querySelectorAll(".frame-instance").length).toBe(2);
    fireEvent.keyDown(document.querySelector(".frame-instance")!, { key: "Enter" });
    expect(useEditorStore.getState().activeFrameInstanceId).toBe("i1");
  });

  it("hides instances whose layer is hidden", () => {
    const layers: MediaLayer[] = [{ ...initialScene.layers[0]!, id: "l1", mediaUrl: null, mediaType: "none", hidden: true }];
    const instances = [
      { id: "i1", frame: "iphone16pro" as const, x: 0.1, y: 0.2, scale: 0.5, layerId: "l1" },
    ];
    renderScene({ layers, frameInstances: instances });
    expect(document.querySelectorAll(".frame-instance").length).toBe(0);
  });
});
