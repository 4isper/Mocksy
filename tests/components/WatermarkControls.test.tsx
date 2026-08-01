// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { WatermarkControls } from "@/components/editor/WatermarkControls";

afterEach(() => {
  cleanup();
});

describe("WatermarkControls", () => {
  const props = {
    watermarkEnabled: false,
    watermarkText: "Mocksy",
    watermarkPosition: "bottom-right" as const,
    watermarkSize: 16,
    toggleWatermark: vi.fn(),
    setWatermarkText: vi.fn(),
    setWatermarkPosition: vi.fn(),
    setWatermarkSize: vi.fn(),
  };

  it("renders watermark toggle", () => {
    render(<WatermarkControls {...props} />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("renders watermark text input", () => {
    render(<WatermarkControls {...props} />);
    const input = screen.getByDisplayValue("Mocksy");
    expect(input).toBeInTheDocument();
  });

  it("renders position select with all options", () => {
    render(<WatermarkControls {...props} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("editor.posBottomRight")).toBeInTheDocument();
    expect(screen.getByText("editor.posBottomLeft")).toBeInTheDocument();
    expect(screen.getByText("editor.posTopRight")).toBeInTheDocument();
    expect(screen.getByText("editor.posTopLeft")).toBeInTheDocument();
  });

  it("renders size slider", () => {
    render(<WatermarkControls {...props} />);
    const slider = screen.getByRole("slider");
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveValue("16");
  });

  it("calls toggleWatermark when checkbox is toggled", async () => {
    const toggleWatermark = vi.fn();
    render(<WatermarkControls {...props} toggleWatermark={toggleWatermark} />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(toggleWatermark).toHaveBeenCalledWith(true);
  });

  it("calls setWatermarkText when text input changes", () => {
    const setWatermarkText = vi.fn();
    render(<WatermarkControls {...props} setWatermarkText={setWatermarkText} />);
    const input = screen.getByDisplayValue("Mocksy") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "New Text" } });
    expect(setWatermarkText).toHaveBeenCalledWith("New Text");
  });
});