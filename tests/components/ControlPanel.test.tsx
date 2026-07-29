// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ControlPanel } from "@/components/editor/ControlPanel";
import { useEditorStore } from "@/lib/state/editorStore";
import { initialScene } from "@/lib/state/editorStore";

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
  it("renders panel title", () => {
    render(<ControlPanel />);
    expect(screen.getByText("editor.controls")).toBeInTheDocument();
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

  it("renders animation presets", () => {
    render(<ControlPanel />);
    expect(screen.getByText("animation.none")).toBeInTheDocument();
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

  it("renders watermark toggle", () => {
    render(<ControlPanel />);
    expect(screen.getByText("editor.watermark")).toBeInTheDocument();
  });

  it("renders watermark text input", () => {
    render(<ControlPanel />);
    const inputs = screen.getAllByRole("textbox");
    const watermarkInput = inputs.find(i => (i as HTMLInputElement).value === "Mocksy");
    expect(watermarkInput).toBeTruthy();
  });

  it("renders watermark position selector", () => {
    render(<ControlPanel />);
    expect(screen.getByText("editor.posBottomRight")).toBeInTheDocument();
    expect(screen.getByText("editor.posBottomLeft")).toBeInTheDocument();
    expect(screen.getByText("editor.posTopRight")).toBeInTheDocument();
    expect(screen.getByText("editor.posTopLeft")).toBeInTheDocument();
  });

  it("renders watermark size slider", () => {
    render(<ControlPanel />);
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
    await userEvent.click(screen.getByText("animation.zoomIn"));
    expect(useEditorStore.getState().scene.layers[0]!.animationPreset).toBe("zoomIn");
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
    const checkbox = screen.getByRole("checkbox", { name: "editor.watermark" });
    await userEvent.click(checkbox);
    expect(useEditorStore.getState().scene.watermarkEnabled).toBe(true);
  });
});
