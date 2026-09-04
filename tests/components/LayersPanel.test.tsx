// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LayersPanel } from "@/components/editor/LayersPanel";
import { useEditorStore } from "@/lib/state/editorStore";
import { loadMediaFromFile, UnsupportedMediaError } from "@/lib/media/loadFile";

vi.mock("@/lib/media/loadFile", () => ({
  loadMediaFromFile: vi.fn(),
  UnsupportedMediaError: class extends Error { name = "UnsupportedMediaError" },
}));

const mockLoad = vi.mocked(loadMediaFromFile);

function makeLayer(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    mediaUrl: null,
    mediaType: "none" as const,
    zoom: 1,
    mediaOffsetX: 0,
    mediaOffsetY: 0,
    animationPreset: "none" as const,
    mediaFit: "cover" as const,
    videoDuration: 0,
    videoTrimStart: 0,
    videoTrimEnd: 0,
    videoMuted: false,
    videoLoop: false,
    videoAutoplay: false,
    videoPosterTime: 0,
    videoQuality: "medium" as const,
    hidden: false,
    mediaName: null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useEditorStore.setState({ scene: useEditorStore.getState().scene });
});

describe("LayersPanel", () => {
  it("renders add layer button", () => {
    render(<LayersPanel />);
    expect(screen.getByText(/editor.addLayer/i)).toBeInTheDocument();
  });

  it("renders layer list items", () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [makeLayer("a", { mediaName: "Layer A" }), makeLayer("b", { mediaName: "Layer B" })],
        activeLayerId: "a",
      },
      activeLayerId: "a"
    });
    render(<LayersPanel />);
    expect(screen.getByText("Layer A")).toBeInTheDocument();
    expect(screen.getByText("Layer B")).toBeInTheDocument();
  });

  it("selects layer on click", async () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [makeLayer("a", { mediaName: "A" }), makeLayer("b", { mediaName: "B" })],
        activeLayerId: "a",
      },
      activeLayerId: "a"
    });
    render(<LayersPanel />);
    await userEvent.click(screen.getByText("B"));
    expect(useEditorStore.getState().activeLayerId).toBe("b");
  });

  it("duplicates layer on duplicate button click", async () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [makeLayer("a", { mediaName: "A" })],
        activeLayerId: "a",
      },
      activeLayerId: "a"
    });
    render(<LayersPanel />);
    const dupBtns = screen.getAllByRole("button", { name: /editor.duplicateLayer/i });
    await userEvent.click(dupBtns[0]!);
    expect(useEditorStore.getState().scene.layers.length).toBe(2);
  });

  it("toggles layer visibility on hide button click", async () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [makeLayer("a", { mediaName: "A", hidden: false })],
        activeLayerId: "a",
      },
      activeLayerId: "a"
    });
    render(<LayersPanel />);
    const hideBtn = screen.getByRole("button", { name: /editor.hideLayer/i });
    await userEvent.click(hideBtn);
    const layer = useEditorStore.getState().scene.layers[0]!;
    expect(layer.hidden).toBe(true);
  });

  it("removes layer on delete click", async () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [makeLayer("a", { mediaName: "A" }), makeLayer("b", { mediaName: "B" })],
        activeLayerId: "a",
      },
      activeLayerId: "a"
    });
    render(<LayersPanel />);
    const removeBtns = screen.getAllByRole("button", { name: /editor.removeLayer/i });
    await userEvent.click(removeBtns[0]!);
    expect(useEditorStore.getState().scene.layers.length).toBe(1);
  });

  it("shows clear media button when active layer has media", () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [makeLayer("a", { mediaUrl: "test.jpg", mediaType: "image", mediaName: "Test" })],
        activeLayerId: "a",
      },
      activeLayerId: "a"
    });
    render(<LayersPanel />);
    expect(screen.getByText("editor.clearMedia")).toBeInTheDocument();
  });

  it("reorders layers via drag-and-drop", () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [
          makeLayer("a", { mediaName: "A" }),
          makeLayer("b", { mediaName: "B" }),
          makeLayer("c", { mediaName: "C" }),
        ],
        activeLayerId: "a",
      },
      activeLayerId: "a"
    });
    render(<LayersPanel />);
    const items = screen.getAllByRole("option");
    const a = items[0]!;
    const b = items[1]!;
    expect(a).toHaveTextContent("A");
    expect(b).toHaveTextContent("B");

    // Drag "A" and hover it below the midpoint of "B".
    fireEvent.dragStart(a);
    fireEvent.dragOver(b, { clientY: 100 });
    expect(useEditorStore.getState().scene.layers.map((l) => l.mediaName)).toEqual(["B", "A", "C"]);
  });

  it("drops the dragged layer above the target", () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [
          makeLayer("a", { mediaName: "A" }),
          makeLayer("b", { mediaName: "B" }),
          makeLayer("c", { mediaName: "C" }),
        ],
        activeLayerId: "a",
      },
      activeLayerId: "a"
    });
    render(<LayersPanel />);
    const items = screen.getAllByRole("option");
    const a = items[0]!;
    const b = items[1]!;
    const c = items[2]!;
    // Force a tall rect so clientY=100 is below the midpoint -> "below".
    const rect = { top: 0, bottom: 300, height: 300 } as DOMRect;
    b.getBoundingClientRect = () => rect;

    fireEvent.dragStart(a);
    fireEvent.dragOver(b, { clientY: 100 });
    fireEvent.drop(b, { clientY: 100 });
    expect(useEditorStore.getState().scene.layers.map((l) => l.mediaName)).toEqual(["B", "A", "C"]);
    expect(c).toHaveTextContent("C");
  });

  it("collapses a drag sequence into a single undo step", () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [
          makeLayer("a", { mediaName: "A" }),
          makeLayer("b", { mediaName: "B" }),
          makeLayer("c", { mediaName: "C" }),
        ],
        activeLayerId: "a",
      },
      activeLayerId: "a"
    });
    render(<LayersPanel />);
    const items = screen.getAllByRole("option");
    const a = items[0]!;
    const b = items[1]!;
    fireEvent.dragStart(a);
    fireEvent.dragOver(b, { clientY: 100 });

    const { undo } = useEditorStore.getState();
    undo();
    // A single coalesced step returns to the original order.
    expect(useEditorStore.getState().scene.layers.map((l) => l.mediaName)).toEqual(["A", "B", "C"]);
  });

  it("does not reorder when dragging a layer over itself", () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [
          makeLayer("a", { mediaName: "A" }),
          makeLayer("b", { mediaName: "B" }),
        ],
        activeLayerId: "a",
      },
      activeLayerId: "a"
    });
    render(<LayersPanel />);
    const a = screen.getAllByRole("option")[0]!;
    fireEvent.dragStart(a);
    fireEvent.dragOver(a, { clientY: 0 });
    expect(useEditorStore.getState().scene.layers.map((l) => l.mediaName)).toEqual(["A", "B"]);
  });

  it("uploads media and adds a new layer", async () => {
    mockLoad.mockResolvedValue({ url: "blob:layer", mediaType: "image", mediaName: "pic.png" });
    render(<LayersPanel />);
    const input = document.querySelector('input[accept="image/*,video/*"]') as HTMLInputElement;
    await userEvent.upload(input, new File(["x"], "pic.png", { type: "image/png" }));
    await waitFor(() => expect(useEditorStore.getState().scene.layers.length).toBeGreaterThan(1));
    const newLayer = useEditorStore.getState().scene.layers.at(-1)!;
    expect(newLayer.mediaUrl).toBe("blob:layer");
    expect(newLayer.mediaType).toBe("image");
    expect(newLayer.mediaName).toBe("pic.png");
  });

  it("shows the unsupported-media error on upload failure", async () => {
    mockLoad.mockRejectedValue(new UnsupportedMediaError("bad format"));
    render(<LayersPanel />);
    const input = document.querySelector('input[accept="image/*,video/*"]') as HTMLInputElement;
    await userEvent.upload(input, new File(["x"], "x.mov", { type: "video/quicktime" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("bad format");
  });

  it("shows a generic upload error for unexpected failures", async () => {
    mockLoad.mockRejectedValue(new Error("boom"));
    render(<LayersPanel />);
    const input = document.querySelector('input[accept="image/*,video/*"]') as HTMLInputElement;
    await userEvent.upload(input, new File(["x"], "x.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("editor.uploadError");
  });

  it("moves a layer up via the move-up button", async () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [makeLayer("a", { mediaName: "A" }), makeLayer("b", { mediaName: "B" }), makeLayer("c", { mediaName: "C" })],
        activeLayerId: "b",
      },
      activeLayerId: "b"
    });
    render(<LayersPanel />);
    await userEvent.click(screen.getByRole("button", { name: /editor.moveUp/ }));
    expect(useEditorStore.getState().scene.layers.map((l) => l.mediaName)).toEqual(["B", "A", "C"]);
  });

  it("moves a layer down via the move-down button", async () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [makeLayer("a", { mediaName: "A" }), makeLayer("b", { mediaName: "B" }), makeLayer("c", { mediaName: "C" })],
        activeLayerId: "a",
      },
      activeLayerId: "a"
    });
    render(<LayersPanel />);
    await userEvent.click(screen.getByRole("button", { name: /editor.moveDown/ }));
    expect(useEditorStore.getState().scene.layers.map((l) => l.mediaName)).toEqual(["B", "A", "C"]);
  });

  it("disables move-up for the top layer and move-down for the bottom layer", async () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [makeLayer("a", { mediaName: "A" }), makeLayer("b", { mediaName: "B" })],
        activeLayerId: "a",
      },
      activeLayerId: "a"
    });
    render(<LayersPanel />);
    // Active layer is the top layer: move-up disabled, move-down enabled.
    expect(screen.getByRole("button", { name: /editor.moveUp/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /editor.moveDown/ })).toBeEnabled();

    // Switch the active layer to the bottom row: move-down becomes disabled.
    useEditorStore.setState({ activeLayerId: "b" });
    await waitFor(() => expect(screen.getByRole("button", { name: /editor.moveDown/ })).toBeDisabled());
    expect(screen.getByRole("button", { name: /editor.moveUp/ })).toBeEnabled();
  });

  it("disables remove when only one layer remains", () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [makeLayer("a", { mediaName: "A" })],
        activeLayerId: "a",
      },
      activeLayerId: "a"
    });
    render(<LayersPanel />);
    expect(screen.getByRole("button", { name: /editor.removeLayer/ })).toBeDisabled();
  });

  it("renders a video layer with the video element and label", () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [makeLayer("a", { mediaUrl: "data:video/mp4;base64,AAAA", mediaType: "video", mediaName: null })],
        activeLayerId: "a",
      },
      activeLayerId: "a"
    });
    render(<LayersPanel />);
    expect(document.querySelector("video")).not.toBeNull();
    expect(screen.getByLabelText("editor.videoLabel")).toBeInTheDocument();
  });

  it("clears the active layer's media via the clear button", async () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [makeLayer("a", { mediaUrl: "test.jpg", mediaType: "image", mediaName: "Test" })],
        activeLayerId: "a",
      },
      activeLayerId: "a"
    });
    render(<LayersPanel />);
    await userEvent.click(screen.getByText("editor.clearMedia"));
    const layer = useEditorStore.getState().scene.layers[0]!;
    expect(layer.mediaUrl).toBeNull();
    expect(layer.mediaType).toBe("none");
  });

  it("renames a layer via double-click and Enter", async () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [makeLayer("a", { mediaName: "Old name" })],
        activeLayerId: "a",
      },
      activeLayerId: "a"
    });
    render(<LayersPanel />);
    await userEvent.dblClick(screen.getByText("Old name"));
    const input = screen.getByLabelText("editor.renameLayer") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(useEditorStore.getState().scene.layers[0]!.mediaName).toBe("Renamed");
  });

  it("multi-selects and deletes several layers at once", async () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [
          makeLayer("a", { mediaName: "A" }),
          makeLayer("b", { mediaName: "B" }),
          makeLayer("c", { mediaName: "C" }),
        ],
        activeLayerId: "a",
      },
      activeLayerId: "a",
      selectedLayerIds: ["a"],
    });
    const st = useEditorStore.getState();
    st.toggleLayerSelected("b");
    st.toggleLayerSelected("c");
    expect(useEditorStore.getState().selectedLayerIds.sort()).toEqual(["a", "b", "c"]);
    useEditorStore.getState().removeLayers(["a", "b"]);
    // Two of three layers removed; one remains.
    expect(useEditorStore.getState().scene.layers.length).toBe(1);
  });

  it("duplicates multiple selected layers", async () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [
          makeLayer("a", { mediaName: "A" }),
          makeLayer("b", { mediaName: "B" }),
        ],
        activeLayerId: "a",
      },
      activeLayerId: "a",
      selectedLayerIds: ["a", "b"],
    });
    useEditorStore.getState().duplicateLayers(["a", "b"]);
    const layers = useEditorStore.getState().scene.layers;
    expect(layers.length).toBe(4);
    expect(layers.filter((l) => l.mediaName === "A").length).toBe(2);
    expect(layers.filter((l) => l.mediaName === "B").length).toBe(2);
  });

  it("toggles layer lock on lock button click", async () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [makeLayer("a", { mediaName: "A", locked: false })],
        activeLayerId: "a",
      },
      activeLayerId: "a"
    });
    render(<LayersPanel />);
    await userEvent.click(screen.getByRole("button", { name: /editor.lockLayer/i }));
    expect(useEditorStore.getState().scene.layers[0]!.locked).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /editor.unlockLayer/i }));
    expect(useEditorStore.getState().scene.layers[0]!.locked).toBe(false);
  });

  it("disables remove for a locked layer", () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [makeLayer("a", { mediaName: "A", locked: true }), makeLayer("b", { mediaName: "B" })],
        activeLayerId: "a",
      },
      activeLayerId: "a"
    });
    render(<LayersPanel />);
    expect(screen.getByRole("button", { name: /editor.removeLayer/i })).toBeDisabled();
  });

  it("reorders layers by dragging the grip with a touch pointer", () => {
    // HTML5 dragstart never fires on touch; the grip's pointer path must
    // reorder the list instead.
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [makeLayer("a", { mediaName: "A" }), makeLayer("b", { mediaName: "B" })],
        activeLayerId: "a",
      },
      activeLayerId: "a"
    });
    vi.spyOn(HTMLElement.prototype, "setPointerCapture").mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, "releasePointerCapture").mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, "hasPointerCapture").mockReturnValue(true);
    render(<LayersPanel />);
    const grip = document.querySelector('[data-reorder-id="a"] .layer-grip') as HTMLElement;
    fireEvent.pointerDown(grip, { pointerType: "touch", pointerId: 1, clientX: 10, clientY: 10 });
    // The finger hovers over row B's lower half (zero-height rects in
    // happy-dom put any positive Y below the midpoint → "below").
    vi.spyOn(document, "elementFromPoint").mockReturnValue(document.querySelector('[data-reorder-id="b"]'));
    fireEvent.pointerMove(grip, { pointerType: "touch", pointerId: 1, clientX: 10, clientY: 30 });
    fireEvent.pointerUp(grip, { pointerType: "touch", pointerId: 1, clientX: 10, clientY: 30 });
    expect(useEditorStore.getState().scene.layers.map((l) => l.id)).toEqual(["b", "a"]);
  });
});
