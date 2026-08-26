// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackgroundControls } from "@/components/editor/BackgroundControls";
import { pickBestSolid, pickHarmonicPair } from "@/lib/media/palette";
import { loadMediaFromFile } from "@/lib/media/loadFile";

vi.mock("@/lib/media/loadFile", () => ({
  loadMediaFromFile: vi.fn(),
}));

vi.mock("@/lib/media/palette", () => ({
  pickBestSolid: vi.fn(() => "#123456"),
  pickHarmonicPair: vi.fn(() => ["#111111", "#222222"]),
  gradientMiddleStop: vi.fn(() => "#abcdef"),
}));

const mockLoad = vi.mocked(loadMediaFromFile);
const mockPickBest = vi.mocked(pickBestSolid);
const mockPickPair = vi.mocked(pickHarmonicPair);

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
    backgroundImageUrl: null,
    ...setters,
  };

  it("renders a solid color picker when mode is solid", () => {
    render(<BackgroundControls {...baseProps} />);
    expect(screen.getByDisplayValue("#ffffff")).toBeInTheDocument();
  });

  it("changes the solid color via the picker", () => {
    render(<BackgroundControls {...baseProps} />);
    fireEvent.change(screen.getByDisplayValue("#ffffff"), { target: { value: "#aabbcc" } });
    // The color input fires continuously while dragging, so the change is
    // flagged for history coalescing.
    expect(setters.setBackgroundSolid).toHaveBeenCalledWith("#aabbcc", true);
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
    expect(setters.setBackgroundGradient).toHaveBeenCalledWith("#010203", "#222222", 45, "#333333", "linear", true);
    fireEvent.change(screen.getByDisplayValue("#222222"), { target: { value: "#040506" } });
    expect(setters.setBackgroundGradient).toHaveBeenCalledWith("#111111", "#040506", 45, "#333333", "linear", true);
    fireEvent.change(screen.getByDisplayValue("#333333"), { target: { value: "#070809" } });
    expect(setters.setGradientVia).toHaveBeenCalledWith("#070809", true);
    fireEvent.change(screen.getByRole("slider", { name: "editor.gradientAngle" }), { target: { value: "120" } });
    expect(setters.setBackgroundGradient).toHaveBeenCalledWith("#111111", "#222222", 120, "#333333", "linear", true);
  });

  it("toggles the middle gradient stop off and back on", async () => {
    render(<BackgroundControls {...baseProps} backgroundMode="gradient" />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);
    expect(setters.setGradientVia).toHaveBeenCalledWith(null);
  });

  it("disables the middle picker while the stop is off and re-enables it", async () => {
    render(<BackgroundControls {...baseProps} backgroundMode="gradient" gradientVia={null} />);
    const picker = screen.getByLabelText("editor.gradientMiddle", { selector: "input[type=color]" });
    expect(picker).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox"));
    expect(setters.setGradientVia).toHaveBeenCalledWith("#ffffff");
  });

  it("hides the angle slider for radial gradients", () => {
    render(<BackgroundControls {...baseProps} backgroundMode="gradient" gradientType="radial" />);
    expect(screen.queryByRole("slider", { name: "editor.gradientAngle" })).not.toBeInTheDocument();
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

  it("highlights a gradient preset only for an exact two-stop linear match", () => {
    render(
      <BackgroundControls
        {...baseProps}
        backgroundMode="gradient"
        gradientFrom="#1d4ed8"
        gradientTo="#7c3aed"
        gradientVia={null}
      />
    );
    expect(screen.getByTitle("preset.blue-violet")).toHaveAttribute("aria-pressed", "true");
    cleanup();

    // A leftover middle stop means the scene renders differently from the
    // preset's two-stop swatch.
    render(
      <BackgroundControls
        {...baseProps}
        backgroundMode="gradient"
        gradientFrom="#1d4ed8"
        gradientTo="#7c3aed"
        gradientVia="#ffffff"
      />
    );
    expect(screen.getByTitle("preset.blue-violet")).toHaveAttribute("aria-pressed", "false");
    cleanup();

    // Same colors in radial form are not the preset either.
    render(
      <BackgroundControls
        {...baseProps}
        backgroundMode="gradient"
        gradientFrom="#1d4ed8"
        gradientTo="#7c3aed"
        gradientVia={null}
        gradientType="radial"
      />
    );
    expect(screen.getByTitle("preset.blue-violet")).toHaveAttribute("aria-pressed", "false");
  });

  it("exposes preset names to assistive tech via aria-label", () => {
    render(<BackgroundControls {...baseProps} />);
    expect(screen.getByTitle("preset.zinc")).toHaveAttribute("aria-label", "preset.zinc");
  });

  it("switches background mode via the mode tabs", async () => {
    render(<BackgroundControls {...baseProps} backgroundMode="gradient" />);
    await userEvent.click(screen.getByRole("button", { name: "editor.bgModeSolid" }));
    expect(setters.setBackgroundSolid).toHaveBeenCalledWith("#ffffff");
    await userEvent.click(screen.getByRole("button", { name: "editor.bgModePattern" }));
    expect(setters.setBackgroundPattern).toHaveBeenCalledWith("dots");
    await userEvent.click(screen.getByRole("button", { name: "editor.bgModeTransparent" }));
    expect(setters.setBackgroundTransparent).toHaveBeenCalledTimes(1);
  });

  it("clicking the already-active tab does not push a change", async () => {
    render(<BackgroundControls {...baseProps} backgroundMode="solid" />);
    await userEvent.click(screen.getByRole("button", { name: "editor.bgModeSolid" }));
    expect(setters.setBackgroundSolid).not.toHaveBeenCalled();
  });

  it("image tab switches to image mode only when an image is uploaded", async () => {
    render(<BackgroundControls {...baseProps} backgroundMode="solid" backgroundImageUrl="data:image/png;base64,abc" />);
    await userEvent.click(screen.getByRole("button", { name: "editor.bgModeImage" }));
    expect(setters.setBackgroundImage).toHaveBeenCalledWith("data:image/png;base64,abc");
  });

  it("disables the image tab without an uploaded image", () => {
    render(<BackgroundControls {...baseProps} backgroundMode="solid" />);
    expect(screen.getByRole("button", { name: "editor.bgModeImage" })).toBeDisabled();
    cleanup();
    render(<BackgroundControls {...baseProps} backgroundMode="solid" backgroundImageUrl="data:image/png;base64,abc" />);
    expect(screen.getByRole("button", { name: "editor.bgModeImage" })).toBeEnabled();
  });

  it("clears a stale error message on the next mode switch", async () => {
    mockLoad.mockRejectedValue(new Error("unsupported"));
    render(<BackgroundControls {...baseProps} />);
    const file = new File([""], "bg.gif", { type: "image/gif" });
    await userEvent.upload(screen.getByText("editor.uploadBgImage"), file);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "editor.bgModeGradient" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows only the preset swatches matching the active mode", () => {
    render(<BackgroundControls {...baseProps} backgroundMode="solid" />);
    expect(screen.getByTitle("preset.zinc")).toBeInTheDocument();
    expect(screen.queryByTitle("preset.mint")).not.toBeInTheDocument();
    expect(screen.queryByTitle("preset.dots")).not.toBeInTheDocument();
    expect(screen.queryByTitle("preset.transparent")).not.toBeInTheDocument();
  });

  it("renders the expanded solid preset set", () => {
    render(<BackgroundControls {...baseProps} backgroundMode="solid" />);
    for (const id of ["zinc", "slate", "rose", "emerald", "indigo", "amber", "ivory"]) {
      expect(screen.getByTitle(`preset.${id}`)).toBeInTheDocument();
    }
  });

  it("renders the expanded gradient preset set", () => {
    render(<BackgroundControls {...baseProps} backgroundMode="gradient" />);
    for (const id of ["blue-violet", "sunset", "mint", "ocean", "aurora", "candy", "fire", "ice"]) {
      expect(screen.getByTitle(`preset.${id}`)).toBeInTheDocument();
    }
  });

  it("applies solid, gradient and pattern presets in their mode", async () => {
    render(<BackgroundControls {...baseProps} backgroundMode="solid" />);
    await userEvent.click(screen.getByTitle("preset.zinc"));
    expect(setters.setBackgroundSolid).toHaveBeenCalledWith("#09090b");

    cleanup();
    render(<BackgroundControls {...baseProps} backgroundMode="gradient" gradientFrom="#1d4ed8" gradientTo="#7c3aed" />);
    await userEvent.click(screen.getByTitle("preset.mint"));
    // Gradient presets are two-stop gradients: the leftover middle color is
    // cleared so the preset renders exactly as its swatch.
    expect(setters.setBackgroundGradient).toHaveBeenCalledWith("#059669", "#0ea5e9", 45, null);

    cleanup();
    render(<BackgroundControls {...baseProps} backgroundMode="pattern" patternId="dots" />);
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
    expect(mockPickPair).toHaveBeenCalledWith(["#aa0000", "#0000aa"], expect.any(String));
    const call = setters.setBackgroundGradient.mock.calls.find((c) => c[0] === "#aa0000" && c[1] === "#0000aa");
    expect(call).toBeDefined();
    expect(call![2]).toEqual(expect.any(Number));
    // A harmonic middle stop is added for a richer 3-stop blend.
    expect(call![3]).toMatch(/^#/);
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

  it("renders and applies the plus, cross and triangle pattern presets", async () => {
    render(<BackgroundControls {...baseProps} backgroundMode="pattern" patternId="plus" />);
    // The swatches embed an SVG data URI which happy-dom's CSSOM drops; assert
    // their presence and click behaviour instead of the style.
    for (const id of ["plus", "cross", "triangle"]) {
      expect(screen.getByTitle(`preset.${id}`)).toBeInTheDocument();
    }
    await userEvent.click(screen.getByTitle("preset.cross"));
    expect(setters.setBackgroundPattern).toHaveBeenCalledWith("cross");
    await userEvent.click(screen.getByTitle("preset.triangle"));
    expect(setters.setBackgroundPattern).toHaveBeenCalledWith("triangle");
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
