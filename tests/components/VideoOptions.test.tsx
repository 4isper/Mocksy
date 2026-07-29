// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VideoOptions } from "@/components/editor/VideoOptions";
import { useEditorStore } from "@/lib/state/editorStore";

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
    }
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
    }
  });
}

afterEach(() => {
  cleanup();
  useEditorStore.setState({ scene: useEditorStore.getState().scene });
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
