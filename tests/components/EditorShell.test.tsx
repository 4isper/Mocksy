// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditorShell } from "@/components/editor/EditorShell";
import { useEditorStore } from "@/lib/state/editorStore";
import { useProjectsStore } from "@/lib/state/projectsStore";
import { useThemeStore } from "@/lib/state/themeStore";

afterEach(() => {
  cleanup();
  useEditorStore.setState({
    scene: useEditorStore.getState().scene,
    past: [],
    future: [],
    exportScale: 2,
    customExportSize: null,
  });
  useProjectsStore.setState({ projects: [], activeProjectId: null, saveError: null });
  useThemeStore.setState({ mode: "dark" });
});

beforeEach(() => {
  // Prevent bootstrap effect from hydrating and resetting scene
  vi.spyOn(useProjectsStore.getState(), "hydrate").mockReturnValue(useEditorStore.getState().scene);
});

describe("EditorShell", () => {
  it("renders brand mark and title", () => {
    render(<EditorShell />);
    expect(screen.getByText("Mocksy")).toBeInTheDocument();
  });

  it("renders toolbar with undo/redo buttons", () => {
    render(<EditorShell />);
    const undoBtn = screen.getAllByRole("button").find(b => b.title === "editor.undoTitle");
    const redoBtn = screen.getAllByRole("button").find(b => b.title === "editor.redoTitle");
    expect(undoBtn).toBeTruthy();
    expect(redoBtn).toBeTruthy();
    expect(undoBtn).toBeDisabled();
    expect(redoBtn).toBeDisabled();
  });

  it("renders export button", () => {
    render(<EditorShell />);
    expect(screen.getByText("nav.export")).toBeInTheDocument();
  });

  it("renders reset button", () => {
    render(<EditorShell />);
    const resetBtn = screen.getAllByRole("button").find(b => b.title === "editor.resetBtnTitle");
    expect(resetBtn).toBeTruthy();
  });

  it("renders save button", () => {
    render(<EditorShell />);
    const saveBtn = screen.getAllByRole("button").find(b => b.title === "editor.saveTitle");
    expect(saveBtn).toBeTruthy();
  });

  it("renders share button", () => {
    render(<EditorShell />);
    const shareBtn = screen.getAllByRole("button").find(b => b.title === "editor.shareTitle");
    expect(shareBtn).toBeTruthy();
  });

  it("renders shortcuts button", () => {
    render(<EditorShell />);
    const shortcutsBtn = screen.getAllByRole("button").find(b => b.title === "editor.shortcutsTitle");
    expect(shortcutsBtn).toBeTruthy();
  });

  it("renders theme toggle buttons", () => {
    render(<EditorShell />);
    expect(screen.getByTitle("editor.lightTheme")).toBeInTheDocument();
    expect(screen.getByTitle("editor.darkTheme")).toBeInTheDocument();
    expect(screen.getByTitle("editor.systemTheme")).toBeInTheDocument();
  });

  it("renders saved/unsaved status indicator", () => {
    render(<EditorShell />);
    // Initially unsaved (saved transitions to true after 500ms autosave debounce)
    expect(screen.getByText("editor.unsaved")).toBeInTheDocument();
  });

  it("enables undo after reset creates history", async () => {
    render(<EditorShell />);
    // Click reset → confirm → creates history entry
    const resetBtn = screen.getAllByRole("button").find(b => b.title === "editor.resetBtnTitle");
    await userEvent.click(resetBtn!);
    const confirmBtn = screen.getByText("editor.resetConfirm");
    await userEvent.click(confirmBtn);
    // Reset creates a history entry
    const undoBtn = screen.getAllByRole("button").find(b => b.title === "editor.undoTitle");
    expect(undoBtn).not.toBeDisabled();
  });

  it("opens reset confirmation modal on reset click", async () => {
    render(<EditorShell />);
    const resetBtn = screen.getAllByRole("button").find(b => b.title === "editor.resetBtnTitle");
    await userEvent.click(resetBtn!);
    expect(screen.getByText("editor.resetTitle")).toBeInTheDocument();
    expect(screen.getByText("editor.resetMessage")).toBeInTheDocument();
    expect(screen.getByText("editor.resetCancel")).toBeInTheDocument();
    expect(screen.getByText("editor.resetConfirm")).toBeInTheDocument();
  });

  it("closes reset modal on cancel", async () => {
    render(<EditorShell />);
    const resetBtn = screen.getAllByRole("button").find(b => b.title === "editor.resetBtnTitle");
    await userEvent.click(resetBtn!);
    await userEvent.click(screen.getByText("editor.resetCancel"));
    expect(screen.queryByText("editor.resetTitle")).not.toBeInTheDocument();
  });

  it("switches theme on theme button click", async () => {
    render(<EditorShell />);
    // dark is default from beforeEach
    expect(useThemeStore.getState().mode).toBe("dark");
    await userEvent.click(screen.getByTitle("editor.lightTheme"));
    expect(useThemeStore.getState().mode).toBe("light");
  });

  it("shows editor tagline", () => {
    render(<EditorShell />);
    expect(screen.getByText("editor.tagline")).toBeInTheDocument();
  });

  it("shows unsaved text after scene change", async () => {
    render(<EditorShell />);
    // Simulate a scene change via the store
    useEditorStore.setState({
      scene: { ...useEditorStore.getState().scene, shadowOpacity: 0.5 },
    });
    // After a scene change, the saved indicator should show unsaved
    expect(await screen.findByText("editor.unsaved", {}, { timeout: 2000 })).toBeInTheDocument();
  });
});
