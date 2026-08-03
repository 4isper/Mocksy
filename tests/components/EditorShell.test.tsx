// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditorShell } from "@/components/editor/EditorShell";
import { useEditorStore, makeDemoScene, initialScene } from "@/lib/state/editorStore";
import { useProjectsStore } from "@/lib/state/projectsStore";
import { useThemeStore } from "@/lib/state/themeStore";

const mockExportImage = vi.hoisted(() => ({
  exportImage: vi.fn(),
  copyPngToClipboard: vi.fn(),
  exportWebp: vi.fn()
}));
const mockExportSvg = vi.hoisted(() => ({ exportSvg: vi.fn() }));
const mockExportHtml = vi.hoisted(() => ({ exportHtml: vi.fn() }));
const mockExportVideo = vi.hoisted(() => ({
  exportVideo: vi.fn(),
  exportWebm: vi.fn(),
  exportWebpAnim: vi.fn(),
  exportGif: vi.fn(),
  warmUpFfmpeg: vi.fn()
}));

vi.mock("@/lib/export/exportImage", () => mockExportImage);
vi.mock("@/lib/export/exportSvg", () => mockExportSvg);
vi.mock("@/lib/export/exportHtml", () => mockExportHtml);
vi.mock("@/lib/export/exportVideo", () => mockExportVideo);

afterEach(() => {
  cleanup();
  useEditorStore.setState({
    scene: initialScene,
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
  vi.spyOn(useProjectsStore.getState(), "hydrate").mockImplementation(() => useEditorStore.getState().scene);
  vi.clearAllMocks();
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

describe("EditorShell keyboard shortcuts", () => {
  it('opens shortcuts dialog on "?"', () => {
    render(<EditorShell />);
    fireEvent.keyDown(window, { key: "?", code: "Slash", shiftKey: true });
    expect(screen.getByText("shortcuts.edit")).toBeInTheDocument();
  });

  it("opens command palette on ⌘K", () => {
    render(<EditorShell />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByPlaceholderText("commandPalette.searchPlaceholder")).toBeInTheDocument();
  });

  it("does not open shortcuts when typing in an input", () => {
    render(<EditorShell />);
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "?", code: "Slash", shiftKey: true });
    expect(screen.queryByText("shortcuts.edit")).not.toBeInTheDocument();
    input.remove();
  });

  it("does not open command palette while a modal is open", () => {
    render(<EditorShell />);
    const resetBtn = screen.getAllByRole("button").find(b => b.title === "editor.resetBtnTitle");
    fireEvent.click(resetBtn!);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.queryByPlaceholderText("commandPalette.searchPlaceholder")).not.toBeInTheDocument();
  });

  it("closes shortcuts dialog on Escape", () => {
    render(<EditorShell />);
    fireEvent.keyDown(window, { key: "?", code: "Slash", shiftKey: true });
    expect(screen.getByText("shortcuts.edit")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("shortcuts.edit")).not.toBeInTheDocument();
  });

  it("closes reset confirmation modal on Escape", () => {
    render(<EditorShell />);
    const resetBtn = screen.getAllByRole("button").find(b => b.title === "editor.resetBtnTitle");
    fireEvent.click(resetBtn!);
    expect(screen.getByText("editor.resetTitle")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("editor.resetTitle")).not.toBeInTheDocument();
  });

  it("undoes on ⌘Z and redoes on ⌘⇧Z", () => {
    render(<EditorShell />);
    const undo = useEditorStore.getState().setScene;
    undo({ shadowOpacity: 0.5 });
    expect(useEditorStore.getState().scene.shadowOpacity).toBe(0.5);
    fireEvent.keyDown(window, { key: "z", metaKey: true });
    expect(useEditorStore.getState().scene.shadowOpacity).toBe(0.4);
    fireEvent.keyDown(window, { key: "z", metaKey: true, shiftKey: true });
    expect(useEditorStore.getState().scene.shadowOpacity).toBe(0.5);
  });

  it("redoes on ⌘Y", () => {
    render(<EditorShell />);
    useEditorStore.getState().setScene({ shadowOpacity: 0.5 });
    fireEvent.keyDown(window, { key: "z", metaKey: true });
    expect(useEditorStore.getState().scene.shadowOpacity).toBe(0.4);
    fireEvent.keyDown(window, { key: "y", metaKey: true });
    expect(useEditorStore.getState().scene.shadowOpacity).toBe(0.5);
  });

  it("saves on ⌘S", () => {
    const updateSpy = vi.spyOn(useProjectsStore.getState(), "updateActiveProjectScene");
    render(<EditorShell />);
    fireEvent.keyDown(window, { key: "s", metaKey: true });
    expect(updateSpy).toHaveBeenCalled();
  });

  it("triggers PNG export on ⌘E", () => {
    render(<EditorShell />);
    fireEvent.keyDown(window, { key: "e", metaKey: true });
    expect(mockExportImage.exportImage).toHaveBeenCalledTimes(1);
  });

  it("triggers MP4 export on ⌘⇧E", async () => {
    render(<EditorShell />);
    fireEvent.keyDown(window, { key: "e", metaKey: true, shiftKey: true });
    await vi.waitFor(() => expect(mockExportVideo.exportVideo).toHaveBeenCalledTimes(1));
  });

  it("triggers GIF export on ⌘⇧G", async () => {
    render(<EditorShell />);
    fireEvent.keyDown(window, { key: "g", metaKey: true, shiftKey: true });
    await vi.waitFor(() => expect(mockExportVideo.exportGif).toHaveBeenCalledTimes(1));
  });

  it("copies PNG to clipboard on ⌘⇧C", () => {
    mockExportImage.copyPngToClipboard.mockImplementation((_scene, _id, _onError, onStatus) => {
      onStatus("Copying PNG…");
    });
    render(<EditorShell />);
    fireEvent.keyDown(window, { key: "c", metaKey: true, shiftKey: true });
    expect(mockExportImage.copyPngToClipboard).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Copying PNG…")).toBeInTheDocument();
  });

  it("shows an export error when clipboard write fails", () => {
    mockExportImage.copyPngToClipboard.mockImplementation((_scene, _id, onError) => {
      onError("Clipboard unavailable");
    });
    render(<EditorShell />);
    fireEvent.keyDown(window, { key: "c", metaKey: true, shiftKey: true });
    expect(screen.getByRole("alert")).toHaveTextContent("Clipboard unavailable");
  });

  it("duplicates the active layer on ⌘D", () => {
    render(<EditorShell />);
    const before = useEditorStore.getState().scene.layers.length;
    fireEvent.keyDown(window, { key: "d", metaKey: true });
    expect(useEditorStore.getState().scene.layers.length).toBe(before + 1);
  });

  it("moves the active layer down on ⌘↓", () => {
    useEditorStore.setState({ scene: makeDemoScene() });
    render(<EditorShell />);
    const scene = useEditorStore.getState().scene;
    const first = scene.layers[0]!;
    const second = scene.layers[1]!;
    fireEvent.keyDown(window, { key: "ArrowDown", metaKey: true });
    expect(useEditorStore.getState().scene.layers[0]!.id).toBe(second.id);
    expect(useEditorStore.getState().scene.layers[1]!.id).toBe(first.id);
  });

  it("moves the active layer up on ⌘↑", () => {
    useEditorStore.setState({ scene: makeDemoScene() });
    useEditorStore.setState({ scene: { ...useEditorStore.getState().scene, activeLayerId: useEditorStore.getState().scene.layers[1]!.id } });
    render(<EditorShell />);
    const scene = useEditorStore.getState().scene;
    const first = scene.layers[0]!;
    const second = scene.layers[1]!;
    fireEvent.keyDown(window, { key: "ArrowUp", metaKey: true });
    expect(useEditorStore.getState().scene.layers[0]!.id).toBe(second.id);
    expect(useEditorStore.getState().scene.layers[1]!.id).toBe(first.id);
  });

  it("selects the previous layer on ⌘[", () => {
    const demo = makeDemoScene();
    useEditorStore.setState({ scene: demo, activeLayerId: demo.activeLayerId });
    render(<EditorShell />);
    useEditorStore.setState({
      scene: { ...useEditorStore.getState().scene, activeLayerId: useEditorStore.getState().scene.layers[1]!.id },
      activeLayerId: useEditorStore.getState().scene.layers[1]!.id
    });
    const firstId = useEditorStore.getState().scene.layers[0]!.id;
    fireEvent.keyDown(window, { key: "[", metaKey: true });
    expect(useEditorStore.getState().activeLayerId).toBe(firstId);
  });

  it("selects the next layer on ⌘]", () => {
    const demo = makeDemoScene();
    useEditorStore.setState({ scene: demo, activeLayerId: demo.activeLayerId });
    render(<EditorShell />);
    const secondId = useEditorStore.getState().scene.layers[1]!.id;
    fireEvent.keyDown(window, { key: "]", metaKey: true });
    expect(useEditorStore.getState().activeLayerId).toBe(secondId);
  });

  it("nudges the selected frame with plain arrow keys", () => {
    useEditorStore.setState({ scene: makeDemoScene() });
    render(<EditorShell />);
    const store = useEditorStore.getState();
    expect(store.activeFrameInstanceId).toBeNull();
    const first = store.scene.frameInstances[0]!;
    const firstId = first.id;
    const x = first.x;
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const after = useEditorStore.getState();
    expect(after.activeFrameInstanceId).toBe(firstId);
    expect(after.scene.frameInstances[0]!.x).toBeCloseTo(x + 0.01);
  });
});

describe("EditorShell export dialog", () => {
  it("opens and closes the export dialog", async () => {
    render(<EditorShell />);
    await userEvent.click(screen.getByText("nav.export"));
    expect(screen.getByText("export.title")).toBeInTheDocument();
    await userEvent.click(document.querySelector(".modal-backdrop")!);
    expect(screen.queryByText("export.title")).not.toBeInTheDocument();
  });

  it("exports WebP from the dialog", async () => {
    render(<EditorShell />);
    await userEvent.click(screen.getByText("nav.export"));
    await userEvent.click(screen.getByText("export.webp"));
    await userEvent.click(screen.getByText("export.exportAction"));
    expect(mockExportImage.exportWebp).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("export.title")).not.toBeInTheDocument();
  });

  it("exports HTML from the dialog", async () => {
    render(<EditorShell />);
    await userEvent.click(screen.getByText("nav.export"));
    await userEvent.click(screen.getByText("export.html"));
    await userEvent.click(screen.getByText("export.exportAction"));
    expect(mockExportHtml.exportHtml).toHaveBeenCalledTimes(1);
  });

  it("exports WebM video from the dialog", async () => {
    render(<EditorShell />);
    await userEvent.click(screen.getByText("nav.export"));
    await userEvent.click(screen.getByText("export.webm"));
    await userEvent.click(screen.getByText("export.exportAction"));
    expect(mockExportVideo.exportWebm).toHaveBeenCalledTimes(1);
  });

  it("copies PNG from the dialog", async () => {
    mockExportImage.copyPngToClipboard.mockImplementation((_scene, _id, _onError, onStatus) => {
      onStatus("Copied to clipboard");
    });
    render(<EditorShell />);
    await userEvent.click(screen.getByText("nav.export"));
    await userEvent.click(screen.getByText("export.copy"));
    expect(mockExportImage.copyPngToClipboard).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Copied to clipboard")).toBeInTheDocument();
  });
});

describe("EditorShell share URL", () => {
  function stubClipboard() {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    return writeText;
  }

  it("copies the share URL to the clipboard", async () => {
    const writeText = stubClipboard();
    render(<EditorShell />);
    const shareBtn = screen.getAllByRole("button").find(b => b.title === "editor.shareTitle");
    await userEvent.click(shareBtn!);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(typeof writeText.mock.calls[0]![0]).toBe("string");
  });

  it("shows a share error when the URL is too large", async () => {
    const writeText = stubClipboard();
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: Array.from({ length: 60 }, () => ({ ...useEditorStore.getState().scene.layers[0]! })),
      },
    });
    render(<EditorShell />);
    const shareBtn = screen.getAllByRole("button").find(b => b.title === "editor.shareTitle");
    await userEvent.click(shareBtn!);
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("errors.shareUrlTooLarge");
  });
});
