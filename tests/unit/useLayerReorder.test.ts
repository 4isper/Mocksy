// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLayerReorder } from "@/lib/hooks/useLayerReorder";
import { useEditorStore } from "@/lib/state/editorStore";
import { initialScene } from "@/lib/state/editorScene";
import type { EditorScene } from "@/lib/types/editor";

afterEach(() => {
  vi.restoreAllMocks();
  useEditorStore.setState({ scene: { ...initialScene } });
});

function sceneWith(names: string[]): EditorScene {
  const scene = { ...initialScene };
  scene.layers = names.map((n, i) => ({
    ...initialScene.layers[0]!,
    id: `l${i}`,
    mediaName: n,
  }));
  useEditorStore.setState({ scene });
  return scene;
}

describe("useLayerReorder", () => {
  it("reorders via drag-over and coalesces into one history step", () => {
    const scene = sceneWith(["A", "B", "C"]);
    const { result } = renderHook(() => useLayerReorder(scene));
    act(() => result.current.handleDragStart({ dataTransfer: { setData: vi.fn(), effectAllowed: "" } } as unknown as React.DragEvent<HTMLLIElement>, "l0"));
    act(() => result.current.handleDragOver({ currentTarget: { getBoundingClientRect: () => ({ top: 0, bottom: 300, height: 300 } as DOMRect) }, clientY: 200, preventDefault: vi.fn(), dataTransfer: { dropEffect: "" } } as unknown as React.DragEvent<HTMLLIElement>, "l1"));
    expect(useEditorStore.getState().scene.layers.map((l) => l.mediaName)).toEqual(["B", "A", "C"]);
    // A single coalesced drag collapses to one undo step.
    act(() => useEditorStore.getState().undo());
    expect(useEditorStore.getState().scene.layers.map((l) => l.mediaName)).toEqual(["A", "B", "C"]);
  });

  it("ignores dragging a layer over itself", () => {
    sceneWith(["A", "B"]);
    const { result } = renderHook(() => useLayerReorder(useEditorStore.getState().scene));
    act(() => result.current.handleDragStart({ dataTransfer: { setData: vi.fn(), effectAllowed: "" } } as unknown as React.DragEvent<HTMLLIElement>, "l0"));
    act(() => result.current.handleDragOver({ currentTarget: { getBoundingClientRect: () => ({ top: 0, bottom: 10, height: 10 } as DOMRect) }, clientY: 0, preventDefault: vi.fn(), dataTransfer: { dropEffect: "" } } as unknown as React.DragEvent<HTMLLIElement>, "l0"));
    expect(useEditorStore.getState().scene.layers.map((l) => l.mediaName)).toEqual(["A", "B"]);
  });

  it("clears drag state on drag end", () => {
    sceneWith(["A", "B"]);
    const { result } = renderHook(() => useLayerReorder(useEditorStore.getState().scene));
    act(() => result.current.handleDragStart({ dataTransfer: { setData: vi.fn(), effectAllowed: "" } } as unknown as React.DragEvent<HTMLLIElement>, "l0"));
    act(() => result.current.handleDragEnd());
    expect(result.current.dragId).toBeNull();
    expect(result.current.dropTarget).toBeNull();
  });
});
