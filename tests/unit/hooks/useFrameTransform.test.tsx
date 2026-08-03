// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useFrameTransform } from "@/lib/hooks/useFrameTransform";
import { initialScene } from "@/lib/state/editorStore";
import type { MediaLayer } from "@/lib/types/editor";

const baseLayer = initialScene.layers[0] as MediaLayer;

type FrameCallback = (time: number) => void;

let rafCallbacks: FrameCallback[];
let now = 0;

beforeEach(() => {
  rafCallbacks = [];
  now = 1000;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameCallback) => {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("performance", { now: () => now });
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useFrameTransform", () => {
  it("applies the static transform for a non-animated layer", () => {
    const node = { current: document.createElement("div") };
    const layer = { ...baseLayer, animationPreset: "none" as const, zoom: 2 };
    renderHook(() => useFrameTransform(node, layer, 3000));
    expect(node.current.style.transform).toBe("scale(2) translate(0px, 0px)");
    expect(rafCallbacks.length).toBe(0);
  });

  it("re-applies the static transform when zoom changes", () => {
    const node = { current: document.createElement("div") };
    const layer = { ...baseLayer, animationPreset: "none" as const, zoom: 1 };
    const { rerender } = renderHook(({ l }: { l: MediaLayer }) => useFrameTransform(node, l, 3000), {
      initialProps: { l: layer }
    });
    rerender({ l: { ...layer, zoom: 3 } });
    expect(node.current.style.transform).toBe("scale(3) translate(0px, 0px)");
  });

  it("runs the rAF loop and interpolates keyframes for zoomIn", () => {
    const node = { current: document.createElement("div") };
    const layer = { ...baseLayer, animationPreset: "zoomIn" as const, zoom: 1 };
    renderHook(() => useFrameTransform(node, layer, 3000));
    expect(rafCallbacks.length).toBe(1);
    rafCallbacks[0]!(performance.now());
    expect(node.current.style.transform).toBe("scale(1) translate(0px, 0px)");
    now = 2500;
    rafCallbacks[1]!(performance.now());
    expect(node.current.style.transform).toBe("scale(1.06) translate(0px, 0px)");
  });

  it("samples the parallax timeline at its start", () => {
    const node = { current: document.createElement("div") };
    const layer = { ...baseLayer, animationPreset: "parallax" as const, zoom: 1 };
    renderHook(() => useFrameTransform(node, layer, 3000));
    rafCallbacks[0]!(performance.now());
    expect(node.current.style.transform).toBe("scale(1.03) translate(-20px, -12px)");
  });

  it("skips the rAF loop and pins a static frame when the user prefers reduced motion", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const node = { current: document.createElement("div") };
    const layer = { ...baseLayer, animationPreset: "zoomIn" as const, zoom: 1 };
    renderHook(() => useFrameTransform(node, layer, 3000));
    expect(rafCallbacks.length).toBe(0);
    expect(node.current.style.transform).toBe("scale(1) translate(0px, 0px)");
  });

  it("cancels the rAF loop on unmount", () => {
    const cancel = vi.mocked(cancelAnimationFrame);
    const node = { current: document.createElement("div") };
    const layer = { ...baseLayer, animationPreset: "zoomIn" as const, zoom: 1 };
    const { unmount } = renderHook(() => useFrameTransform(node, layer, 3000));
    unmount();
    expect(cancel).toHaveBeenCalled();
  });
});
