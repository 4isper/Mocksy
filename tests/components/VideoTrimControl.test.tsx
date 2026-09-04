// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VideoTrimControl } from "@/components/editor/VideoTrimControl";
import { useEditorStore } from "@/lib/state/editorStore";

function setSceneWithLayer() {
  useEditorStore.setState({
    activeLayerId: "test-layer",
    scene: {
      ...useEditorStore.getState().scene,
      activeLayerId: "test-layer",
      layers: [{
        id: "test-layer",
        mediaUrl: "test.mp4",
        mediaType: "video",
        zoom: 1,
        mediaOffsetX: 0,
        mediaOffsetY: 0,
        animationPreset: "none",
        mediaFit: "cover",
        videoDuration: 10,
        videoTrimStart: 0,
        videoTrimEnd: 10,
        videoMuted: false,
        videoLoop: false,
        videoAutoplay: false,
        videoPosterTime: 0,
        videoQuality: "medium",
        hidden: false,
        mediaName: "test",
      }],
    }
  });
}

afterEach(() => {
  cleanup();
  useEditorStore.setState({ scene: useEditorStore.getState().scene });
});

describe("VideoTrimControl", () => {
  it("renders trim sliders", () => {
    setSceneWithLayer();
    render(<VideoTrimControl duration={10} />);
    expect(screen.getByRole("slider", { name: "videoTrim.trimStart" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "videoTrim.trimEnd" })).toBeInTheDocument();
  });

  it("shows time range", () => {
    setSceneWithLayer();
    render(<VideoTrimControl duration={10} />);
    expect(screen.getByText(/0.0s – 10.0s/)).toBeInTheDocument();
  });

  it("treats the untrimmed sentinel (trimEnd 0) as the full duration", () => {
    setSceneWithLayer();
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [{ ...useEditorStore.getState().scene.layers[0]!, videoTrimEnd: 0 }]
      }
    });
    render(<VideoTrimControl duration={10} />);
    expect(screen.getByText(/0.0s – 10.0s/)).toBeInTheDocument();
    const endSlider = screen.getByRole("slider", { name: "videoTrim.trimEnd" });
    expect(Number(endSlider.getAttribute("aria-valuenow"))).toBe(10);
  });

  it("moves the thumb nearest the press when both sit at the same spot", () => {
    setSceneWithLayer();
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [{ ...useEditorStore.getState().scene.layers[0]!, videoTrimStart: 5, videoTrimEnd: 5 }]
      }
    });
    render(<VideoTrimControl duration={10} />);
    const track = document.querySelector(".trim-track") as HTMLElement;
    vi.spyOn(track, "getBoundingClientRect").mockReturnValue({ left: 0, width: 200, top: 0, right: 200, bottom: 28, x: 0, y: 0, height: 28, toJSON: () => ({}) } as DOMRect);
    vi.spyOn(track, "setPointerCapture").mockImplementation(() => {});
    vi.spyOn(track, "releasePointerCapture").mockImplementation(() => {});
    vi.spyOn(track, "hasPointerCapture").mockReturnValue(true);
    // Press left of the shared thumb (value 2.5): the start handle takes it.
    fireEvent.pointerDown(track, { clientX: 50 });
    expect(useEditorStore.getState().scene.layers[0]?.videoTrimStart).toBeCloseTo(2.5);
    expect(useEditorStore.getState().scene.layers[0]?.videoTrimEnd).toBe(5);
    fireEvent.pointerUp(track, { clientX: 50 });
  });

  it("drags the active thumb with pointer capture", () => {
    setSceneWithLayer();
    render(<VideoTrimControl duration={10} />);
    const track = document.querySelector(".trim-track") as HTMLElement;
    vi.spyOn(track, "getBoundingClientRect").mockReturnValue({ left: 0, width: 200, top: 0, right: 200, bottom: 28, x: 0, y: 0, height: 28, toJSON: () => ({}) } as DOMRect);
    vi.spyOn(track, "setPointerCapture").mockImplementation(() => {});
    vi.spyOn(track, "releasePointerCapture").mockImplementation(() => {});
    vi.spyOn(track, "hasPointerCapture").mockReturnValue(true);
    fireEvent.pointerDown(track, { clientX: 10 });
    fireEvent.pointerMove(track, { clientX: 60 });
    fireEvent.pointerUp(track, { clientX: 60 });
    expect(useEditorStore.getState().scene.layers[0]?.videoTrimStart).toBeCloseTo(3);
  });

  it("supports keyboard adjustment on the thumbs", () => {
    setSceneWithLayer();
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: [{ ...useEditorStore.getState().scene.layers[0]!, videoTrimStart: 2, videoTrimEnd: 8 }]
      }
    });
    render(<VideoTrimControl duration={10} />);
    const start = screen.getByRole("slider", { name: "videoTrim.trimStart" });
    fireEvent.keyDown(start, { key: "ArrowRight" });
    expect(useEditorStore.getState().scene.layers[0]?.videoTrimStart).toBeCloseTo(2.1);
    fireEvent.keyDown(start, { key: "ArrowLeft", shiftKey: true });
    expect(useEditorStore.getState().scene.layers[0]?.videoTrimStart).toBeCloseTo(1.1);
    fireEvent.keyDown(start, { key: "End" });
    // The store clamps start to the end thumb (8s).
    expect(useEditorStore.getState().scene.layers[0]?.videoTrimStart).toBe(8);
  });
});
