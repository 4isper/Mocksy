// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportDialog } from "@/components/editor/ExportDialog";

afterEach(cleanup);

describe("ExportDialog", () => {
  const baseProps = {
    open: true,
    onClose: vi.fn(),
    scale: 2 as 1 | 2 | 4,
    onScaleChange: vi.fn(),
    customSize: null,
    onCustomSizeChange: vi.fn(),
    onExport: vi.fn(),
    onCopy: vi.fn(),
  };

  it("renders nothing when closed", () => {
    const { container } = render(<ExportDialog {...baseProps} open={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders format segmented buttons", () => {
    render(<ExportDialog {...baseProps} />);
    expect(screen.getByText("export.png")).toBeInTheDocument();
    expect(screen.getByText("export.jpeg")).toBeInTheDocument();
    expect(screen.getByText("export.webp")).toBeInTheDocument();
    expect(screen.getByText("export.svg")).toBeInTheDocument();
    expect(screen.getByText("export.html")).toBeInTheDocument();
    expect(screen.getByText("export.mp4")).toBeInTheDocument();
    expect(screen.getByText("export.webm")).toBeInTheDocument();
    expect(screen.getByText("export.gif")).toBeInTheDocument();
    expect(screen.getByText("export.webpAnim")).toBeInTheDocument();
  });

  it("hides the scale selector for SVG and HTML formats", async () => {
    render(<ExportDialog {...baseProps} />);
    await userEvent.click(screen.getByText("export.svg"));
    expect(screen.queryByText("export.scale2x")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("export.html"));
    expect(screen.queryByText("export.scale2x")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("export.webp"));
    expect(screen.getByText("export.scale2x")).toBeInTheDocument();
  });

  it("calls onExport with each newly added format", async () => {
    const onExport = vi.fn();
    render(<ExportDialog {...baseProps} onExport={onExport} />);
    for (const format of ["jpeg", "webp", "svg", "html", "webm", "webpAnim"]) {
      onExport.mockClear();
      await userEvent.click(screen.getByText(`export.${format}`));
      await userEvent.click(screen.getByText("export.exportAction"));
      expect(onExport).toHaveBeenCalledWith(format);
    }
  });

  it("renders scale segmented buttons", () => {
    render(<ExportDialog {...baseProps} />);
    expect(screen.getByText("export.scale1x")).toBeInTheDocument();
    expect(screen.getByText("export.scale2x")).toBeInTheDocument();
    expect(screen.getByText("export.scale4x")).toBeInTheDocument();
  });

  it("defaults PNG format selected", () => {
    render(<ExportDialog {...baseProps} />);
    const btn = screen.getAllByRole("button", { pressed: true }).find(b => b.textContent === "export.png");
    expect(btn).toBeTruthy();
  });

  it("shows copy button for PNG format only", () => {
    render(<ExportDialog {...baseProps} />);
    expect(screen.getByText("export.copy")).toBeInTheDocument();
  });

  it("hides copy button for MP4 format", async () => {
    render(<ExportDialog {...baseProps} />);
    await userEvent.click(screen.getByText("export.mp4"));
    expect(screen.queryByText("export.copy")).not.toBeInTheDocument();
  });

  it("calls onScaleChange when scale is clicked", async () => {
    const onScaleChange = vi.fn();
    render(<ExportDialog {...baseProps} onScaleChange={onScaleChange} />);
    await userEvent.click(screen.getByText("export.scale1x"));
    expect(onScaleChange).toHaveBeenCalledWith(1);
  });

  it("calls onExport with current format", async () => {
    const onExport = vi.fn();
    render(<ExportDialog {...baseProps} onExport={onExport} />);
    await userEvent.click(screen.getByText("export.exportAction"));
    expect(onExport).toHaveBeenCalledWith("png");
  });

  it("calls onExport with mp4 after switching format", async () => {
    const onExport = vi.fn();
    render(<ExportDialog {...baseProps} onExport={onExport} />);
    await userEvent.click(screen.getByText("export.mp4"));
    await userEvent.click(screen.getByText("export.exportAction"));
    expect(onExport).toHaveBeenCalledWith("mp4");
  });

  it("calls onCopy when copy is clicked", async () => {
    const onCopy = vi.fn();
    render(<ExportDialog {...baseProps} onCopy={onCopy} />);
    await userEvent.click(screen.getByText("export.copy"));
    expect(onCopy).toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", async () => {
    const onClose = vi.fn();
    render(<ExportDialog {...baseProps} onClose={onClose} />);
    await userEvent.click(document.querySelector(".modal-backdrop")!);
    expect(onClose).toHaveBeenCalled();
  });

  it("ignores backdrop clicks while an export is running", async () => {
    const onClose = vi.fn();
    const onCancel = vi.fn();
    render(<ExportDialog {...baseProps} onClose={onClose} busy onCancel={onCancel} />);
    await userEvent.click(document.querySelector(".modal-backdrop")!);
    expect(onClose).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("disables buttons when busy", () => {
    render(<ExportDialog {...baseProps} busy />);
    const exportBtn = screen.getByRole("button", { name: "export.exportAction" });
    expect(exportBtn).toBeDisabled();
  });

  it("enables the custom-size inputs when Custom is selected", async () => {
    const onCustomSizeChange = vi.fn();
    const { rerender } = render(<ExportDialog {...baseProps} onCustomSizeChange={onCustomSizeChange} />);
    expect(screen.queryByRole("spinbutton", { name: "export.width" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("export.custom"));
    // enabling custom mode offers the default size to the store
    expect(onCustomSizeChange).toHaveBeenCalledWith({ width: 1280, height: 720 });
    // once the store acknowledges, the inputs appear
    rerender(<ExportDialog {...baseProps} customSize={{ width: 1280, height: 720 }} onCustomSizeChange={onCustomSizeChange} />);
    expect(screen.getByRole("spinbutton", { name: "export.width" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "export.height" })).toBeInTheDocument();
  });

  it("clears custom mode when a scale preset is picked", async () => {
    const onScaleChange = vi.fn();
    const onCustomSizeChange = vi.fn();
    const { rerender } = render(<ExportDialog {...baseProps} customSize={{ width: 1280, height: 720 }} onScaleChange={onScaleChange} onCustomSizeChange={onCustomSizeChange} />);
    await userEvent.click(screen.getByText("export.scale4x"));
    expect(onScaleChange).toHaveBeenCalledWith(4);
    expect(onCustomSizeChange).toHaveBeenCalledWith(null);
    // once the store clears the custom size, the inputs disappear
    rerender(<ExportDialog {...baseProps} customSize={null} onScaleChange={onScaleChange} onCustomSizeChange={onCustomSizeChange} />);
    expect(screen.queryByRole("spinbutton", { name: "export.width" })).not.toBeInTheDocument();
  });

  it("updates the custom size when the width input changes", () => {
    const onCustomSizeChange = vi.fn();
    render(<ExportDialog {...baseProps} customSize={{ width: 1280, height: 720 }} onCustomSizeChange={onCustomSizeChange} />);
    const width = screen.getByRole("spinbutton", { name: "export.width" });
    fireEvent.change(width, { target: { value: "1920" } });
    expect(onCustomSizeChange).toHaveBeenLastCalledWith({ width: 1920, height: 720 });
  });

  it("clamps custom-size inputs to positive integers", () => {
    const onCustomSizeChange = vi.fn();
    render(<ExportDialog {...baseProps} customSize={{ width: 1280, height: 720 }} onCustomSizeChange={onCustomSizeChange} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "export.width" }), { target: { value: "0" } });
    expect(onCustomSizeChange).toHaveBeenLastCalledWith({ width: 1, height: 720 });
  });

  it("renders platform size presets for raster formats", () => {
    render(<ExportDialog {...baseProps} />);
    expect(screen.getByText("export.platform.appStorePhone")).toBeInTheDocument();
    expect(screen.getByText("export.platform.dribbbleShot")).toBeInTheDocument();
    expect(screen.getByText("export.platform.story")).toBeInTheDocument();
  });

  it("hides platform size presets for vector formats", async () => {
    render(<ExportDialog {...baseProps} />);
    await userEvent.click(screen.getByText("export.svg"));
    expect(screen.queryByText("export.platform.dribbbleShot")).not.toBeInTheDocument();
  });

  it("applies a platform preset as exact size plus nearest aspect ratio", async () => {
    const onCustomSizeChange = vi.fn();
    const onAspectRatioChange = vi.fn();
    render(
      <ExportDialog
        {...baseProps}
        onCustomSizeChange={onCustomSizeChange}
        onAspectRatioChange={onAspectRatioChange}
      />
    );
    await userEvent.click(screen.getByText("export.platform.dribbbleShot"));
    expect(onCustomSizeChange).toHaveBeenCalledWith({ width: 1600, height: 1200 });
    expect(onAspectRatioChange).toHaveBeenCalledWith("4 / 3");
  });

  it("applies the nearest ratio when a preset has no exact match", async () => {
    const onAspectRatioChange = vi.fn();
    render(<ExportDialog {...baseProps} onAspectRatioChange={onAspectRatioChange} />);
    await userEvent.click(screen.getByText("export.platform.appStorePhone"));
    expect(onAspectRatioChange).toHaveBeenCalledWith("9 / 16");
  });

  it("marks the active platform preset", () => {
    render(<ExportDialog {...baseProps} customSize={{ width: 1600, height: 1200 }} />);
    expect(screen.getByText("export.platform.dribbbleShot")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("export.platform.story")).toHaveAttribute("aria-pressed", "false");
  });
});
