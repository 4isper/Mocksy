// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ContextMenu, type ContextMenuItem } from "@/components/editor/ContextMenu";

afterEach(() => cleanup());

const items: ContextMenuItem[] = [
  { id: "dup", label: "Duplicate", onSelect: vi.fn() },
  { id: "front", label: "Bring to front", onSelect: vi.fn() },
  { id: "remove", label: "Delete", danger: true, separatorBefore: true, onSelect: vi.fn() }
];

describe("ContextMenu", () => {
  it("renders all items and runs the clicked action", () => {
    const onClose = vi.fn();
    render(<ContextMenu x={100} y={100} items={items} onClose={onClose} />);

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeInTheDocument();
    expect(screen.getByRole("separator")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "Bring to front" }));
    expect(items[1]!.onSelect).toHaveBeenCalledTimes(1);
    // Menu closes before running the action.
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape and on outside pointer-down", () => {
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} items={items} onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(window, { bubbles: true });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("does not close when clicking inside the menu", () => {
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} items={items} onClose={onClose} />);
    fireEvent.pointerDown(screen.getByRole("menu"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders disabled items as unclickable", () => {
    const onSelect = vi.fn();
    render(
      <ContextMenu
        x={0}
        y={0}
        items={[{ id: "a", label: "Blocked", disabled: true, onSelect }]}
        onClose={() => {}}
      />
    );
    const btn = screen.getByRole("menuitem", { name: "Blocked" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
