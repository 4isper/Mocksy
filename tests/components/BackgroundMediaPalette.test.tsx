// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackgroundMediaPalette } from "@/components/editor/BackgroundMediaPalette";
import { pickBestSolid, pickHarmonicPair, gradientMiddleStop } from "@/lib/media/palette";

vi.mock("@/lib/media/palette", () => ({
  pickBestSolid: vi.fn(() => "#aabbcc"),
  pickHarmonicPair: vi.fn(() => ["#111111", "#222222"]),
  gradientMiddleStop: vi.fn(() => "#abcdef"),
}));

const mockPickBest = vi.mocked(pickBestSolid);
const mockPickPair = vi.mocked(pickHarmonicPair);
const mockMiddleStop = vi.mocked(gradientMiddleStop);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const baseProps = {
  scenePalette: null as string[] | null,
  gradientAngle: 45,
  backgroundMode: "solid" as const,
  backgroundColor: "#ffffff",
  setBackgroundSolid: vi.fn(),
  setBackgroundGradient: vi.fn(),
};

describe("BackgroundMediaPalette", () => {
  it("disables buttons when no palette", () => {
    render(<BackgroundMediaPalette {...baseProps} />);
    const autoGradient = screen.getByRole("button", { name: "editor.autoBackground" });
    const autoSolid = screen.getByRole("button", { name: "editor.autoSolid" });
    expect(autoGradient).toBeDisabled();
    expect(autoSolid).toBeDisabled();
  });

  it("enables buttons when palette is provided", () => {
    render(<BackgroundMediaPalette {...baseProps} scenePalette={["#ff0000", "#00ff00"]} />);
    const autoGradient = screen.getByRole("button", { name: "editor.autoBackground" });
    const autoSolid = screen.getByRole("button", { name: "editor.autoSolid" });
    expect(autoGradient).toBeEnabled();
    expect(autoSolid).toBeEnabled();
  });

  it("auto-gradient calls pickHarmonicPair and setBackgroundGradient", async () => {
    const setBackgroundGradient = vi.fn();
    render(
      <BackgroundMediaPalette
        {...baseProps}
        scenePalette={["#ff0000", "#00ff00", "#0000ff"]}
        gradientAngle={0}
        setBackgroundGradient={setBackgroundGradient}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "editor.autoBackground" }));

    expect(mockPickPair).toHaveBeenCalled();
    expect(mockMiddleStop).toHaveBeenCalled();
    expect(setBackgroundGradient).toHaveBeenCalledWith(
      "#111111",
      "#222222",
      expect.any(Number),
      "#abcdef"
    );
  });

  it("auto-gradient advances to next angle in cycle", async () => {
    const setBackgroundGradient = vi.fn();
    render(
      <BackgroundMediaPalette
        {...baseProps}
        scenePalette={["#ff0000"]}
        gradientAngle={0}
        setBackgroundGradient={setBackgroundGradient}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "editor.autoBackground" }));

    // nextAngle(0) returns 45 (first angle > 0)
    const calledAngle = setBackgroundGradient.mock.calls[0]?.[2];
    expect(calledAngle).toBe(45);
  });

  it("auto-gradient wraps to 0 when angle exceeds max", async () => {
    const setBackgroundGradient = vi.fn();
    render(
      <BackgroundMediaPalette
        {...baseProps}
        scenePalette={["#ff0000"]}
        gradientAngle={180}
        setBackgroundGradient={setBackgroundGradient}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "editor.autoBackground" }));

    // nextAngle(180) wraps to 0 (angles[0])
    const calledAngle = setBackgroundGradient.mock.calls[0]?.[2];
    expect(calledAngle).toBe(0);
  });

  it("auto-solid calls pickBestSolid and setBackgroundSolid", async () => {
    const setBackgroundSolid = vi.fn();
    render(
      <BackgroundMediaPalette
        {...baseProps}
        scenePalette={["#ff0000", "#00ff00"]}
        setBackgroundSolid={setBackgroundSolid}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "editor.autoSolid" }));

    expect(mockPickBest).toHaveBeenCalledWith(["#ff0000", "#00ff00"]);
    expect(setBackgroundSolid).toHaveBeenCalledWith("#aabbcc");
  });

  it("renders palette swatches when palette is provided", () => {
    render(<BackgroundMediaPalette {...baseProps} scenePalette={["#ff0000", "#00ff00", "#0000ff"]} />);

    const swatchRed = screen.getByRole("button", { name: "#ff0000" });
    const swatchGreen = screen.getByRole("button", { name: "#00ff00" });
    const swatchBlue = screen.getByRole("button", { name: "#0000ff" });
    expect(swatchRed).toBeInTheDocument();
    expect(swatchGreen).toBeInTheDocument();
    expect(swatchBlue).toBeInTheDocument();
  });

  it("does not render swatches when palette is null", () => {
    render(<BackgroundMediaPalette {...baseProps} scenePalette={null} />);
    expect(screen.queryByRole("button", { name: "#ff0000" })).not.toBeInTheDocument();
  });

  it("does not render swatches when palette is empty", () => {
    render(<BackgroundMediaPalette {...baseProps} scenePalette={[]} />);
    expect(screen.queryByRole("button", { name: /#/ })).not.toBeInTheDocument();
  });

  it("swatch click calls setBackgroundSolid with the swatch color", async () => {
    const setBackgroundSolid = vi.fn();
    render(
      <BackgroundMediaPalette
        {...baseProps}
        scenePalette={["#ff0000", "#00ff00"]}
        setBackgroundSolid={setBackgroundSolid}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "#ff0000" }));
    expect(setBackgroundSolid).toHaveBeenCalledWith("#ff0000");
  });

  it("marks the active swatch with aria-pressed", () => {
    render(
      <BackgroundMediaPalette
        {...baseProps}
        scenePalette={["#ff0000", "#00ff00"]}
        backgroundMode="solid"
        backgroundColor="#ff0000"
      />
    );

    expect(screen.getByRole("button", { name: "#ff0000" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "#00ff00" })).toHaveAttribute("aria-pressed", "false");
  });

  it("aria-pressed is false when background mode is not solid", () => {
    render(
      <BackgroundMediaPalette
        {...baseProps}
        scenePalette={["#ff0000"]}
        backgroundMode="gradient"
        backgroundColor="#ff0000"
      />
    );

    expect(screen.getByRole("button", { name: "#ff0000" })).toHaveAttribute("aria-pressed", "false");
  });
});
