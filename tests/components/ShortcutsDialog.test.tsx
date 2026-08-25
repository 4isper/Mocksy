// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShortcutsDialog } from "@/components/editor/ShortcutsDialog";
import { useShortcutsStore } from "@/lib/state/shortcutsStore";

afterEach(() => {
  cleanup();
  useShortcutsStore.setState({ overrides: {} });
});

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

  it("records a new binding and shows the override, with a reset-all action", async () => {
    render(<ShortcutsDialog open onClose={vi.fn()} />);
    // Start recording on the PNG export row (aria-label from shortcuts.rebind).
    const rebindButtons = screen.getAllByTitle("shortcuts.rebind");
    const pngRow = rebindButtons.find((btn) => btn.closest("li")?.textContent?.includes("shortcuts.exportPng"));
    expect(pngRow).toBeTruthy();
    await userEvent.click(pngRow!);
    expect(screen.getByText("shortcuts.recordingHint")).toBeInTheDocument();

    // Press ⌘J: the row's tokens update to the override…
    fireEvent.keyDown(window, { key: "j", metaKey: true });
    const overriddenKbd = screen.getAllByText("J", { selector: "kbd" });
    expect(overriddenKbd.length).toBeGreaterThan(0);
    // …and "Reset all" appears now that an override exists.
    expect(screen.getByText("shortcuts.resetAll")).toBeInTheDocument();

    await userEvent.click(screen.getByText("shortcuts.resetAll"));
    expect(useShortcutsStore.getState().overrides).toEqual({});
  });

  it("rejects a binding that collides with another shortcut", async () => {
    render(<ShortcutsDialog open onClose={vi.fn()} />);
    const rebindButtons = screen.getAllByTitle("shortcuts.rebind");
    const mp4Row = rebindButtons.find((btn) => btn.closest("li")?.textContent?.includes("shortcuts.exportMp4"));
    await userEvent.click(mp4Row!);
    // ⌘E is export-png's default — conflict must be reported, nothing saved.
    fireEvent.keyDown(window, { key: "e", metaKey: true });
    expect(screen.getByRole("alert")).toHaveTextContent("shortcuts.conflict");
    expect(useShortcutsStore.getState().overrides["export-mp4"]).toBeUndefined();
  });
});
