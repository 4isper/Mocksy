// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { useEditorStore, initialScene, makeDemoScene } from "@/lib/state/editorStore";
import { useProjectsStore } from "@/lib/state/projectsStore";
import { useThemeStore } from "@/lib/state/themeStore";

afterEach(() => {
  cleanup();
  useEditorStore.setState({ scene: initialScene });
  useProjectsStore.setState({ saveError: null });
  useThemeStore.setState({ mode: "dark" });
});

function noop() {}

const baseProps = {
  canUndo: false,
  canRedo: false,
  undoCount: 0,
  redoCount: 0,
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onExport: vi.fn(),
  isExporting: false,
  videoExportStatus: null,
  videoExportProgress: 0,
  gifExportStatus: null,
  gifExportProgress: 0,
  onCancelExport: vi.fn(),
  onShare: vi.fn(),
  onOpenCommandPalette: vi.fn(),
  onOpenShortcuts: vi.fn(),
  onReset: vi.fn(),
  saveToast: null,
  saveStatusType: "info" as const,
  resetNotice: false,
  onUndoReset: vi.fn(),
  onToggleFullscreen: vi.fn()
};

describe("EditorToolbar", () => {
  it("renders brand-independent controls", () => {
    render(<EditorToolbar {...baseProps} />);
    expect(screen.getByText("nav.export")).toBeInTheDocument();
    expect(screen.getByTitle("editor.shareTitle")).toBeInTheDocument();
    expect(screen.getByTitle("editor.shortcutsTitle")).toBeInTheDocument();
  });

  it("renders undo/redo disabled when no history", () => {
    render(<EditorToolbar {...baseProps} />);
    expect(screen.getByTitle("editor.undoTitle")).toBeDisabled();
    expect(screen.getByTitle("editor.redoTitle")).toBeDisabled();
  });

  it("renders undo/redo counts", () => {
    render(<EditorToolbar {...baseProps} undoCount={3} redoCount={1} />);
    expect(screen.getByTitle("editor.undoTitle").textContent).toContain("3");
    expect(screen.getByTitle("editor.redoTitle").textContent).toContain("1");
  });

  it("calls handlers on click", async () => {
    const props = { ...baseProps, onExport: vi.fn(), onShare: vi.fn(), onReset: vi.fn() };
    render(<EditorToolbar {...props} />);
    await userEvent.click(screen.getByText("nav.export"));
    await userEvent.click(screen.getByTitle("editor.shareTitle"));
    await userEvent.click(screen.getByTitle("editor.resetBtnTitle"));
    expect(props.onExport).toHaveBeenCalled();
    expect(props.onShare).toHaveBeenCalled();
    expect(props.onReset).toHaveBeenCalled();
  });

  it("shows video export progress", () => {
    render(<EditorToolbar {...baseProps} videoExportStatus="Encoding" videoExportProgress={42} />);
    expect(screen.getByText("Encoding")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("shows the save toast", () => {
    render(<EditorToolbar {...baseProps} saveToast="Saved" saveStatusType="info" />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("shows the reset notice with undo button", async () => {
    const onUndoReset = vi.fn();
    render(<EditorToolbar {...baseProps} resetNotice onUndoReset={onUndoReset} />);
    expect(screen.getByText("editor.resetDone")).toBeInTheDocument();
    const undoButtons = screen.getAllByTitle("editor.undoTitle");
    await userEvent.click(undoButtons[undoButtons.length - 1]!);
    expect(onUndoReset).toHaveBeenCalled();
  });

  it("switches theme via the segmented control", async () => {
    render(<EditorToolbar {...baseProps} />);
    await userEvent.click(screen.getByTitle("editor.lightTheme"));
    expect(useThemeStore.getState().mode).toBe("light");
    await userEvent.click(screen.getByTitle("editor.systemTheme"));
    expect(useThemeStore.getState().mode).toBe("system");
  });

  it("opens the overflow menu with the secondary actions", async () => {
    render(<EditorToolbar {...baseProps} />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTitle("editor.moreActions"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    for (const name of [
      "editor.lightTheme",
      "editor.darkTheme",
      "editor.systemTheme",
      "editor.shareTitle",
      "editor.commandPaletteTitle",
      "editor.shortcutsTitle",
      "editor.resetBtnTitle",
      "editor.fullscreenTitle"
    ]) {
      expect(screen.getByRole("menuitem", { name })).toBeInTheDocument();
    }
  });

  it("closes the overflow menu on a second toggle", async () => {
    render(<EditorToolbar {...baseProps} />);
    const more = screen.getByTitle("editor.moreActions");
    await userEvent.click(more);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.click(more);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("switches theme from the overflow menu and closes it", async () => {
    render(<EditorToolbar {...baseProps} />);
    await userEvent.click(screen.getByTitle("editor.moreActions"));
    await userEvent.click(screen.getByRole("menuitem", { name: "editor.lightTheme" }));
    expect(useThemeStore.getState().mode).toBe("light");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("checks the active theme in the overflow menu", async () => {
    useThemeStore.setState({ mode: "system" });
    render(<EditorToolbar {...baseProps} />);
    await userEvent.click(screen.getByTitle("editor.moreActions"));
    expect(screen.getByRole("menuitem", { name: "editor.systemTheme" })).toHaveTextContent("✓");
    expect(screen.getByRole("menuitem", { name: "editor.darkTheme" })).not.toHaveTextContent("✓");
  });

  it("wires overflow actions to toolbar handlers", async () => {
    const props = {
      ...baseProps,
      onShare: vi.fn(),
      onOpenCommandPalette: vi.fn(),
      onOpenShortcuts: vi.fn(),
      onReset: vi.fn(),
      onToggleFullscreen: vi.fn()
    };
    render(<EditorToolbar {...props} />);
    await userEvent.click(screen.getByTitle("editor.moreActions"));
    await userEvent.click(screen.getByRole("menuitem", { name: "editor.shareTitle" }));
    await userEvent.click(screen.getByTitle("editor.moreActions"));
    await userEvent.click(screen.getByRole("menuitem", { name: "editor.commandPaletteTitle" }));
    await userEvent.click(screen.getByTitle("editor.moreActions"));
    await userEvent.click(screen.getByRole("menuitem", { name: "editor.resetBtnTitle" }));
    expect(props.onShare).toHaveBeenCalledTimes(1);
    expect(props.onOpenCommandPalette).toHaveBeenCalledTimes(1);
    expect(props.onReset).toHaveBeenCalledTimes(1);
  });
});
