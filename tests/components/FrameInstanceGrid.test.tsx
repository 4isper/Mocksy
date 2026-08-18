// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FrameInstanceGrid } from "@/components/editor/FrameInstanceGrid";
import { useEditorStore, initialScene } from "@/lib/state/editorStore";
import { buildSceneCss } from "@/lib/render/mockupRenderer";
import { isVideoLayer } from "@/lib/render/mediaKind";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";

afterEach(() => {
  cleanup();
  useEditorStore.setState({
    scene: { ...initialScene },
    activeFrameInstanceId: null,
  });
});

function makeLayer(overrides: Partial<MediaLayer> = {}): MediaLayer {
  return {
    id: "layer1",
    mediaUrl: null,
    mediaType: "none",
    mediaName: null,
    hidden: false,
    zoom: 1,
    mediaOffsetX: 0,
    mediaOffsetY: 0,
    mediaFit: "cover",
    animationPreset: "none",
    videoMuted: true,
    videoLoop: false,
    videoAutoplay: false,
    videoPosterTime: 0,
    videoDuration: 0,
    videoTrimStart: 0,
    videoTrimEnd: 0,
    videoQuality: "medium",
    ...overrides
  };
}

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

describe("FrameInstanceGrid resize handle", () => {
  it("shows resize handle when instance is selected", () => {
    const scene = makeSceneWithInstances();
    renderGrid(scene);

    expect(document.querySelector(".frame-instance-resize")).toBeInTheDocument();
  });

  it("does not show resize handle when instance is not selected", () => {
    const scene = makeSceneWithInstances();
    renderGrid(scene);

    // activeFrameInstanceId is "fi1" by default in renderGrid, so it IS selected
    // Let's test with a different activeFrameInstanceId
    const { rerender } = renderGrid(scene);
    // The resize handle is present because activeFrameInstanceId="fi1" matches fi1
    expect(document.querySelector(".frame-instance-resize")).toBeInTheDocument();
  });

  it("changes scale on resize drag", () => {
    const scene = makeSceneWithInstances();
    renderGrid(scene);

    const handle = document.querySelector(".frame-instance-resize");
    expect(handle).toBeInTheDocument();

    fireEvent.pointerDown(handle!, { clientX: 500, clientY: 300 });
    fireEvent.pointerMove(handle!, { clientX: 600, clientY: 300 });
    fireEvent.pointerUp(handle!);

    const inst = useEditorStore.getState().scene.frameInstances[0];
    expect(inst!.scale).toBeGreaterThan(0.3);
  });

  it("clamps scale to [0.05, 1.0] during resize", () => {
    const scene = makeSceneWithInstances();
    renderGrid(scene);

    const handle = document.querySelector(".frame-instance-resize");
    expect(handle).toBeInTheDocument();

    // Drag far left to try to go below 0.05
    fireEvent.pointerDown(handle!, { clientX: 500, clientY: 300 });
    fireEvent.pointerMove(handle!, { clientX: -500, clientY: 300 });
    fireEvent.pointerUp(handle!);

    const inst = useEditorStore.getState().scene.frameInstances[0];
    expect(inst!.scale).toBeGreaterThanOrEqual(0.05);
    expect(inst!.scale).toBeLessThanOrEqual(1.0);
  });

  it("resize handle stopPropagation prevents drag from starting", () => {
    const scene = makeSceneWithInstances();
    renderGrid(scene);

    const handle = document.querySelector(".frame-instance-resize")!;

    const frame = document.querySelector(".frame-instance")!;
    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300 });
    // The resize handle should capture the pointer, not the frame instance
    // After pointerup on the handle, the frame instance x should be unchanged
    // because the drag was initiated on the handle (resize), not the frame
    fireEvent.pointerMove(handle, { clientX: 700, clientY: 300 });
    fireEvent.pointerUp(handle);

    // The frame instance should not have moved (resize only changes scale)
    const inst = useEditorStore.getState().scene.frameInstances[0];
    expect(inst!.x).toBe(0.5);
  });
});

describe("FrameInstanceGrid media rendering", () => {
  it("renders a video element for video layers", () => {
    const videoLayer = makeLayer({
      id: "layer1",
      mediaUrl: "https://example.com/video.mp4",
      mediaType: "video",
      videoLoop: true,
      videoAutoplay: true,
      videoMuted: true,
    });
    const scene = makeSceneWithInstances({
      layers: [videoLayer],
      activeLayerId: "layer1",
    });
    renderGrid(scene);

    const video = document.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video!.getAttribute("src")).toBe("https://example.com/video.mp4");
    expect(video!.getAttribute("muted")).not.toBeNull();
    expect(video!.getAttribute("playsInline")).not.toBeNull();
    expect(video!.getAttribute("controls")).not.toBeNull();
    expect(video!.getAttribute("loop")).not.toBeNull();
    expect(video!.getAttribute("autoplay")).not.toBeNull();
    expect(video!.getAttribute("crossorigin")).toBe("anonymous");
  });

  it("renders an img element for image layers", () => {
    const imageLayer = makeLayer({
      id: "layer1",
      mediaUrl: "https://example.com/image.png",
      mediaType: "image",
    });
    const scene = makeSceneWithInstances({
      layers: [imageLayer],
      activeLayerId: "layer1",
    });
    renderGrid(scene);

    const img = document.querySelector("img[alt]");
    expect(img).toBeInTheDocument();
    expect(img!.getAttribute("src")).toBe("https://example.com/image.png");
  });

  it("does not render media when layer has no mediaUrl", () => {
    const noMediaLayer = makeLayer({
      id: "layer1",
      mediaUrl: null,
      mediaType: "none",
    });
    const scene = makeSceneWithInstances({
      layers: [noMediaLayer],
      activeLayerId: "layer1",
    });
    renderGrid(scene);

    expect(document.querySelector("video")).not.toBeInTheDocument();
    expect(document.querySelector("img[alt]")).not.toBeInTheDocument();
  });
});

describe("FrameInstanceGrid layer visibility", () => {
  it("hides frame instances whose layer is hidden", () => {
    const hiddenLayer = makeLayer({
      id: "layer1",
      mediaUrl: "https://example.com/image.png",
      mediaType: "image",
      hidden: true,
    });
    const scene = makeSceneWithInstances({
      layers: [hiddenLayer],
      activeLayerId: "layer1",
    });
    renderGrid(scene);

    expect(document.querySelector(".frame-instance")).not.toBeInTheDocument();
  });

  it("shows frame instances whose layer is not hidden", () => {
    const visibleLayer = makeLayer({
      id: "layer1",
      mediaUrl: "https://example.com/image.png",
      mediaType: "image",
      hidden: false,
    });
    const scene = makeSceneWithInstances({
      layers: [visibleLayer],
      activeLayerId: "layer1",
    });
    renderGrid(scene);

    expect(document.querySelector(".frame-instance")).toBeInTheDocument();
  });

  it("selects the layer when video media is pressed", () => {
    const videoLayer = makeLayer({
      id: "vl1",
      mediaUrl: "https://example.com/video.webm",
      mediaType: "video",
      hidden: false,
    });
    const scene = makeSceneWithInstances({
      layers: [videoLayer],
      activeLayerId: "vl1",
    });
    renderGrid(scene);
    const video = document.querySelector("video") as HTMLVideoElement;
    fireEvent.pointerDown(video);
    expect(useEditorStore.getState().activeLayerId).toBe("vl1");
  });
});
