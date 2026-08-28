// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditorShell } from "@/components/editor/EditorShell";
import { useEditorStore, makeDemoScene, initialScene } from "@/lib/state/editorStore";
import { useProjectsStore } from "@/lib/state/projectsStore";
import { useThemeStore } from "@/lib/state/themeStore";
import { readSharedSceneFromUrl, readTemplateFromUrl } from "@/lib/state/shareState";

/** Renders the shell and drains the async bootstrap (share-URL resolution →
 *  hydrate) so tests observe the same state the old sync bootstrap produced. */
async function renderShell() {
  render(<EditorShell />);
  await act(async () => {});
}

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
vi.mock("@/lib/state/shareState", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/state/shareState")>();
  return {
    ...actual,
    readSharedSceneFromUrl: vi.fn(),
    readTemplateFromUrl: vi.fn(),
    clearTemplateFromUrl: vi.fn()
  };
});

afterEach(() => {
  cleanup();
  useEditorStore.setState({
    scene: initialScene,
    past: [],
    future: [],
    exportScale: 2,
    customExportSize: null,
    fullscreenPreview: false,
  });
  useProjectsStore.setState({ projects: [], activeProjectId: null, saveError: null });
  useThemeStore.setState({ mode: "dark" });
});

beforeEach(() => {
  // Prevent bootstrap effect from hydrating and resetting scene
  vi.spyOn(useProjectsStore.getState(), "hydrate").mockImplementation(() => useEditorStore.getState().scene);
  vi.clearAllMocks();
  vi.mocked(readSharedSceneFromUrl).mockResolvedValue(null);
  vi.mocked(readTemplateFromUrl).mockResolvedValue(null);
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

  it("does not show a persistent saved/unsaved indicator on load", () => {
    render(<EditorShell />);
    // A restored scene matches what's persisted, so it starts with no
    // transient toast rather than flickering a false "unsaved" on load.
    expect(screen.queryByText("editor.saved")).not.toBeInTheDocument();
    expect(screen.queryByText("editor.unsaved")).not.toBeInTheDocument();
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
    await renderShell();
    // Simulate a scene change via the store
    useEditorStore.setState({
      scene: { ...useEditorStore.getState().scene, shadowOpacity: 0.5 },
    });
    // After a scene change, the saved indicator should show unsaved
    expect(await screen.findByText("editor.unsaved", {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it("does not restore the previous session's undo stack when opening a share link", async () => {
    const demo = makeDemoScene();
    vi.mocked(readSharedSceneFromUrl).mockResolvedValueOnce(demo);
    window.localStorage.setItem(
      "mocksy-history",
      JSON.stringify({ past: [{ ...demo }], future: [] })
    );
    await renderShell();
    const state = useEditorStore.getState();
    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(0);
    // The stale stack must not survive to a later plain reload either.
    expect(window.localStorage.getItem("mocksy-history")).toBeNull();
  });

  it("restores the previous session's undo stack on a plain reload", async () => {
    const demo = makeDemoScene();
    const stale = { ...demo, backgroundColor: "#112233" };
    window.localStorage.setItem("mocksy-history", JSON.stringify({ past: [stale], future: [] }));
    await renderShell();
    const state = useEditorStore.getState();
    expect(state.past).toHaveLength(1);
    expect(state.past[0]!.backgroundColor).toBe("#112233");
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

  it("does not trigger global shortcuts while the share QR dialog is open", async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<EditorShell />);
    const shareBtn = screen.getAllByRole("button").find(b => b.title === "editor.shareTitle");
    await userEvent.click(shareBtn!);
    await screen.findByRole("dialog", {}, { timeout: 2000 });
    // ⌘K would open the command palette behind the dialog unless the dialog is
    // folded into the modal gate that parks global shortcuts.
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

  it("enters full-screen preview on F and hides the panels", () => {
    render(<EditorShell />);
    expect(screen.getByText("Mocksy")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "f" });
    expect(useEditorStore.getState().fullscreenPreview).toBe(true);
    // Brand header, control panel and right panel are unmounted; an exit
    // button is shown instead.
    expect(screen.queryByText("Mocksy")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button").find(b => b.title === "editor.exitFullscreen")).toBeTruthy();
  });

  it("leaves full-screen preview on Escape", () => {
    useEditorStore.setState({ fullscreenPreview: true });
    render(<EditorShell />);
    expect(screen.queryByText("Mocksy")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useEditorStore.getState().fullscreenPreview).toBe(false);
    expect(screen.getByText("Mocksy")).toBeInTheDocument();
  });

  it("toggles full-screen preview from the toolbar button", () => {
    render(<EditorShell />);
    const btn = screen.getAllByRole("button").find(b => b.title === "editor.fullscreenTitle");
    expect(btn).toBeTruthy();
    fireEvent.click(btn!);
    expect(useEditorStore.getState().fullscreenPreview).toBe(true);
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

  it("moves the active layer down on ⌘↓", async () => {
    useEditorStore.setState({ scene: makeDemoScene() });
    await renderShell();
    const scene = useEditorStore.getState().scene;
    const first = scene.layers[0]!;
    const second = scene.layers[1]!;
    fireEvent.keyDown(window, { key: "ArrowDown", metaKey: true });
    expect(useEditorStore.getState().scene.layers[0]!.id).toBe(second.id);
    expect(useEditorStore.getState().scene.layers[1]!.id).toBe(first.id);
  });

  it("moves the active layer up on ⌘↑", async () => {
    useEditorStore.setState({ scene: makeDemoScene() });
    useEditorStore.setState({ scene: { ...useEditorStore.getState().scene, activeLayerId: useEditorStore.getState().scene.layers[1]!.id } });
    await renderShell();
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

  it("does not double-nudge a focused frame instance on arrow keys", async () => {
    useEditorStore.setState({ scene: makeDemoScene() });
    await renderShell();
    const inst = useEditorStore.getState().scene.frameInstances[0]!;
    useEditorStore.getState().selectFrameInstance(inst.id);
    const frame = document.querySelector(".frame-instance");
    expect(frame).not.toBeNull();
    const x = inst.x;
    fireEvent.keyDown(frame!, { key: "ArrowRight" });
    expect(useEditorStore.getState().scene.frameInstances[0]!.x).toBeCloseTo(x + 0.01);
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
    // Compression makes the URL build async — wait for the clipboard write.
    await screen.findByText("editor.shareLinkCopied", {}, { timeout: 2000 });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(typeof writeText.mock.calls[0]![0]).toBe("string");
  });

  it("shows a share error when the URL is too large", async () => {
    const writeText = stubClipboard();
    // Incompressible (random) media payloads mimic real image data — deflate
    // can't rescue them, so the practical URL limit still applies.
    let seed = 987654321;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const randomDataUrl = () => {
      const body = Array.from({ length: 600 }, () => alphabet[Math.floor(rand() * alphabet.length)]).join("");
      return `data:image/png;base64,${body}`;
    };
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        layers: Array.from({ length: 60 }, () => ({ ...useEditorStore.getState().scene.layers[0]!, mediaUrl: randomDataUrl() })),
      },
    });
    await renderShell();
    const shareBtn = screen.getAllByRole("button").find(b => b.title === "editor.shareTitle");
    await userEvent.click(shareBtn!);
    await screen.findByRole("alert", {}, { timeout: 2000 });
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("errors.shareUrlTooLarge");
  });
});
