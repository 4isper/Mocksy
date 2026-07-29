// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { VideoTrimControl } from "@/components/editor/VideoTrimControl";
import { useEditorStore } from "@/lib/state/editorStore";

function setSceneWithLayer() {
  useEditorStore.setState({
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
});
