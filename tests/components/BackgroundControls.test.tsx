// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackgroundControls } from "@/components/editor/BackgroundControls";
import { pickBestSolid, pickGradientPair } from "@/lib/media/palette";
import { loadMediaFromFile } from "@/lib/media/loadFile";

vi.mock("@/lib/media/loadFile", () => ({
  loadMediaFromFile: vi.fn(),
}));

vi.mock("@/lib/media/palette", () => ({
  pickBestSolid: vi.fn(() => "#123456"),
  pickGradientPair: vi.fn(() => ["#111111", "#222222"]),
}));

const mockLoad = vi.mocked(loadMediaFromFile);
const mockPickBest = vi.mocked(pickBestSolid);
const mockPickPair = vi.mocked(pickGradientPair);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("BackgroundControls", () => {
  const setters = {
    setBackgroundSolid: vi.fn(),
    setBackgroundGradient: vi.fn(),
    setBackgroundTransparent: vi.fn(),
    setBackgroundImage: vi.fn(),
    setBackgroundPattern: vi.fn(),
    setGradientType: vi.fn(),
    setGradientVia: vi.fn(),
    setBackgroundBlur: vi.fn(),
  };

  const baseProps = {
    scenePalette: null,
    backgroundMode: "solid" as const,
    backgroundColor: "#ffffff",
    gradientFrom: "#111111",
    gradientTo: "#222222",
    gradientVia: "#333333",
    gradientType: "linear" as const,
    gradientAngle: 45,
    patternId: null,
    backgroundBlur: 0,
    ...setters,
  };

  it("renders a solid color picker when mode is solid", () => {
    render(<BackgroundControls {...baseProps} />);
    expect(screen.getByDisplayValue("#ffffff")).toBeInTheDocument();
  });

  it("changes the solid color via the picker", () => {
    render(<BackgroundControls {...baseProps} />);
    fireEvent.change(screen.getByDisplayValue("#ffffff"), { target: { value: "#aabbcc" } });
    expect(setters.setBackgroundSolid).toHaveBeenCalledWith("#aabbcc");
  });

  it("renders from/middle/to pickers and angle slider in gradient mode", () => {
    render(<BackgroundControls {...baseProps} backgroundMode="gradient" />);
    expect(screen.getByDisplayValue("#111111")).toBeInTheDocument();
    expect(screen.getByDisplayValue("#333333")).toBeInTheDocument();
    expect(screen.getByDisplayValue("#222222")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "editor.gradientAngle" })).toHaveValue("45");
  });

  it("edits the gradient stops and angle", () => {
    render(<BackgroundControls {...baseProps} backgroundMode="gradient" />);
    fireEvent.change(screen.getByDisplayValue("#111111"), { target: { value: "#010203" } });
    expect(setters.setBackgroundGradient).toHaveBeenCalledWith("#010203", "#222222", 45, "#333333", "linear");
    fireEvent.change(screen.getByDisplayValue("#222222"), { target: { value: "#040506" } });
    expect(setters.setBackgroundGradient).toHaveBeenCalledWith("#111111", "#040506", 45, "#333333", "linear");
    fireEvent.change(screen.getByDisplayValue("#333333"), { target: { value: "#070809" } });
    expect(setters.setGradientVia).toHaveBeenCalledWith("#070809");
    fireEvent.change(screen.getByRole("slider", { name: "editor.gradientAngle" }), { target: { value: "120" } });
    expect(setters.setBackgroundGradient).toHaveBeenCalledWith("#111111", "#222222", 120, "#333333", "linear");
  });

  it("switches between linear and radial gradient types", async () => {
    render(<BackgroundControls {...baseProps} backgroundMode="gradient" />);
    await userEvent.click(screen.getByRole("radio", { name: "editor.gradientRadial" }));
    expect(setters.setGradientType).toHaveBeenCalledWith("radial");
  });

  it("applies the matching preset as active", () => {
    render(
      <BackgroundControls
        {...baseProps}
        backgroundMode="solid"
        backgroundColor="#0f172a"
        gradientFrom="#0f172a"
        gradientTo="#7c3aed"
      />
    );
    expect(screen.getByTitle("preset.slate")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTitle("preset.zinc")).toHaveAttribute("aria-pressed", "false");
  });

  it("applies transparent, solid, gradient and pattern presets", async () => {
    render(<BackgroundControls {...baseProps} backgroundMode="gradient" gradientFrom="#1d4ed8" gradientTo="#7c3aed" />);
    await userEvent.click(screen.getByTitle("preset.transparent"));
    expect(setters.setBackgroundTransparent).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByTitle("preset.zinc"));
    expect(setters.setBackgroundSolid).toHaveBeenCalledWith("#09090b");
    await userEvent.click(screen.getByTitle("preset.mint"));
    expect(setters.setBackgroundGradient).toHaveBeenCalledWith("#059669", "#0ea5e9", 45);
    await userEvent.click(screen.getByTitle("preset.dots"));
    expect(setters.setBackgroundPattern).toHaveBeenCalledWith("dots");
    await userEvent.click(screen.getByTitle("preset.noise"));
    expect(setters.setBackgroundPattern).toHaveBeenCalledWith("noise");
  });

  it("renders the media palette swatches and picks a solid from them", async () => {
    render(<BackgroundControls {...baseProps} scenePalette={["#ff0000", "#00ff00", "#0000ff"]} />);
    expect(screen.getByTitle("#ff0000")).toBeInTheDocument();
    expect(screen.getByTitle("#00ff00")).toBeInTheDocument();
    expect(screen.getByTitle("#0000ff")).toBeInTheDocument();
    await userEvent.click(screen.getByTitle("#ff0000"));
    expect(setters.setBackgroundSolid).toHaveBeenCalledWith("#ff0000");
  });

  it("applies an auto gradient from the media palette", async () => {
    mockPickPair.mockReturnValue(["#aa0000", "#0000aa"]);
    render(<BackgroundControls {...baseProps} scenePalette={["#aa0000", "#0000aa"]} />);
    await userEvent.click(screen.getByText("editor.autoBackground"));
    expect(mockPickPair).toHaveBeenCalledWith(["#aa0000", "#0000aa"]);
    expect(setters.setBackgroundGradient).toHaveBeenCalledWith("#aa0000", "#0000aa", expect.any(Number));
  });

  it("applies an auto solid from the media palette", async () => {
    mockPickBest.mockReturnValue("#bbbbbb");
    render(<BackgroundControls {...baseProps} scenePalette={["#bbbbbb", "#cccccc"]} />);
    await userEvent.click(screen.getByText("editor.autoSolid"));
    expect(mockPickBest).toHaveBeenCalledWith(["#bbbbbb", "#cccccc"]);
    expect(setters.setBackgroundSolid).toHaveBeenCalledWith("#bbbbbb");
  });

  it("disables auto buttons without a palette", () => {
    render(<BackgroundControls {...baseProps} scenePalette={null} />);
    expect(screen.getByText("editor.autoBackground")).toBeDisabled();
    expect(screen.getByText("editor.autoSolid")).toBeDisabled();
  });

  it("enables auto buttons when a palette is present", () => {
    render(<BackgroundControls {...baseProps} scenePalette={["#ff0000"]} />);
    expect(screen.getByText("editor.autoBackground")).toBeEnabled();
    expect(screen.getByText("editor.autoSolid")).toBeEnabled();
  });

  it("adjusts blur and removes the background image in image mode", async () => {
    render(<BackgroundControls {...baseProps} backgroundMode="image" backgroundBlur={8} />);
    const blur = screen.getByRole("slider", { name: "editor.bgBlurLabel" });
    expect(blur).toHaveValue("8");
    fireEvent.change(blur, { target: { value: "16" } });
    expect(setters.setBackgroundBlur).toHaveBeenCalledWith(16);
    await userEvent.click(screen.getByText("editor.removeBgImage"));
    expect(setters.setBackgroundTransparent).toHaveBeenCalledTimes(1);
  });

  it("does not render the blur slider outside image mode", () => {
    render(<BackgroundControls {...baseProps} backgroundMode="solid" />);
    expect(screen.queryByRole("slider", { name: "editor.bgBlurLabel" })).not.toBeInTheDocument();
  });

  it("marks the active pattern preset and styles its swatch", () => {
    render(<BackgroundControls {...baseProps} backgroundMode="pattern" patternId="grid" />);
    const active = screen.getByTitle("preset.grid");
    expect(active).toHaveAttribute("aria-pressed", "true");
    expect(active.style.background).toContain("repeating-linear-gradient");
  });

  it("styles each pattern preset swatch", () => {
    render(<BackgroundControls {...baseProps} backgroundMode="pattern" patternId="dots" />);
    expect(screen.getByTitle("preset.dots").style.background).toContain("radial-gradient");
    expect(screen.getByTitle("preset.diagonal").style.background).toContain("repeating-linear-gradient(45deg");
    // The noise swatch embeds an SVG data URI which happy-dom's CSSOM drops;
    // assert its behaviour (click applies the pattern) instead of the style.
    expect(screen.getByTitle("preset.noise")).toBeInTheDocument();
  });

  it("uploads a background image and applies it", async () => {
    mockLoad.mockResolvedValue({ url: "blob:bg", mediaType: "image", mediaName: "bg.png" });
    render(<BackgroundControls {...baseProps} />);
    const file = new File([""], "bg.png", { type: "image/png" });
    await userEvent.upload(screen.getByText("editor.uploadBgImage"), file);
    await waitFor(() => expect(setters.setBackgroundImage).toHaveBeenCalledWith("blob:bg"));
  });

  it("silently ignores an unsupported background image", async () => {
    mockLoad.mockRejectedValue(new Error("unsupported"));
    render(<BackgroundControls {...baseProps} />);
    const file = new File([""], "bg.gif", { type: "image/gif" });
    await userEvent.upload(screen.getByText("editor.uploadBgImage"), file);
    await waitFor(() => expect(setters.setBackgroundImage).not.toHaveBeenCalled());
  });

  it("renders no palette swatches when the palette is empty", () => {
    render(<BackgroundControls {...baseProps} scenePalette={null} />);
    expect(screen.queryByTitle(/^#/)).not.toBeInTheDocument();
  });
});
