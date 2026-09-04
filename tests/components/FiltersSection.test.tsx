// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FiltersSection } from "@/components/editor/sections/FiltersSection";
import { useEditorStore } from "@/lib/state/editorStore";
import { initialScene } from "@/lib/state/editorStore";
import { removeImageBackground } from "@/lib/media/backgroundRemoval";

vi.mock("@/lib/media/backgroundRemoval", () => ({
  canRemoveBackground: vi.fn((layer: { mediaType?: string; mediaUrl?: unknown } | undefined) =>
    !!layer && layer.mediaType === "image" && typeof layer.mediaUrl === "string" && layer.mediaUrl.length > 0
  ),
  cutoutMediaName: (name: string | null) => (name ? `${name} (cutout)` : null),
  removeImageBackground: vi.fn()
}));

const mockRemoveBg = vi.mocked(removeImageBackground);

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
    locked: false,
    blendMode: "normal" as const,
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
  vi.clearAllMocks();
  useEditorStore.setState({
    scene: { ...initialScene },
    activeLayerId: initialScene.activeLayerId,
    isRemovingBackground: false,
    mediaUploadError: null,
  });
  window.localStorage.removeItem("mocksy.controlPanel.sections");
});

async function openSection() {
  const header = screen.getByRole("button", { name: "editor.filters" });
  if (header.getAttribute("aria-expanded") === "false") {
    fireEvent.click(header);
  }
}

describe("FiltersSection", () => {
  it("changes brightness, contrast, saturate, blur, grayscale and opacity sliders", async () => {
    render(<FiltersSection />);
    await openSection();
    fireEvent.change(screen.getByRole("slider", { name: /editor.filterBrightness/ }), { target: { value: "120" } });
    expect(useEditorStore.getState().scene.layers[0]!.brightness).toBe(120);
    fireEvent.change(screen.getByRole("slider", { name: /editor.filterContrast/ }), { target: { value: "80" } });
    expect(useEditorStore.getState().scene.layers[0]!.contrast).toBe(80);
    fireEvent.change(screen.getByRole("slider", { name: /editor.filterSaturate/ }), { target: { value: "150" } });
    expect(useEditorStore.getState().scene.layers[0]!.saturate).toBe(150);
    fireEvent.change(screen.getByRole("slider", { name: /editor.filterBlur/ }), { target: { value: "6" } });
    expect(useEditorStore.getState().scene.layers[0]!.blur).toBe(6);
    fireEvent.change(screen.getByRole("slider", { name: /editor.filterGrayscale/ }), { target: { value: "50" } });
    expect(useEditorStore.getState().scene.layers[0]!.grayscale).toBe(50);
    fireEvent.change(screen.getByRole("slider", { name: /editor.filterOpacity/ }), { target: { value: "70" } });
    expect(useEditorStore.getState().scene.layers[0]!.opacity).toBe(70);
  });

  it("applies a blend mode via the select", async () => {
    render(<FiltersSection />);
    await openSection();
    const select = screen.getByRole("combobox", { name: /editor.blendMode/ });
    fireEvent.change(select, { target: { value: "multiply" } });
    expect(useEditorStore.getState().scene.layers[0]!.blendMode).toBe("multiply");
  });

  it("resets every filter from the reset button", async () => {
    useEditorStore.setState({
      scene: {
        ...initialScene,
        layers: [makeLayer("a", { brightness: 30, contrast: 40, saturate: 20, blur: 10, grayscale: 5, opacity: 25 })],
      },
      activeLayerId: "a",
    });
    render(<FiltersSection />);
    await openSection();
    fireEvent.click(screen.getByRole("button", { name: /editor.resetFilters/ }));
    const layer = useEditorStore.getState().scene.layers[0]!;
    expect(layer.brightness).toBe(100);
    expect(layer.contrast).toBe(100);
    expect(layer.saturate).toBe(100);
    expect(layer.blur).toBe(0);
    expect(layer.grayscale).toBe(0);
    expect(layer.opacity).toBe(100);
  });

  it("shows the locked hint and disables controls for a locked layer", async () => {
    useEditorStore.setState({
      scene: { ...initialScene, layers: [makeLayer("a", { locked: true })] },
      activeLayerId: "a",
    });
    render(<FiltersSection />);
    await openSection();
    expect(screen.getByRole("status")).toHaveTextContent("editor.layerLockedHint");
    expect(screen.getByRole("slider", { name: /editor.filterBrightness/ })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: /editor.blendMode/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /editor.resetFilters/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /editor.removeBackground/ })).not.toBeInTheDocument();
  });

  function setImageLayer() {
    useEditorStore.setState({
      scene: { ...initialScene, layers: [makeLayer("a", { mediaUrl: "data:image/png;base64,AAA", mediaType: "image", mediaName: "photo.png" })] },
      activeLayerId: "a",
    });
  }

  it("removes the background of an image layer", async () => {
    mockRemoveBg.mockResolvedValue("data:image/png;base64,CUTOUT");
    setImageLayer();
    render(<FiltersSection />);
    await openSection();
    const button = screen.getByRole("button", { name: /editor.removeBackground/ });
    fireEvent.click(button);
    expect(useEditorStore.getState().isRemovingBackground).toBe(true);
    await waitFor(() => expect(useEditorStore.getState().isRemovingBackground).toBe(false));
    const layer = useEditorStore.getState().scene.layers[0]!;
    expect(layer.mediaUrl).toBe("data:image/png;base64,CUTOUT");
    expect(layer.mediaType).toBe("image");
  });

  it("shows the removing-background progress label while busy", async () => {
    let resolveCut: (url: string) => void = () => {};
    mockRemoveBg.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveCut = resolve;
        })
    );
    setImageLayer();
    render(<FiltersSection />);
    await openSection();
    fireEvent.click(screen.getByRole("button", { name: /editor.removeBackground/ }));
    expect(screen.getByRole("button", { name: /editor.removingBackground/ })).toBeDisabled();
    resolveCut("data:image/png;base64,DONE");
    await waitFor(() => expect(screen.queryByRole("button", { name: /editor.removingBackground/ })).not.toBeInTheDocument());
  });

  it("surfaces an error when background removal fails", async () => {
    mockRemoveBg.mockRejectedValue(new Error("boom"));
    setImageLayer();
    render(<FiltersSection />);
    await openSection();
    fireEvent.click(screen.getByRole("button", { name: /editor.removeBackground/ }));
    await waitFor(() => expect(useEditorStore.getState().mediaUploadError).toBe("editor.removeBackgroundError"));
  });

  it("hides the remove-background button for a layer without media", async () => {
    useEditorStore.setState({
      scene: { ...initialScene, layers: [makeLayer("a", { mediaType: "none", mediaUrl: null })] },
      activeLayerId: "a",
    });
    render(<FiltersSection />);
    await openSection();
    expect(screen.queryByRole("button", { name: /editor.removeBackground/ })).not.toBeInTheDocument();
  });
});