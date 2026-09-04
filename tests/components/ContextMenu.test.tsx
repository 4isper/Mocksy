// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ContextMenu, type ContextMenuItem } from "@/components/editor/ContextMenu";

afterEach(() => {
  cleanup();
});

function items(overrides: Partial<ContextMenuItem>[] = []): ContextMenuItem[] {
  const base = [
    { id: "copy", label: "Copy", onSelect: vi.fn() },
    { id: "paste", label: "Paste", onSelect: vi.fn(), separatorBefore: true },
    { id: "delete", label: "Delete", onSelect: vi.fn(), danger: true, disabled: true },
  ];
  return base.map((item, i) => ({ ...item, ...(overrides[i] ?? {}) }));
}

describe("ContextMenu", () => {
  it("renders items with separators and disabled state", () => {
    render(<ContextMenu x={0} y={0} items={items()} onClose={vi.fn()} />);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeDisabled();
    expect(screen.getAllByRole("separator").length).toBeGreaterThanOrEqual(1);
  });

  it("selects an enabled item on click and closes", () => {
    const list = items();
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} items={list} onClose={onClose} />);
    fireEvent.click(screen.getByRole("menuitem", { name: "Copy" }));
    expect(list[0]!.onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not select a disabled item on click", () => {
    const list = items();
    render(<ContextMenu x={0} y={0} items={list} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(list[2]!.onSelect).not.toHaveBeenCalled();
  });

  it("renders a check mark for checked items", () => {
    const list = [{ id: "t", label: "Dark", onSelect: vi.fn(), checked: true }];
    render(<ContextMenu x={0} y={0} items={list} onClose={vi.fn()} />);
    expect(screen.getByRole("menuitem", { name: "Dark" })).toHaveTextContent("✓");
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} items={items()} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("navigates with ArrowDown and selects the focused item with Enter", () => {
    const list = items([{ id: "a", label: "A", onSelect: vi.fn() }, { id: "b", label: "B", onSelect: vi.fn() }]);
    render(<ContextMenu x={0} y={0} items={list} onClose={vi.fn()} />);
    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "B" })).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(menu, { key: "Enter" });
    expect(list[1]!.onSelect).toHaveBeenCalledTimes(1);
  });

  it("wraps with ArrowUp and treats Space as a select", () => {
    const list = items([{ id: "a", label: "A", onSelect: vi.fn() }, { id: "b", label: "B", onSelect: vi.fn() }]);
    render(<ContextMenu x={0} y={0} items={list} onClose={vi.fn()} />);
    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(screen.getByRole("menuitem", { name: "B" })).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(menu, { key: " " });
    expect(list[1]!.onSelect).toHaveBeenCalledTimes(1);
  });

  it("skips disabled items while navigating", () => {
    const list = items();
    render(<ContextMenu x={0} y={0} items={list} onClose={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Paste" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveAttribute("tabindex", "-1");
  });

  it("moves focus on mouse hover", () => {
    render(<ContextMenu x={0} y={0} items={items()} onClose={vi.fn()} />);
    fireEvent.mouseEnter(screen.getByRole("menuitem", { name: "Paste" }));
    expect(screen.getByRole("menuitem", { name: "Paste" })).toHaveAttribute("tabindex", "0");
  });

  it("closes on an outside pointerdown", () => {
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} items={items()} onClose={onClose} />);
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it("does not close on a pointerdown inside the trigger button", () => {
    const onClose = vi.fn();
    const trigger = { current: document.createElement("button") };
    render(<ContextMenu x={0} y={0} items={items()} onClose={onClose} triggerRef={trigger} />);
    fireEvent.pointerDown(trigger.current!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the menu open on an inside pointerdown", () => {
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} items={items()} onClose={onClose} />);
    fireEvent.pointerDown(screen.getByRole("menu"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("restores focus to the previously focused element on close", () => {
    const onClose = vi.fn();
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.textContent = "Trigger";
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    render(<ContextMenu x={0} y={0} items={items()} onClose={onClose} />);
    // The layout effect refocuses the first menu item after opening.
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Copy" }));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});