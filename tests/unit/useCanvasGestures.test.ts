// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCanvasGestures } from "@/lib/hooks/useCanvasGestures";
import { useEditorStore } from "@/lib/state/editorStore";
import { initialScene, makeDemoScene } from "@/lib/state/editorScene";

function activeLayerWith(mediaUrl: string | null, zoom = 1, offX = 0, offY = 0) {
  const scene = makeDemoScene();
  scene.layers[0] = { ...scene.layers[0]!, mediaUrl, mediaType: mediaUrl ? "image" : "none", zoom, mediaOffsetX: offX, mediaOffsetY: offY };
  useEditorStore.setState({ scene, activeLayerId: scene.layers[0]!.id });
  return scene.layers[0]!;
}

describe("useCanvasGestures", () => {
  it("ignores pan start when there is no media on the active layer", () => {
    const layer = activeLayerWith(null);
    const frameRef = { current: { offsetWidth: 100, offsetHeight: 100 } } as React.RefObject<HTMLDivElement | null>;
    const { result } = renderHook(() => useCanvasGestures({ frameRef, activeLayer: layer }));
    expect(result.current.canPan).toBe(false);
    result.current.onPanDown({
      target: { closest: () => null },
      currentTarget: { setPointerCapture: vi.fn() },
      pointerId: 1,
      clientX: 100,
      clientY: 100
    } as unknown as React.PointerEvent<HTMLDivElement>);
    result.current.onPanMove({
      currentTarget: { offsetWidth: 100, offsetHeight: 100 },
    } as unknown as React.PointerEvent<HTMLDivElement>);
    expect(useEditorStore.getState().scene.layers[0]?.mediaOffsetX).toBe(0);
  });

  it("pans the media and clamps the offset to [-1, 1]", () => {
    const layer = activeLayerWith("data:img", 1, 0, 0);
    const frameRef = { current: { offsetWidth: 100, offsetHeight: 100 } } as React.RefObject<HTMLDivElement | null>;
    const { result } = renderHook(() => useCanvasGestures({ frameRef, activeLayer: layer }));
    expect(result.current.canPan).toBe(true);
    result.current.onPanDown({
      target: { closest: () => null },
      currentTarget: { setPointerCapture: vi.fn() },
      pointerId: 1,
      clientX: 100,
      clientY: 100
    } as unknown as React.PointerEvent<HTMLDivElement>);
    result.current.onPanMove({
      target: { closest: () => null },
      currentTarget: { offsetWidth: 100, offsetHeight: 100 },
      clientY: 100,
      clientX: 110
    } as unknown as React.PointerEvent<HTMLDivElement>);
    expect(useEditorStore.getState().scene.layers[0]?.mediaOffsetX).toBeCloseTo(0.2);
  });

  it("pinch-zooms and clamps zoom to [0.8, 1.5]", () => {
    const layer = activeLayerWith("data:img", 1);
    const frameRef = { current: null } as React.RefObject<HTMLDivElement | null>;
    const { result } = renderHook(() => useCanvasGestures({ frameRef, activeLayer: layer }));
    result.current.onTouchStart({ touches: [{ clientX: 0, clientY: 0 }, { clientX: 100, clientY: 0 }] } as unknown as React.TouchEvent<HTMLDivElement>);
    result.current.onTouchMove({ touches: [{ clientX: 0, clientY: 0 }, { clientX: 200, clientY: 0 }], preventDefault: vi.fn() } as unknown as React.TouchEvent<HTMLDivElement>);
    expect(useEditorStore.getState().scene.layers[0]?.zoom).toBe(1.5);
  });
});
