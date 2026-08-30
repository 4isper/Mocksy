// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MobileTabBar } from "@/components/editor/MobileTabBar";
import { useEditorStore } from "@/lib/state/editorStore";

afterEach(() => {
  cleanup();
  useEditorStore.setState({ mobileSheet: null });
});

describe("MobileTabBar", () => {
  it("renders three tabs", () => {
    render(<MobileTabBar onExport={vi.fn()} />);
    expect(screen.getByRole("navigation", { name: /editor.panels/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editor.controls/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editor.panelsTab/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editor.exportTab/ })).toBeInTheDocument();
  });

  it("opens and closes the controls sheet on toggle", () => {
    render(<MobileTabBar onExport={vi.fn()} />);
    const controls = screen.getByRole("button", { name: /editor.controls/ });
    fireEvent.click(controls);
    expect(useEditorStore.getState().mobileSheet).toBe("controls");
    expect(controls).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(controls);
    expect(useEditorStore.getState().mobileSheet).toBeNull();
  });

  it("opens the layers sheet from the second tab", () => {
    render(<MobileTabBar onExport={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /editor.panelsTab/ }));
    expect(useEditorStore.getState().mobileSheet).toBe("right");
  });

  it("switching tabs replaces the open sheet", () => {
    render(<MobileTabBar onExport={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /editor.controls/ }));
    fireEvent.click(screen.getByRole("button", { name: /editor.panelsTab/ }));
    expect(useEditorStore.getState().mobileSheet).toBe("right");
  });

  it("calls onExport from the export tab", () => {
    const onExport = vi.fn();
    render(<MobileTabBar onExport={onExport} />);
    fireEvent.click(screen.getByRole("button", { name: /editor.exportTab/ }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("closes the open sheet on Escape", () => {
    useEditorStore.setState({ mobileSheet: "controls" });
    render(<MobileTabBar onExport={vi.fn()} />);
    expect(useEditorStore.getState().mobileSheet).toBe("controls");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useEditorStore.getState().mobileSheet).toBeNull();
  });

  it("ignores other keys while a sheet is open", () => {
    useEditorStore.setState({ mobileSheet: "controls" });
    render(<MobileTabBar onExport={vi.fn()} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(useEditorStore.getState().mobileSheet).toBe("controls");
  });
});