// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ControlPanel } from "@/components/editor/ControlPanel";
import { useEditorStore } from "@/lib/state/editorStore";
import { initialScene } from "@/lib/state/editorStore";
import { buildFreshScene } from "@/lib/state/editorScene";

afterEach(() => {
  cleanup();
  useEditorStore.setState({ scene: { ...initialScene } });
});

// Mock loadMediaFromFile so file inputs don't actually run
vi.mock("@/lib/media/loadFile", () => ({
  loadMediaFromFile: vi.fn().mockResolvedValue({ url: "blob:mock", mediaType: "image", mediaName: "test.png" }),
  UnsupportedMediaError: class extends Error { name = "UnsupportedMediaError" },
}));

describe("ControlPanel", () => {
  // Secondary sections are collapsed by default; expand one before asserting
  // or interacting with its controls (mirrors the real user flow).
  async function openSection(name: string) {
    const btn = screen.getByRole("button", { name });
    if (btn.getAttribute("aria-expanded") === "false") {
      await userEvent.click(btn);
    }
  }

  it("renders panel title", () => {
    render(<ControlPanel />);
    expect(screen.getByText("editor.controls")).toBeInTheDocument();
  });

  it("collapses secondary sections (animation) by default and reveals them on toggle", async () => {
    render(<ControlPanel />);
    const header = screen.getByRole("button", { name: "editor.animation" });
    expect(header).toHaveAttribute("aria-expanded", "false");
    // "animation.none" now appears in both loop and entrance Segmented controls
    const noneButtons = screen.queryAllByText("animation.none");
    expect(noneButtons.length).toBeGreaterThanOrEqual(1);
    for (const el of noneButtons) {
      expect(el).not.toBeVisible();
    }
    await openSection("editor.animation");
    expect(header).toHaveAttribute("aria-expanded", "true");
    for (const el of screen.getAllByText("animation.none")) {
      expect(el).toBeVisible();
    }
  });

  it("renders upload media trigger", () => {
    render(<ControlPanel />);
    expect(screen.getByText("editor.uploadMediaShort")).toBeInTheDocument();
  });

  it("renders clear media button when media exists", () => {
    render(<ControlPanel />);
    expect(screen.getByText("editor.clearMedia")).toBeInTheDocument();
  });

  it("renders frame segmented buttons", () => {
    render(<ControlPanel />);
    expect(screen.getByText("frame.none")).toBeInTheDocument();
    expect(screen.getByText("frame.iphone")).toBeInTheDocument();
    expect(screen.getByText("frame.desktop")).toBeInTheDocument();
    expect(screen.getByText("frame.tablet")).toBeInTheDocument();
  });

  it("renders style presets", () => {
    render(<ControlPanel />);
    expect(screen.getByText("style.default")).toBeInTheDocument();
    expect(screen.getByText("style.glassLight")).toBeInTheDocument();
    expect(screen.getByText("style.glassDark")).toBeInTheDocument();
    expect(screen.getByText("style.outline")).toBeInTheDocument();
  });

  it("renders animation presets", async () => {
    render(<ControlPanel />);
    await openSection("editor.animation");
    // "animation.none" appears in both the looping and entrance animation Segmented controls
    expect(screen.getAllByText("animation.none").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("animation.zoomIn")).toBeInTheDocument();
    expect(screen.getByText("animation.zoomOut")).toBeInTheDocument();
    expect(screen.getByText("animation.parallax")).toBeInTheDocument();
  });

  it("renders aspect ratio options", () => {
    render(<ControlPanel />);
    const ratios = ["16 / 9", "4 / 3", "3 / 2", "1 / 1", "9 / 16"];
    for (const r of ratios) {
      expect(screen.getByText(r)).toBeInTheDocument();
    }
  });

  it("renders fill/fit segmented", () => {
    render(<ControlPanel />);
    expect(screen.getByText("editor.fill")).toBeInTheDocument();
    expect(screen.getByText("editor.fit")).toBeInTheDocument();
  });

  it("renders zoom slider", () => {
    render(<ControlPanel />);
    expect(screen.getByRole("slider", { name: "editor.zoom" })).toBeInTheDocument();
  });

  it("renders position X slider", () => {
    render(<ControlPanel />);
    expect(screen.getByRole("slider", { name: "editor.positionX" })).toBeInTheDocument();
  });

  it("renders position Y slider", () => {
    render(<ControlPanel />);
    expect(screen.getByRole("slider", { name: "editor.positionY" })).toBeInTheDocument();
  });

  it("renders shadow opacity slider", () => {
    render(<ControlPanel />);
    expect(screen.getByRole("slider", { name: "editor.shadowOpacity" })).toBeInTheDocument();
  });

  it("renders corner radius slider", () => {
    render(<ControlPanel />);
    expect(screen.getByRole("slider", { name: "editor.cornerRadius" })).toBeInTheDocument();
  });

  it("renders auto background button", () => {
    render(<ControlPanel />);
    expect(screen.getByText("editor.autoBackground")).toBeInTheDocument();
  });

  it("renders background preset swatches", () => {
    render(<ControlPanel />);
    const swatches = screen.getAllByRole("button").filter(b => b.getAttribute("aria-pressed") !== null);
    expect(swatches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders upload background image trigger", () => {
    render(<ControlPanel />);
    expect(screen.getByText("editor.uploadBgImage")).toBeInTheDocument();
  });

  it("renders watermark toggle", async () => {
    render(<ControlPanel />);
    await openSection("editor.watermark");
    expect(screen.getByRole("checkbox", { name: "editor.watermark" })).toBeInTheDocument();
  });

  it("renders watermark text input", async () => {
    render(<ControlPanel />);
    await openSection("editor.watermark");
    const inputs = screen.getAllByRole("textbox");
    const watermarkInput = inputs.find(i => (i as HTMLInputElement).value === "Mocksy");
    expect(watermarkInput).toBeTruthy();
  });

  it("renders watermark position selector", async () => {
    render(<ControlPanel />);
    await openSection("editor.watermark");
    expect(screen.getByText("editor.posBottomRight")).toBeInTheDocument();
    expect(screen.getByText("editor.posBottomLeft")).toBeInTheDocument();
    expect(screen.getByText("editor.posTopRight")).toBeInTheDocument();
    expect(screen.getByText("editor.posTopLeft")).toBeInTheDocument();
  });

  it("renders watermark size slider", async () => {
    render(<ControlPanel />);
    await openSection("editor.watermark");
    expect(screen.getByRole("slider", { name: "editor.watermarkSize" })).toBeInTheDocument();
  });

  it("switches frame on button click", async () => {
    render(<ControlPanel />);
    await userEvent.click(screen.getByText("frame.desktop"));
    expect(useEditorStore.getState().scene.frame).toBe("desktop");
  });

  it("switches style preset on button click", async () => {
    render(<ControlPanel />);
    await userEvent.click(screen.getByText("style.glassLight"));
    expect(useEditorStore.getState().scene.stylePreset).toBe("glassLight");
  });

  it("switches aspect ratio on button click", async () => {
    render(<ControlPanel />);
    await userEvent.click(screen.getByText("1 / 1"));
    expect(useEditorStore.getState().scene.aspectRatio).toBe("1 / 1");
  });

  it("switches animation preset on button click", async () => {
    render(<ControlPanel />);
    await openSection("editor.animation");
    await userEvent.click(screen.getByText("animation.zoomIn"));
    expect(useEditorStore.getState().scene.layers[0]!.animationPreset).toBe("zoomIn");
  });

  it("changes animation duration via slider", async () => {
    render(<ControlPanel />);
    await openSection("editor.animation");
    const slider = screen.getByRole("slider", { name: "editor.animationDuration" });
    fireEvent.change(slider, { target: { value: "5" } });
    expect(useEditorStore.getState().scene.animationDurationMs).toBe(5000);
  });

  it("disables the animation duration slider when no animation is set", async () => {
    render(<ControlPanel />);
    await openSection("editor.animation");
    const slider = screen.getByRole("slider", { name: "editor.animationDuration" });
    expect(slider).toBeDisabled();
  });

  it("switches fill/fit on button click", async () => {
    render(<ControlPanel />);
    await userEvent.click(screen.getByText("editor.fit"));
    expect(useEditorStore.getState().scene.layers[0]!.mediaFit).toBe("contain");
  });

  it("changes shadow opacity via slider", () => {
    render(<ControlPanel />);
    const slider = screen.getByRole("slider", { name: "editor.shadowOpacity" });
    fireEvent.change(slider, { target: { value: "0.6" } });
    expect(useEditorStore.getState().scene.shadowOpacity).toBe(0.6);
  });

  it("clears media on clear button click", async () => {
    render(<ControlPanel />);
    await userEvent.click(screen.getByText("editor.clearMedia"));
    const st = useEditorStore.getState();
    expect(st.scene.layers[0]!.mediaUrl).toBeNull();
    expect(st.scene.layers[0]!.mediaType).toBe("none");
  });

  it("toggles watermark checkbox", async () => {
    render(<ControlPanel />);
    await openSection("editor.watermark");
    const checkbox = screen.getByRole("checkbox", { name: "editor.watermark" });
    await userEvent.click(checkbox);
    expect(useEditorStore.getState().scene.watermarkEnabled).toBe(true);
  });

  it("changes zoom via slider", () => {
    render(<ControlPanel />);
    const slider = screen.getByRole("slider", { name: "editor.zoom" });
    fireEvent.change(slider, { target: { value: "1.2" } });
    expect(useEditorStore.getState().scene.layers[0]!.zoom).toBeCloseTo(1.2);
  });

  it("changes media position X via slider", () => {
    render(<ControlPanel />);
    const slider = screen.getByRole("slider", { name: "editor.positionX" });
    fireEvent.change(slider, { target: { value: "0.25" } });
    expect(useEditorStore.getState().scene.layers[0]!.mediaOffsetX).toBeCloseTo(0.25);
  });

  it("changes media position Y via slider", () => {
    render(<ControlPanel />);
    const slider = screen.getByRole("slider", { name: "editor.positionY" });
    fireEvent.change(slider, { target: { value: "-0.5" } });
    expect(useEditorStore.getState().scene.layers[0]!.mediaOffsetY).toBeCloseTo(-0.5);
  });

  it("changes corner radius via slider", () => {
    render(<ControlPanel />);
    const slider = screen.getByRole("slider", { name: "editor.cornerRadius" });
    fireEvent.change(slider, { target: { value: "32" } });
    expect(useEditorStore.getState().scene.borderRadius).toBe(32);
  });

  it("uploads media and applies it to the active layer", async () => {
    render(<ControlPanel />);
    const input = document.querySelector('input[accept="image/*,video/*"]') as HTMLInputElement;
    const file = new File(["x"], "photo.png", { type: "image/png" });
    await userEvent.upload(input, file);
    const st = useEditorStore.getState();
    expect(st.scene.layers[0]!.mediaUrl).toBe("blob:mock");
    expect(st.scene.layers[0]!.mediaType).toBe("image");
    expect(st.scene.layers[0]!.mediaName).toBe("test.png");
  });

  it("surfaces an error for an unsupported media upload", async () => {
    const { loadMediaFromFile, UnsupportedMediaError } = await import("@/lib/media/loadFile");
    vi.mocked(loadMediaFromFile).mockRejectedValueOnce(new UnsupportedMediaError("unsupported type"));
    render(<ControlPanel />);
    const input = document.querySelector('input[accept="image/*,video/*"]') as HTMLInputElement;
    const file = new File(["x"], "clip.mov", { type: "video/quicktime" });
    await userEvent.upload(input, file);
    expect(await screen.findByRole("alert")).toHaveTextContent("unsupported type");
  });

  it("shows a generic upload error for unexpected failures", async () => {
    const { loadMediaFromFile } = await import("@/lib/media/loadFile");
    vi.mocked(loadMediaFromFile).mockRejectedValueOnce(new Error("boom"));
    render(<ControlPanel />);
    const input = document.querySelector('input[accept="image/*,video/*"]') as HTMLInputElement;
    const file = new File(["x"], "photo.png", { type: "image/png" });
    await userEvent.upload(input, file);
    expect(await screen.findByRole("alert")).toHaveTextContent("editor.uploadError");
  });

  it("renders video options for a video layer", () => {
    const layer = initialScene.layers[0]!;
    useEditorStore.setState({
      scene: {
        ...initialScene,
        layers: [{ ...layer, mediaType: "video", mediaUrl: "data:video/mp4;base64,AAAA" }],
        activeLayerId: layer.id
      }
    });
    render(<ControlPanel />);
    expect(screen.getByText("video.options")).toBeInTheDocument();
  });

  it("filters sections by title and force-opens matches", async () => {
    render(<ControlPanel />);
    const input = screen.getByRole("textbox", { name: "editor.searchControlsLabel" });
    await userEvent.type(input, "watermark");
    // Only the watermark section header remains visible.
    expect(screen.getByRole("button", { name: "editor.watermark" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "editor.background" })).not.toBeInTheDocument();
    // A closed-by-default section is force-opened while filtering.
    expect(screen.getByRole("checkbox", { name: "editor.watermark" })).toBeVisible();
  });

  it("restores all sections and their collapsed state when the filter clears", async () => {
    render(<ControlPanel />);
    const input = screen.getByRole("textbox", { name: "editor.searchControlsLabel" });
    await userEvent.type(input, "watermark");
    await userEvent.clear(input);
    for (const name of ["editor.media", "editor.frame", "editor.arrange", "editor.animation", "editor.position", "editor.filters", "editor.background", "editor.watermark", "editor.screen"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("shows a no-results status when nothing matches", async () => {
    render(<ControlPanel />);
    const input = screen.getByRole("textbox", { name: "editor.searchControlsLabel" });
    await userEvent.type(input, "zzzzz");
    expect(screen.getByText("editor.noControlsMatch")).toBeInTheDocument();
  });

  it("renders position scope labels separating layer and scene controls", () => {
    render(<ControlPanel />);
    expect(screen.getByText("editor.positionLayerScope")).toBeInTheDocument();
    expect(screen.getByText("editor.positionSceneScope")).toBeInTheDocument();
    const sceneLabel = screen.getByText("editor.positionSceneScope").closest(".scope-label");
    expect(sceneLabel).toHaveClass("scope-label");
  });

  it("shows layout and add-frame tools but hides align when there are no frames", () => {
    useEditorStore.setState({ scene: { ...initialScene, frameInstances: [] } });
    render(<ControlPanel />);
    // Empty canvas (legacy single / reset) still offers a way back to a movable
    // device: layout presets create instances from zero and the frames list
    // carries the Add button. Align needs 2+ frames so it stays hidden.
    expect(screen.getByRole("button", { name: "editor.layoutFan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "editor.addFrame" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "editor.alignLeft" })).not.toBeInTheDocument();
  });

  it("shows layout presets but no align tools with a single frame", () => {
    useEditorStore.setState({ scene: buildFreshScene("iphone", 1) });
    render(<ControlPanel />);
    expect(screen.getByRole("button", { name: "editor.layoutFan" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "editor.alignLeft" })).not.toBeInTheDocument();
  });

  it("shows align tools but no distribute with two frames", () => {
    useEditorStore.setState({ scene: buildFreshScene("iphone", 2) });
    render(<ControlPanel />);
    expect(screen.getByRole("button", { name: "editor.alignLeft" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "editor.distributeHorizontal" })).not.toBeInTheDocument();
  });

  it("shows distribute tools with three frames", () => {
    useEditorStore.setState({ scene: buildFreshScene("iphone", 3) });
    render(<ControlPanel />);
    expect(screen.getByRole("button", { name: "editor.distributeHorizontal" })).toBeInTheDocument();
  });
});
