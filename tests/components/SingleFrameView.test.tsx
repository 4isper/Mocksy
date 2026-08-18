// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";
import { SingleFrameView } from "@/components/editor/SingleFrameView";
import { buildSceneCss } from "@/lib/render/mockupRenderer";
import { initialScene, useEditorStore } from "@/lib/state/editorStore";

function makeLayer(overrides: Partial<MediaLayer> = {}): MediaLayer {
  return {
    id: "l1",
    mediaUrl: "test.jpg",
    mediaType: "image",
    mediaName: "test.jpg",
    zoom: 1,
    mediaOffsetX: 0,
    mediaOffsetY: 0,
    animationPreset: "none",
    mediaFit: "cover",
    hidden: false,
    videoDuration: 0,
    videoTrimStart: 0,
    videoTrimEnd: 0,
    videoMuted: false,
    videoLoop: false,
    videoAutoplay: false,
    videoPosterTime: 0,
    videoQuality: "medium",
    ...overrides,
  };
}

const sceneCss = buildSceneCss({ ...initialScene, layers: [makeLayer()] });

function withOverlay() {
  return { ...sceneCss, frameOverlay: "data:image/svg+xml;base64,AAAA" };
}

const props = {
  sceneCss,
  canPan: true,
  frameRef: { current: null } as React.RefObject<HTMLDivElement | null>,
  videoRef: { current: null } as React.MutableRefObject<HTMLVideoElement | null>,
  onPanDown: vi.fn(),
  onPanMove: vi.fn(),
  onPanUp: vi.fn(),
  analyzeMedia: vi.fn(),
  handleCanvasFile: vi.fn(async () => {}),
  canvasFileInputKey: 0,
  isMediaLoading: false,
  setVideoDuration: vi.fn(),
  setVideoCurrentTime: vi.fn(),
  setMediaLoading: vi.fn(),
  videoCurrentTime: 0,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useEditorStore.setState({ videoCurrentTime: 0 });
});

describe("SingleFrameView", () => {
  it("renders an image layer", () => {
    const { container } = render(<SingleFrameView {...props} scene={{ ...initialScene, layers: [makeLayer()] }} />);
    const img = container.querySelector("img[src*='test.jpg']") as HTMLImageElement;
    expect(img).not.toBeNull();
  });

  it("skips hidden layers", () => {
    const { container } = render(<SingleFrameView {...props} scene={{ ...initialScene, layers: [makeLayer({ hidden: true })] }} />);
    expect(container.querySelector("img[src*='test.jpg']")).toBeNull();
  });

  it("shows the drop hint when there is no media", () => {
    render(<SingleFrameView {...props} scene={{ ...initialScene, layers: [makeLayer({ mediaUrl: null, mediaType: "none" })] }} />);
    expect(screen.getByText("editor.dropToStart")).toBeInTheDocument();
  });

  it("forwards the file input to the handler", () => {
    render(<SingleFrameView {...props} scene={{ ...initialScene, layers: [makeLayer({ mediaUrl: null, mediaType: "none" })] }} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    expect(props.handleCanvasFile).toHaveBeenCalled();
  });

  it("renders a loading indicator", () => {
    render(<SingleFrameView {...props} isMediaLoading scene={{ ...initialScene, layers: [makeLayer()] }} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders the frame overlay image", () => {
    const { container } = render(<SingleFrameView {...props} sceneCss={withOverlay()} scene={{ ...initialScene, layers: [] }} />);
    expect(container.querySelector("img[src='data:image/svg+xml;base64,AAAA']")).not.toBeNull();
  });

  it("invokes pan handlers on pointer events", () => {
    const { container } = render(<SingleFrameView {...props} scene={{ ...initialScene, layers: [makeLayer()] }} />);
    const frame = container.querySelector('[data-mockup-frame]')!;
    fireEvent.pointerDown(frame);
    fireEvent.pointerMove(frame);
    fireEvent.pointerUp(frame);
    fireEvent.pointerCancel(frame);
    expect(props.onPanDown).toHaveBeenCalledTimes(1);
    expect(props.onPanMove).toHaveBeenCalledTimes(1);
    expect(props.onPanUp).toHaveBeenCalledTimes(2);
  });
});

describe("SingleFrameView video handlers", () => {
  function renderVideo(videoCurrentTime = 0) {
    useEditorStore.setState({ videoCurrentTime });
    const scene: EditorScene = {
      ...initialScene,
      layers: [makeLayer({ id: "v1", mediaUrl: "test.mp4", mediaType: "video" })],
    };
    return render(
      <SingleFrameView
        {...props}
        scene={scene}
      />
    );
  }

  it("reads duration on loaded metadata and clamps the poster time", () => {
    const { container } = renderVideo();
    const video = container.querySelector("video") as HTMLVideoElement;
    Object.defineProperty(video, "duration", { value: 30, configurable: true });
    fireEvent.loadedMetadata(video);
    expect(props.setVideoDuration).toHaveBeenCalledWith(30, "v1");
    expect(video.currentTime).toBe(0);
    expect(props.setVideoCurrentTime).toHaveBeenCalledWith(0);
  });

  it("clamps an out-of-range poster time to the duration", () => {
    const scene: EditorScene = {
      ...initialScene,
      layers: [makeLayer({ id: "v1", mediaUrl: "test.mp4", mediaType: "video", videoPosterTime: 45 })],
    };
    const { container } = render(<SingleFrameView {...props} scene={scene} />);
    const video = container.querySelector("video") as HTMLVideoElement;
    Object.defineProperty(video, "duration", { value: 30, configurable: true });
    fireEvent.loadedMetadata(video);
    expect(props.setVideoCurrentTime).toHaveBeenCalledWith(30);
    expect(video.currentTime).toBe(30);
  });

  it("updates the current time on time update when it differs", () => {
    const { container } = renderVideo();
    const video = container.querySelector("video") as HTMLVideoElement;
    Object.defineProperty(video, "currentTime", { value: 5, configurable: true });
    fireEvent.timeUpdate(video);
    expect(props.setVideoCurrentTime).toHaveBeenCalledWith(5);
  });

  it("skips redundant time updates within the 0.1s threshold", () => {
    const { container } = renderVideo(5.03);
    const video = container.querySelector("video") as HTMLVideoElement;
    Object.defineProperty(video, "currentTime", { value: 5, configurable: true });
    fireEvent.timeUpdate(video);
    expect(props.setVideoCurrentTime).not.toHaveBeenCalled();
  });

  it("analyzes media when the video data has loaded", () => {
    const { container } = renderVideo();
    const video = container.querySelector("video") as HTMLVideoElement;
    fireEvent.loadedData(video);
    expect(props.setMediaLoading).toHaveBeenCalledWith(false);
    expect(props.analyzeMedia).toHaveBeenCalledWith(video);
  });

  it("analyzes media when an image has loaded", () => {
    const { container } = render(<SingleFrameView {...props} scene={{ ...initialScene, layers: [makeLayer()] }} />);
    const img = container.querySelector("img[src*='test.jpg']") as HTMLImageElement;
    fireEvent.load(img);
    expect(props.setMediaLoading).toHaveBeenCalledWith(false);
    expect(props.analyzeMedia).toHaveBeenCalledWith(img);
  });
});
