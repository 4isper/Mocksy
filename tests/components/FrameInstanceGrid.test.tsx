// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { FrameInstanceGrid } from "@/components/editor/FrameInstanceGrid";
import { useEditorStore, initialScene } from "@/lib/state/editorStore";
import { buildSceneCss } from "@/lib/render/mockupRenderer";
import type { EditorScene } from "@/lib/types/editor";

afterEach(() => {
  cleanup();
  useEditorStore.setState({
    scene: { ...initialScene },
    activeFrameInstanceId: null,
  });
});

function makeSceneWithInstances(overrides?: Partial<EditorScene>): EditorScene {
  return {
    ...initialScene,
    frameInstances: [
      { id: "fi1", frame: "iphone" as const, x: 0.5, y: 0.5, scale: 0.3, layerId: null }
    ],
    ...overrides,
    layers: overrides?.layers ?? initialScene.layers,
  };
}

function renderGrid(scene: EditorScene, snapDivisions: number | null = null) {
  // Sync the global store so updateFrameInstance (which edits the store)
  // sees the same frameInstances as the rendered prop.
  useEditorStore.setState({ scene: { ...useEditorStore.getState().scene, frameInstances: scene.frameInstances } });

  const activeLayer = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
  const frameInstanceCssMap = new Map<string, ReturnType<typeof buildSceneCss>>();
  for (const inst of scene.frameInstances) {
    const layer = scene.layers.find((l) => l.id === inst.layerId) ?? activeLayer;
    frameInstanceCssMap.set(inst.id, buildSceneCss({ ...scene, frame: inst.frame, layers: layer ? [layer] : [] }));
  }

  const canvasRef = {
    current: {
      getBoundingClientRect: vi.fn(() => ({
        width: 1000,
        height: 600,
        top: 0,
        left: 0,
        right: 1000,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => ""
      }))
    }
  } as unknown as React.RefObject<HTMLDivElement | null>;

  return render(
    <FrameInstanceGrid
      scene={scene}
      activeLayer={activeLayer}
      frameInstanceCssMap={frameInstanceCssMap}
      activeFrameInstanceId="fi1"
      selectFrameInstance={vi.fn()}
      analyzeMedia={vi.fn()}
      setVideoDuration={vi.fn()}
      canvasRef={canvasRef}
      snapDivisions={snapDivisions}
    />
  );
}

describe("FrameInstanceGrid drag & drop", () => {
  it("moves a frame instance on drag", () => {
    const scene = makeSceneWithInstances();
    renderGrid(scene);

    const frame = document.querySelector(".frame-instance");
    expect(frame).toBeInTheDocument();

    fireEvent.pointerDown(frame!, { clientX: 500, clientY: 300, button: 0 });
    fireEvent.pointerMove(frame!, { clientX: 700, clientY: 300 });
    fireEvent.pointerUp(frame!);

    const inst = useEditorStore.getState().scene.frameInstances[0];
    expect(inst!.x).toBeGreaterThan(0.5);
    expect(inst!.y).toBe(0.5);
  });

  it("snaps dragged position to grid when snapDivisions is set", () => {
    const scene = makeSceneWithInstances();
    renderGrid(scene, 10); // 10 divisions = 0.1 step

    const frame = document.querySelector(".frame-instance");
    expect(frame).toBeInTheDocument();

    fireEvent.pointerDown(frame!, { clientX: 500, clientY: 300, button: 0 });
    // Move to ~0.57 which should snap to 0.6 (nearest 0.1)
    fireEvent.pointerMove(frame!, { clientX: 570, clientY: 300 });
    fireEvent.pointerUp(frame!);

    const inst = useEditorStore.getState().scene.frameInstances[0];
    // 0.5 + 0.07 = 0.57, snapped to 0.6 (1/10 step)
    expect(inst!.x).toBeCloseTo(0.6, 10);
  });

  it("does not snap to grid when Shift is held", () => {
    const scene = makeSceneWithInstances();
    renderGrid(scene, 10);

    const frame = document.querySelector(".frame-instance");
    expect(frame).toBeInTheDocument();

    fireEvent.pointerDown(frame!, { clientX: 500, clientY: 300, button: 0 });
    // Same move but with Shift held — should stay at 0.57
    fireEvent.pointerMove(frame!, { clientX: 570, clientY: 300, shiftKey: true });
    fireEvent.pointerUp(frame!);

    const inst = useEditorStore.getState().scene.frameInstances[0];
    // Should not be snapped to 0.6
    expect(inst!.x).not.toBeCloseTo(0.6, 10);
    expect(inst!.x).toBeCloseTo(0.57, 2);
  });

  it("clips position to [0, 1] during drag", () => {
    const scene = makeSceneWithInstances();
    renderGrid(scene);

    const frame = document.querySelector(".frame-instance");

    fireEvent.pointerDown(frame!, { clientX: 500, clientY: 300, button: 0 });
    // Move way past the right edge
    fireEvent.pointerMove(frame!, { clientX: 2000, clientY: 300 });
    fireEvent.pointerUp(frame!);

    const inst = useEditorStore.getState().scene.frameInstances[0];
    expect(inst!.x).toBe(1);
    expect(inst!.y).toBe(0.5);
  });

  it("does not start drag on right-click", () => {
    const scene = makeSceneWithInstances();
    renderGrid(scene);

    const frame = document.querySelector(".frame-instance");

    fireEvent.pointerDown(frame!, { clientX: 500, clientY: 300, button: 2 });
    fireEvent.pointerMove(frame!, { clientX: 700, clientY: 300 });
    fireEvent.pointerUp(frame!);

    const inst = useEditorStore.getState().scene.frameInstances[0];
    expect(inst!.x).toBe(0.5); // unchanged
  });
});
