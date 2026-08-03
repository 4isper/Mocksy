// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VideoOptions } from "@/components/editor/VideoOptions";
import { useEditorStore, initialScene } from "@/lib/state/editorStore";

const mockLoadFile = vi.hoisted(() => ({
  isAudioFile: vi.fn(),
  blobToDataUrl: vi.fn()
}));
vi.mock("@/lib/media/loadFile", () => mockLoadFile);

function setVideoLayer() {
  useEditorStore.setState({
    scene: {
      ...useEditorStore.getState().scene,
      activeLayerId: "v1",
      layers: [{
        id: "v1",
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
        mediaName: "test.mp4",
      }],
    },
    activeLayerId: "v1"
  });
}

function setImageLayer() {
  useEditorStore.setState({
    scene: {
      ...useEditorStore.getState().scene,
      activeLayerId: "i1",
      layers: [{
        id: "i1",
        mediaUrl: "test.jpg",
        mediaType: "image",
        zoom: 1,
        mediaOffsetX: 0,
        mediaOffsetY: 0,
        animationPreset: "none",
        mediaFit: "cover",
        videoDuration: 0,
        videoTrimStart: 0,
        videoTrimEnd: 0,
        videoMuted: false,
        videoLoop: false,
        videoAutoplay: false,
        videoPosterTime: 0,
        videoQuality: "medium",
        hidden: false,
        mediaName: "test.jpg",
      }],
    },
    activeLayerId: "i1"
  });
}

beforeEach(() => {
  mockLoadFile.isAudioFile.mockReset().mockReturnValue(true);
  mockLoadFile.blobToDataUrl.mockReset().mockResolvedValue("data:audio/mp3;base64,abc");
  useEditorStore.setState({ videoCurrentTime: 0 });
});

afterEach(() => {
  cleanup();
  useEditorStore.setState({ scene: { ...initialScene }, videoCurrentTime: 0 });
});

describe("VideoOptions", () => {
  it("renders nothing for image layer", () => {
    setImageLayer();
    const { container } = render(<VideoOptions />);
    expect(container.innerHTML).toBe("");
  });

  it("renders accordion for video layer", () => {
    setVideoLayer();
    render(<VideoOptions />);
    expect(screen.getByText("video.options")).toBeInTheDocument();
  });

  it("toggles accordion open/closed", async () => {
    setVideoLayer();
    render(<VideoOptions />);
    expect(screen.getByText("video.muted")).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "video.options" });
    await userEvent.click(toggle);
    expect(screen.queryByText("video.muted")).not.toBeInTheDocument();
  });

  it("renders video toggles", () => {
    setVideoLayer();
    render(<VideoOptions />);
    expect(screen.getByRole("checkbox", { name: "video.muted" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "video.loop" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "video.autoplay" })).toBeInTheDocument();
  });

  it("renders quality selector", () => {
    setVideoLayer();
    render(<VideoOptions />);
    expect(screen.getByRole("combobox", { name: "video.exportQuality" })).toBeInTheDocument();
  });

  it("renders poster time slider", () => {
    setVideoLayer();
    render(<VideoOptions />);
    expect(screen.getByRole("slider", { name: "video.posterTime" })).toBeInTheDocument();
  });
});

describe("VideoOptions controls", () => {
  it("toggles muted", () => {
    setVideoLayer();
    render(<VideoOptions />);
    fireEvent.click(screen.getByRole("checkbox", { name: "video.muted" }));
    expect(useEditorStore.getState().scene.layers[0]?.videoMuted).toBe(true);
  });

  it("toggles loop", () => {
    setVideoLayer();
    render(<VideoOptions />);
    fireEvent.click(screen.getByRole("checkbox", { name: "video.loop" }));
    expect(useEditorStore.getState().scene.layers[0]?.videoLoop).toBe(true);
  });

  it("toggles autoplay", () => {
    setVideoLayer();
    render(<VideoOptions />);
    fireEvent.click(screen.getByRole("checkbox", { name: "video.autoplay" }));
    expect(useEditorStore.getState().scene.layers[0]?.videoAutoplay).toBe(true);
  });

  it("updates the poster time from the slider", () => {
    setVideoLayer();
    render(<VideoOptions />);
    fireEvent.change(screen.getByRole("slider", { name: "video.posterTime" }), { target: { value: "3.5" } });
    expect(useEditorStore.getState().scene.layers[0]?.videoPosterTime).toBe(3.5);
  });

  it("updates the playback position from the slider", () => {
    setVideoLayer();
    render(<VideoOptions />);
    fireEvent.change(screen.getByRole("slider", { name: "video.playbackPosition" }), { target: { value: "4.2" } });
    expect(useEditorStore.getState().videoCurrentTime).toBe(4.2);
  });

  it("updates the export quality", () => {
    setVideoLayer();
    render(<VideoOptions />);
    fireEvent.change(screen.getByRole("combobox", { name: "video.exportQuality" }), { target: { value: "high" } });
    expect(useEditorStore.getState().scene.layers[0]?.videoQuality).toBe("high");
  });
});

describe("VideoOptions background audio", () => {
  it("uploads an audio file as background audio", async () => {
    setVideoLayer();
    render(<VideoOptions />);
    const file = new File(["x"], "song.mp3", { type: "audio/mp3" });
    const input = document.querySelector('.upload-audio-btn input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByText("song.mp3");
    const scene = useEditorStore.getState().scene;
    expect(scene.backgroundAudioUrl).toBe("data:audio/mp3;base64,abc");
    expect(scene.backgroundAudioName).toBe("song.mp3");
  });

  it("ignores non-audio uploads", async () => {
    mockLoadFile.isAudioFile.mockReturnValue(false);
    setVideoLayer();
    render(<VideoOptions />);
    const file = new File(["x"], "song.mp3", { type: "audio/mp3" });
    const input = document.querySelector('.upload-audio-btn input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(useEditorStore.getState().scene.backgroundAudioUrl).toBeNull();
  });

  it("clears the background audio", async () => {
    setVideoLayer();
    useEditorStore.setState({
      scene: { ...useEditorStore.getState().scene, backgroundAudioUrl: "data:audio/mp3;base64,abc", backgroundAudioName: "song.mp3" },
    });
    render(<VideoOptions />);
    expect(screen.getByText("song.mp3")).toBeInTheDocument();
    fireEvent.click(screen.getByText("video.removeAudio"));
    const scene = useEditorStore.getState().scene;
    expect(scene.backgroundAudioUrl).toBeNull();
    expect(scene.backgroundAudioName).toBeNull();
    expect(screen.getByText("video.uploadAudio")).toBeInTheDocument();
  });
});
