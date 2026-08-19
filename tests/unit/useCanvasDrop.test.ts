// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCanvasDrop } from "@/lib/hooks/useCanvasDrop";
import { useEditorStore } from "@/lib/state/editorStore";
import { initialScene } from "@/lib/state/editorScene";
import type { EditorScene } from "@/lib/types/editor";

const mockLoadFile = vi.hoisted(() => ({
  loadMediaFromFile: vi.fn(),
  UnsupportedMediaError: class UnsupportedMediaError extends Error {}
}));
vi.mock("@/lib/media/loadFile", () => mockLoadFile);

afterEach(() => {
  mockLoadFile.loadMediaFromFile.mockReset();
  vi.restoreAllMocks();
  useEditorStore.setState({ scene: { ...initialScene }, mediaUploadError: null });
});

function renderDrop(overrides?: Partial<EditorScene>) {
  const scene: EditorScene = { ...initialScene, ...overrides, layers: overrides?.layers ?? initialScene.layers };
  return renderHook(() => useCanvasDrop({ scene }));
}

const file = new File(["x"], "a.png", { type: "image/png" });

describe("useCanvasDrop", () => {
  it("loads media onto the active layer on drop", async () => {
    mockLoadFile.loadMediaFromFile.mockResolvedValue({ url: "data:img", mediaType: "image", mediaName: "a.png" });
    const { result } = renderDrop();
    await act(async () => {
      result.current.handleDrop({ preventDefault: vi.fn(), dataTransfer: { files: [file] } } as unknown as React.DragEvent<HTMLDivElement>);
    });
    await vi.waitFor(() => {
      const layer = useEditorStore.getState().scene.layers[0];
      expect(layer?.mediaUrl).toBe("data:img");
    });
  });

  it("surfaces an unsupported-media error", async () => {
    mockLoadFile.loadMediaFromFile.mockRejectedValue(new mockLoadFile.UnsupportedMediaError("bad"));
    const { result } = renderDrop();
    await act(async () => {
      result.current.handleDrop({ preventDefault: vi.fn(), dataTransfer: { files: [file] } } as unknown as React.DragEvent<HTMLDivElement>);
    });
    await vi.waitFor(() => {
      expect(useEditorStore.getState().mediaUploadError).toBe("bad");
    });
  });

  it("bumps the file input key after a successful pick so the same file re-triggers", async () => {
    mockLoadFile.loadMediaFromFile.mockResolvedValue({ url: "data:img", mediaType: "image", mediaName: "a.png" });
    const { result } = renderDrop();
    const before = result.current.fileInputKey;
    await act(async () => {
      await result.current.handleFile({ target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>);
    });
    expect(result.current.fileInputKey).toBe(before + 1);
  });

  it("tracks drag depth for the drop outline", () => {
    const { result } = renderDrop();
    act(() => result.current.onDragEnter({ preventDefault: vi.fn() } as unknown as React.DragEvent<HTMLDivElement>));
    expect(result.current.isDragging).toBe(true);
    act(() => result.current.onDragLeave());
    expect(result.current.isDragging).toBe(false);
  });
});
