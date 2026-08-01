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
});

describe("PreviewCanvas media upload", () => {
  const file = new File(["fake"], "photo.png", { type: "image/png" });

  it("adds a new layer on drop", async () => {
    mockLoadFile.loadMediaFromFile.mockResolvedValue({
      url: "data:image/png;base64,abc",
      mediaType: "image",
      mediaName: "photo.png"
    });
    renderScene();
    const before = useEditorStore.getState().scene.layers.length;
    fireEvent.drop(document.querySelector(".panel")!, { dataTransfer: { files: [file] } });
    await vi.waitFor(() => {
      const scene = useEditorStore.getState().scene;
      expect(scene.layers.length).toBe(before + 1);
      expect(scene.layers[scene.layers.length - 1]?.mediaUrl).toBe("data:image/png;base64,abc");
    });
  });

  it("adds a new layer on file input change", async () => {
    mockLoadFile.loadMediaFromFile.mockResolvedValue({
      url: "data:image/png;base64,xyz",
      mediaType: "image",
      mediaName: "photo.png"
    });
    renderScene();
    const input = document.querySelector('.preview-chip input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { files: [file] } });
    await vi.waitFor(() => {
      const scene = useEditorStore.getState().scene;
      expect(scene.layers[scene.layers.length - 1]?.mediaUrl).toBe("data:image/png;base64,xyz");
    });
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
    expect(panel.style.outline).toContain("#00d9ff");
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
  it("zooms via two-finger pinch", () => {
    renderScene();
    const panel = document.querySelector(".panel") as HTMLElement;
    const touch = (x: number, y: number) => ({ clientX: x, clientY: y });
    fireEvent.touchStart(panel, { touches: [touch(0, 0), touch(100, 0)] });
    fireEvent.touchMove(panel, { touches: [touch(0, 0), touch(150, 0)] });
    expect(useEditorStore.getState().scene.layers[0]?.zoom).toBeCloseTo(1.5);
    fireEvent.touchEnd(panel, { touches: [touch(0, 0)] });
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
