// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LayerBulkActions } from "@/components/editor/LayerBulkActions";
import { useEditorStore } from "@/lib/state/editorStore";
import { initialScene } from "@/lib/state/editorStore";

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
    hidden: false,
    mediaName: null,
    rotation: 0,
    brightness: 100,
    contrast: 100,
    saturate: 100,
    blur: 0,
    grayscale: 0,
    opacity: 100,
    videoMuted: true,
    videoLoop: true,
    videoAutoplay: true,
    videoPosterTime: 0,
    videoQuality: "medium" as const,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  useEditorStore.setState({
    scene: { ...initialScene },
    activeLayerId: initialScene.activeLayerId,
    selectedLayerIds: [],
  });
});

describe("LayerBulkActions", () => {
  it("renders the selected count and action buttons", () => {
    useEditorStore.setState({
      scene: { ...initialScene, layers: [makeLayer("a"), makeLayer("b")] },
      selectedLayerIds: ["a", "b"],
    });
    render(<LayerBulkActions count={2} total={4} />);
    expect(screen.getByText("editor.selectedCount")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editor.toggleVisibility/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editor.duplicateLayer/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editor.deleteLayers/ })).toBeInTheDocument();
    expect(screen.getByText("editor.groupTransform")).toBeInTheDocument();
  });

  it("disables delete when every layer is selected", () => {
    useEditorStore.setState({
      scene: { ...initialScene, layers: [makeLayer("a"), makeLayer("b")] },
      selectedLayerIds: ["a", "b"],
    });
    render(<LayerBulkActions count={2} total={2} />);
    expect(screen.getByRole("button", { name: /editor.deleteLayers/ })).toBeDisabled();
  });

  it("removes the selected layers on delete", () => {
    useEditorStore.setState({
      scene: { ...initialScene, layers: [makeLayer("a", { mediaName: "A" }), makeLayer("b", { mediaName: "B" }), makeLayer("c", { mediaName: "C" })] },
      selectedLayerIds: ["a", "b"],
    });
    render(<LayerBulkActions count={2} total={3} />);
    fireEvent.click(screen.getByRole("button", { name: /editor.deleteLayers/ }));
    expect(useEditorStore.getState().scene.layers.map((l) => l.id)).toEqual(["c"]);
  });

  it("duplicates the selected layers", () => {
    useEditorStore.setState({
      scene: { ...initialScene, layers: [makeLayer("a", { mediaName: "A" }), makeLayer("b", { mediaName: "B" })] },
      selectedLayerIds: ["a", "b"],
    });
    render(<LayerBulkActions count={2} total={2} />);
    fireEvent.click(screen.getByRole("button", { name: /editor.duplicateLayer/ }));
    expect(useEditorStore.getState().scene.layers.length).toBe(4);
  });

  it("toggles visibility for all selected layers", () => {
    useEditorStore.setState({
      scene: { ...initialScene, layers: [makeLayer("a", { hidden: false }), makeLayer("b", { hidden: false })] },
      selectedLayerIds: ["a", "b"],
    });
    render(<LayerBulkActions count={2} total={2} />);
    fireEvent.click(screen.getByRole("button", { name: /editor.toggleVisibility/ }));
    const layers = useEditorStore.getState().scene.layers;
    expect(layers.every((l) => l.hidden)).toBe(true);
  });

  it("shows the group button for multiple selected layers and groups them", () => {
    useEditorStore.setState({
      scene: { ...initialScene, layers: [makeLayer("a"), makeLayer("b")] },
      selectedLayerIds: ["a", "b"],
    });
    render(<LayerBulkActions count={2} total={2} />);
    fireEvent.click(screen.getByRole("button", { name: /editor.group/ }));
    const grouped = useEditorStore.getState().scene.layers;
    expect(grouped[0]!.groupId).toEqual(grouped[1]!.groupId);
  });

  it("shows the ungroup button when every selected layer shares one group", () => {
    useEditorStore.setState({
      scene: { ...initialScene, layers: [makeLayer("a", { groupId: "g1" }), makeLayer("b", { groupId: "g1" })] },
      selectedLayerIds: ["a", "b"],
    });
    render(<LayerBulkActions count={2} total={2} />);
    fireEvent.click(screen.getByRole("button", { name: /editor.ungroup/ }));
    expect(useEditorStore.getState().scene.layers.every((l) => !l.groupId)).toBe(true);
  });

  it("hides the ungroup button when selected layers belong to different groups", () => {
    useEditorStore.setState({
      scene: { ...initialScene, layers: [makeLayer("a", { groupId: "g1" }), makeLayer("b", { groupId: "g2" })] },
      selectedLayerIds: ["a", "b"],
    });
    render(<LayerBulkActions count={2} total={2} />);
    expect(screen.queryByRole("button", { name: /editor.ungroup/ })).not.toBeInTheDocument();
  });

  it("nudges the selection via the arrow buttons", () => {
    useEditorStore.setState({
      scene: { ...initialScene, layers: [makeLayer("a", { mediaOffsetX: 1, mediaOffsetY: 1 })] },
      selectedLayerIds: ["a"],
    });
    render(<LayerBulkActions count={1} total={2} />);
    fireEvent.click(screen.getByRole("button", { name: /editor.nudgeLeft/ }));
    fireEvent.click(screen.getByRole("button", { name: /editor.nudgeUp/ }));
    fireEvent.click(screen.getByRole("button", { name: /editor.nudgeRight/ }));
    fireEvent.click(screen.getByRole("button", { name: /editor.nudgeDown/ }));
    const layer = useEditorStore.getState().scene.layers[0]!;
    expect(layer.mediaOffsetX).toBeCloseTo(1);
    expect(layer.mediaOffsetY).toBeCloseTo(1);
  });

  it("applies a transform to every selected layer via the opacity slider", () => {
    useEditorStore.setState({
      scene: {
        ...initialScene,
        layers: [makeLayer("a", { opacity: 40 }), makeLayer("b", { opacity: 100 })],
      },
      selectedLayerIds: ["a", "b"],
    });
    render(<LayerBulkActions count={2} total={2} />);
    const slider = screen.getByRole("slider", { name: /editor.filterOpacity/ });
    expect(slider).toHaveValue("40");
    fireEvent.change(slider, { target: { value: "60" } });
    expect(useEditorStore.getState().scene.layers.map((l) => l.opacity)).toEqual([60, 60]);
  });

  it("applies a transform via the rotation slider seeded from the first layer", () => {
    useEditorStore.setState({
      scene: {
        ...initialScene,
        layers: [makeLayer("a", { rotation: 10 }), makeLayer("b", { rotation: 0 })],
      },
      selectedLayerIds: ["a", "b"],
    });
    render(<LayerBulkActions count={2} total={2} />);
    const slider = screen.getByRole("slider", { name: /editor.rotation/ });
    expect(slider).toHaveValue("10");
    fireEvent.change(slider, { target: { value: "45" } });
    expect(useEditorStore.getState().scene.layers.map((l) => l.rotation)).toEqual([45, 45]);
  });

  it("applies a zoom transform to the selection", () => {
    useEditorStore.setState({
      scene: { ...initialScene, layers: [makeLayer("a", { zoom: 1 }), makeLayer("b", { zoom: 1 })] },
      selectedLayerIds: ["a", "b"],
    });
    render(<LayerBulkActions count={2} total={2} />);
    const slider = screen.getByRole("slider", { name: /editor.zoom/ });
    fireEvent.change(slider, { target: { value: "1.5" } });
    expect(useEditorStore.getState().scene.layers.map((l) => l.zoom)).toEqual([1.5, 1.5]);
  });

  it("seeds the sliders from the first selected layer when present", () => {
    useEditorStore.setState({
      scene: { ...initialScene, layers: [makeLayer("a", { zoom: 2 })] },
      selectedLayerIds: ["a"],
    });
    render(<LayerBulkActions count={1} total={3} />);
    expect(screen.getByRole("slider", { name: /editor.zoom/ })).toHaveValue("2");
  });
});