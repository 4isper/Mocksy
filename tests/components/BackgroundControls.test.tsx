// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BackgroundControls } from "@/components/editor/BackgroundControls";

afterEach(() => {
  cleanup();
});

describe("BackgroundControls", () => {
  const props = {
    scenePalette: null,
    backgroundMode: "solid" as const,
    backgroundColor: "#ffffff",
    gradientFrom: "#000000",
    gradientTo: "#ffffff",
    gradientVia: null,
    gradientType: "linear" as const,
    gradientAngle: 0,
    patternId: null,
    backgroundBlur: 0,
    setBackgroundSolid: vi.fn(),
    setBackgroundGradient: vi.fn(),
    setBackgroundTransparent: vi.fn(),
    setBackgroundImage: vi.fn(),
    setBackgroundPattern: vi.fn(),
    setGradientType: vi.fn(),
    setGradientVia: vi.fn(),
    setBackgroundBlur: vi.fn(),
  };

  it("renders a solid color picker when mode is solid", () => {
    render(<BackgroundControls {...props} />);
    expect(screen.getByDisplayValue("#ffffff")).toBeInTheDocument();
  });

  it("renders two color pickers when mode is gradient", () => {
    render(<BackgroundControls {...props} backgroundMode="gradient" />);
    expect(screen.getAllByDisplayValue("#ffffff")).toHaveLength(2);
  });
});