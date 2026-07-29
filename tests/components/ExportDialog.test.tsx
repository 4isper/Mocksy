// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportDialog } from "@/components/editor/ExportDialog";

afterEach(cleanup);

describe("ExportDialog", () => {
  const baseProps = {
    open: true,
    onClose: vi.fn(),
    scale: 2 as 1 | 2 | 4,
    onScaleChange: vi.fn(),
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
    expect(screen.getByText("export.mp4")).toBeInTheDocument();
    expect(screen.getByText("export.gif")).toBeInTheDocument();
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

  it("disables buttons when busy", () => {
    render(<ExportDialog {...baseProps} busy />);
    const exportBtn = screen.getByRole("button", { name: "export.exportAction" });
    expect(exportBtn).toBeDisabled();
  });
});
