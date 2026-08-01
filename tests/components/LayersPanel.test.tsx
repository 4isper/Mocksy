// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LayersPanel } from "@/components/editor/LayersPanel";
import { useEditorStore } from "@/lib/state/editorStore";

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
      }
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
      }
    });
    render(<LayersPanel />);
    await userEvent.click(screen.getByText("B"));
    expect(useEditorStore.getState().scene.activeLayerId).toBe("b");
  });

  it("duplicates layer on duplicate button click", async () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [makeLayer("a", { mediaName: "A" })],
        activeLayerId: "a",
      }
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
      }
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
      }
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
      }
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
      }
    });
    render(<LayersPanel />);
    const items = screen.getAllByRole("listitem");
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
      }
    });
    render(<LayersPanel />);
    const items = screen.getAllByRole("listitem");
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
      }
    });
    render(<LayersPanel />);
    const items = screen.getAllByRole("listitem");
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
      }
    });
    render(<LayersPanel />);
    const a = screen.getAllByRole("listitem")[0]!;
    fireEvent.dragStart(a);
    fireEvent.dragOver(a, { clientY: 0 });
    expect(useEditorStore.getState().scene.layers.map((l) => l.mediaName)).toEqual(["A", "B"]);
  });
});
