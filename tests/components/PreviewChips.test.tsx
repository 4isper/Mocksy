// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PreviewChips, PreviewZoomControl, PreviewGridToggle } from "@/components/editor/PreviewChips";
import { useEditorStore } from "@/lib/state/editorStore";
import { GRID_DIVISION_OPTIONS } from "@/lib/render/grid";
import { snapZoom, sliderToZoom, zoomToSlider, resolveZoomScale, ZOOM_SLIDER_MAX } from "@/lib/render/previewViewport";

afterEach(() => {
  cleanup();
  useEditorStore.setState({
    previewZoom: "fit",
    previewPan: { x: 0, y: 0 },
  });
});

describe("PreviewChips", () => {
  const onFile = vi.fn();

  afterEach(() => {
    onFile.mockClear();
  });

  it("renders upload and clear chips in single-frame mode when media exists", () => {
    render(<PreviewChips isMultiFrame={false} canClearActive={true} targetLayerId={null} fileInputKey={1} onFile={onFile} />);
    expect(screen.getByText("editor.uploadMedia")).toBeInTheDocument();
    expect(screen.getByText("editor.clearMedia")).toBeInTheDocument();
  });

  it("hides the clear chip in single-frame mode without media", () => {
    render(<PreviewChips isMultiFrame={false} canClearActive={false} targetLayerId={null} fileInputKey={1} onFile={onFile} />);
    expect(screen.getByText("editor.uploadMedia")).toBeInTheDocument();
    expect(screen.queryByText("editor.clearMedia")).not.toBeInTheDocument();
  });

  it("clears the active layer in single-frame mode", () => {
    render(<PreviewChips isMultiFrame={false} canClearActive={true} targetLayerId={null} fileInputKey={1} onFile={onFile} />);
    fireEvent.click(screen.getByText("editor.clearMedia"));
    const layer = useEditorStore.getState().scene.layers[0]!;
    expect(layer.mediaUrl).toBeNull();
    expect(layer.mediaType).toBe("none");
  });

  it("shows an upload chip in multi-frame mode when there is nothing to clear", () => {
    render(<PreviewChips isMultiFrame={true} canClearActive={false} targetLayerId="layer-x" fileInputKey={1} onFile={onFile} />);
    expect(screen.getByText("editor.uploadMedia")).toBeInTheDocument();
    expect(screen.queryByText("editor.clearMedia")).not.toBeInTheDocument();
  });

  it("clears the target instance layer in multi-frame mode", () => {
    const { scene } = useEditorStore.getState();
    useEditorStore.setState({
      scene: {
        ...scene,
        layers: [
          { ...scene.layers[0]!, id: "frame-layer" },
          { ...scene.layers[0]!, id: "other", mediaUrl: "test.jpg", mediaType: "image" as const },
        ],
      },
    });
    render(<PreviewChips isMultiFrame={true} canClearActive={true} targetLayerId="frame-layer" fileInputKey={1} onFile={onFile} />);
    fireEvent.click(screen.getByText("editor.clearMedia"));
    const frameLayer = useEditorStore.getState().scene.layers.find((l) => l.id === "frame-layer")!;
    expect(frameLayer.mediaUrl).toBeNull();
    const other = useEditorStore.getState().scene.layers.find((l) => l.id === "other")!;
    expect(other.mediaUrl).toBe("test.jpg");
  });

  it("falls back to clearActive for a missing target layer in multi-frame mode", () => {
    render(<PreviewChips isMultiFrame={true} canClearActive={true} targetLayerId={null} fileInputKey={1} onFile={onFile} />);
    fireEvent.click(screen.getByText("editor.clearMedia"));
    expect(useEditorStore.getState().scene.layers[0]!.mediaUrl).toBeNull();
  });

  it("opens the file dialog and forwards the picked file through onFile", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    render(<PreviewChips isMultiFrame={true} canClearActive={false} targetLayerId="layer-x" fileInputKey={1} onFile={onFile} />);
    fireEvent.click(screen.getByText("editor.uploadMedia"));
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "a.png", { type: "image/png" })] } });
    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile.mock.calls[0]![1]).toBe("layer-x");
    clickSpy.mockRestore();
  });
});

describe("PreviewZoomControl", () => {
  it("zooms out and in with the step buttons", () => {
    render(<PreviewZoomControl />);
    fireEvent.click(screen.getByRole("button", { name: /editor.zoomIn/ }));
    let zoom = useEditorStore.getState().previewZoom;
    expect(zoom).not.toBe("fit");
    const first = zoom;
    fireEvent.click(screen.getByRole("button", { name: /editor.zoomOut/ }));
    expect(useEditorStore.getState().previewZoom).not.toBe(first);
  });

  it("resets to 100% when the percentage label is clicked", () => {
    useEditorStore.setState({ previewZoom: 2, previewPan: { x: 10, y: 20 } });
    render(<PreviewZoomControl />);
    fireEvent.click(screen.getByText("200%"));
    expect(useEditorStore.getState().previewZoom).toBe(1);
    expect(useEditorStore.getState().previewPan).toEqual({ x: 5, y: 10 });
  });

  it("resets the view via the Fit button", () => {
    useEditorStore.setState({ previewZoom: 1.5, previewPan: { x: 5, y: -5 } });
    render(<PreviewZoomControl />);
    fireEvent.click(screen.getByRole("button", { name: /editor.fit/ }));
    expect(useEditorStore.getState().previewZoom).toBe("fit");
    expect(useEditorStore.getState().previewPan).toEqual({ x: 0, y: 0 });
  });

  it("changes zoom through the slider", () => {
    const initial = resolveZoomScale("fit");
    render(<PreviewZoomControl />);
    const slider = screen.getByRole("slider", { name: /editor.previewZoom/ }) as HTMLInputElement;
    const from = zoomToSlider(initial);
    const to = Math.min(from + 10, ZOOM_SLIDER_MAX);
    fireEvent.change(slider, { target: { value: String(to) } });
    expect(useEditorStore.getState().previewZoom).toBe(snapZoom(sliderToZoom(to)));
  });
});

describe("PreviewGridToggle", () => {
  it("toggles the grid and adjusts divisions", () => {
    const setShowGrid = vi.fn();
    const setGridDivisions = vi.fn();
    const { rerender } = render(
      <PreviewGridToggle showGrid={false} gridDivisions={4} setShowGrid={setShowGrid} setGridDivisions={setGridDivisions} />
    );
    const gridButton = screen.getByRole("button", { name: /editor.grid/ });
    expect(gridButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    fireEvent.click(gridButton);
    expect(setShowGrid).toHaveBeenCalledWith(true);
    rerender(<PreviewGridToggle showGrid={true} gridDivisions={4} setShowGrid={setShowGrid} setGridDivisions={setGridDivisions} />);
    expect(screen.getByRole("combobox", { name: /editor.gridDivisions/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: /editor.gridDivisions/ }), { target: { value: String(GRID_DIVISION_OPTIONS[1]) } });
    expect(setGridDivisions).toHaveBeenCalledWith(GRID_DIVISION_OPTIONS[1]);
  });
});