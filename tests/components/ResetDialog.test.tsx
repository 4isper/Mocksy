// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ResetDialog } from "@/components/editor/ResetDialog";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

vi.mock("@/lib/hooks/useFocusTrap", () => ({
  useFocusTrap: vi.fn(() => ({ current: null })),
}));

afterEach(() => {
  cleanup();
});

describe("ResetDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<ResetDialog open={false} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders dialog content when open", () => {
    render(<ResetDialog open onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("editor.resetTitle")).toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<ResetDialog open onClose={onClose} onConfirm={vi.fn()} />);
    screen.getByRole("presentation").click();
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onConfirm when reset button is clicked", () => {
    const onConfirm = vi.fn();
    render(<ResetDialog open onClose={vi.fn()} onConfirm={onConfirm} />);
    screen.getByText("editor.resetConfirm").click();
    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onClose when cancel button is clicked", () => {
    const onClose = vi.fn();
    render(<ResetDialog open onClose={onClose} onConfirm={vi.fn()} />);
    screen.getByText("editor.resetCancel").click();
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    render(<ResetDialog open onClose={onClose} onConfirm={vi.fn()} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});