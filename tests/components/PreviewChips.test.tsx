// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PreviewChips, PreviewDockBar, PreviewZoomControl, PreviewGridToggle } from "@/components/editor/PreviewChips";
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

  it("keeps upload next to clear in multi-frame mode so media is replaceable in one click", () => {
    render(<PreviewChips isMultiFrame={true} canClearActive={true} targetLayerId="layer-x" fileInputKey={1} onFile={onFile} />);
    expect(screen.getByText("editor.uploadMedia")).toBeInTheDocument();
    expect(screen.getByText("editor.clearMedia")).toBeInTheDocument();
  });

  it("forwards multi-frame replace-uploads to the target layer", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    render(<PreviewChips isMultiFrame={true} canClearActive={true} targetLayerId="layer-x" fileInputKey={1} onFile={onFile} />);
    fireEvent.click(screen.getByText("editor.uploadMedia"));
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "b.png", { type: "image/png" })] } });
    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile.mock.calls[0]![1]).toBe("layer-x");
    clickSpy.mockRestore();
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

describe("PreviewDockBar", () => {
  const dockProps = {
    isMultiFrame: false,
    canClearActive: true,
    targetLayerId: null as string | null,
    fileInputKey: 1,
    onFile: vi.fn(),
    showGrid: false,
    gridDivisions: 4,
    setShowGrid: vi.fn(),
    setGridDivisions: vi.fn()
  };

  it("renders upload, zoom and grid groups in one toolbar", () => {
    render(<PreviewDockBar {...dockProps} />);
    const bar = screen.getByRole("toolbar", { name: "editor.canvasControls" });
    expect(bar).toHaveClass("preview-dock-bar");
    expect(screen.getByText("editor.uploadMedia")).toBeInTheDocument();
    expect(screen.getByText("editor.clearMedia")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /editor.previewZoom/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editor.grid/ })).toBeInTheDocument();
  });

  it("separates the groups with hidden dividers", () => {
    const { container } = render(<PreviewDockBar {...dockProps} />);
    const seps = container.querySelectorAll(".preview-dock-bar > .dock-sep");
    expect(seps.length).toBe(2);
    seps.forEach((s) => expect(s).toHaveAttribute("aria-hidden", "true"));
  });

  it("separates the reset-to-100% value from Fit inside the zoom bar", () => {
    const { container } = render(<PreviewDockBar {...dockProps} />);
    const inner = container.querySelectorAll(".preview-zoom-bar > .dock-sep");
    expect(inner.length).toBe(1);
    expect(inner[0]).toHaveAttribute("aria-hidden", "true");
  });

  it("labels upload/clear buttons for tooltips and compact icon mode", () => {
    render(<PreviewDockBar {...dockProps} />);
    const upload = screen.getByRole("button", { name: "editor.uploadMedia" });
    const clear = screen.getByRole("button", { name: "editor.clearMedia" });
    expect(upload).toHaveAttribute("title", "editor.uploadMedia");
    expect(clear).toHaveAttribute("title", "editor.clearMedia");
    // Icons are decorative; the text label stays for screen readers and is
    // hidden via CSS (.chip-label) only in the compact icon mode.
    expect(upload.querySelector(".chip-label")).toHaveTextContent("editor.uploadMedia");
    expect(clear.querySelector(".chip-label")).toHaveTextContent("editor.clearMedia");
  });

  it("keeps a single tab stop for the whole bar", () => {
    render(<PreviewDockBar {...dockProps} />);
    const stops = document.querySelectorAll('.preview-dock-bar [tabindex="0"]');
    expect(stops.length).toBe(1);
  });

  it("moves focus with arrow keys", () => {
    render(<PreviewDockBar {...dockProps} />);
    const upload = screen.getByRole("button", { name: "editor.uploadMedia" });
    const clear = screen.getByRole("button", { name: "editor.clearMedia" });
    upload.focus();
    fireEvent.keyDown(upload, { key: "ArrowRight" });
    expect(clear).toHaveFocus();
    fireEvent.keyDown(clear, { key: "ArrowLeft" });
    expect(upload).toHaveFocus();
  });

  it("jumps to the ends with Home/End", () => {
    render(<PreviewDockBar {...dockProps} />);
    const upload = screen.getByRole("button", { name: "editor.uploadMedia" });
    const grid = screen.getByRole("button", { name: /editor.grid/ });
    upload.focus();
    fireEvent.keyDown(upload, { key: "End" });
    expect(grid).toHaveFocus();
    fireEvent.keyDown(grid, { key: "Home" });
    expect(upload).toHaveFocus();
  });

  it("leaves slider arrows to the slider", () => {
    render(<PreviewDockBar {...dockProps} />);
    const slider = screen.getByRole("slider", { name: /editor.previewZoom/ });
    slider.focus();
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider).toHaveFocus();
  });

  it("forwards the multi-frame target layer to upload and clear", () => {
    const onFile = vi.fn();
    render(<PreviewDockBar {...dockProps} isMultiFrame targetLayerId="layer-x" onFile={onFile} />);
    const input = document.querySelector('.preview-dock-bar input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "a.png", { type: "image/png" })] } });
    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile.mock.calls[0]![1]).toBe("layer-x");
  });
});