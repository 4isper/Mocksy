// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShortcutsDialog } from "@/components/editor/ShortcutsDialog";

afterEach(cleanup);

describe("ShortcutsDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<ShortcutsDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders dialog when open", () => {
    render(<ShortcutsDialog open onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("shortcuts.title")).toBeInTheDocument();
  });

  it("lists shortcut groups", () => {
    render(<ShortcutsDialog open onClose={vi.fn()} />);
    expect(screen.getByText("shortcuts.edit")).toBeInTheDocument();
    expect(screen.getByText("shortcuts.export")).toBeInTheDocument();
    expect(screen.getByText("shortcuts.layers")).toBeInTheDocument();
    expect(screen.getByText("shortcuts.scene")).toBeInTheDocument();
  });

  it("close button calls onClose", async () => {
    const onClose = vi.fn();
    render(<ShortcutsDialog open onClose={onClose} />);
    await userEvent.click(screen.getByText("shortcuts.close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("backdrop click calls onClose", async () => {
    const onClose = vi.fn();
    render(<ShortcutsDialog open onClose={onClose} />);
    await userEvent.click(document.querySelector(".modal-backdrop")!);
    expect(onClose).toHaveBeenCalled();
  });

  it("escape key calls onClose", async () => {
    const onClose = vi.fn();
    render(<ShortcutsDialog open onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
