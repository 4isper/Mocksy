// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PreviewCanvas } from "@/components/editor/PreviewCanvas";
import { useEditorStore } from "@/lib/state/editorStore";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene } from "@/lib/types/editor";

// Stub rAF so useFrameTransform doesn't hang
vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(42));
vi.stubGlobal("cancelAnimationFrame", vi.fn());

afterEach(() => {
  cleanup();
  useEditorStore.setState({
    scene: { ...initialScene },
    isMediaLoading: false,
    scenePalette: null,
    selectedAnnotationId: null,
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
});
