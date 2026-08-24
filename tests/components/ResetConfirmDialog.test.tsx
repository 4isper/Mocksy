// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResetConfirmDialog } from "@/components/editor/ResetConfirmDialog";

afterEach(cleanup);

describe("ResetConfirmDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<ResetConfirmDialog open={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the title, message and actions when open", () => {
    render(<ResetConfirmDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("editor.resetTitle")).toBeInTheDocument();
    expect(screen.getByText("editor.resetMessage")).toBeInTheDocument();
    expect(screen.getByText("editor.resetCancel")).toBeInTheDocument();
    expect(screen.getByText("editor.resetConfirm")).toBeInTheDocument();
  });

  it("calls onConfirm when confirming", async () => {
    const onConfirm = vi.fn();
    render(<ResetConfirmDialog open onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByText("editor.resetConfirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancelling", async () => {
    const onCancel = vi.fn();
    render(<ResetConfirmDialog open onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByText("editor.resetCancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel on Escape", () => {
    const onCancel = vi.fn();
    render(<ResetConfirmDialog open onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("has modal semantics", () => {
    const { container } = render(<ResetConfirmDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-labelledby")).toBe("reset-title");
    expect(dialog?.getAttribute("aria-describedby")).toBe("reset-desc");
  });
});
