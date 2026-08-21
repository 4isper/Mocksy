// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { useEditorShortcuts } from "@/lib/hooks/useEditorShortcuts";
import { useEditorStore, initialScene, makeDemoScene } from "@/lib/state/editorStore";

function Harness({
  actions,
}: {
  actions: ReturnType<typeof makeActions>;
}) {
  useEditorShortcuts(actions);
  return <div />;
}

function makeActions() {
  return {
    saveNow: vi.fn(),
    onReset: vi.fn(),
    onNewProject: vi.fn(),
    onExportPng: vi.fn(),
    onExportMp4: vi.fn(),
    onExportGif: vi.fn(),
    onExportWebm: vi.fn(),
    onExportWebp: vi.fn(),
    onExportWebpAnim: vi.fn(),
    onExportSvg: vi.fn(),
    onExportHtml: vi.fn(),
    onExportPdf: vi.fn(),
    onCopyPng: vi.fn(),
    onOpenShortcuts: vi.fn(),
    onOpenCommandPalette: vi.fn(),
    onToggleFullscreen: vi.fn(),
    isModalOpen: vi.fn(() => false),
  };
}

afterEach(() => {
  cleanup();
  useEditorStore.setState({ scene: initialScene, past: [], future: [], activeLayerId: initialScene.activeLayerId, fullscreenPreview: false });
});

describe("useEditorShortcuts", () => {
  it('calls onOpenShortcuts on "?"', () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    fireEvent.keyDown(window, { key: "?", code: "Slash", shiftKey: true });
    expect(actions.onOpenShortcuts).toHaveBeenCalledTimes(1);
  });

  it("skips shortcuts while typing in an input", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "?", code: "Slash", shiftKey: true });
    expect(actions.onOpenShortcuts).not.toHaveBeenCalled();
    input.remove();
  });

  it("calls onOpenCommandPalette on ⌘K", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(actions.onOpenCommandPalette).toHaveBeenCalledTimes(1);
  });

  it("ignores shortcuts while a modal is open", () => {
    const actions = makeActions();
    actions.isModalOpen.mockReturnValue(true);
    render(<Harness actions={actions} />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(actions.onOpenCommandPalette).not.toHaveBeenCalled();
  });

  it("calls saveNow on ⌘S", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    fireEvent.keyDown(window, { key: "s", metaKey: true });
    expect(actions.saveNow).toHaveBeenCalledTimes(1);
  });

  it("calls onExportPng on ⌘E", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    fireEvent.keyDown(window, { key: "e", metaKey: true });
    expect(actions.onExportPng).toHaveBeenCalledTimes(1);
  });

  it("calls onExportMp4 on ⌘⇧E", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    fireEvent.keyDown(window, { key: "e", metaKey: true, shiftKey: true });
    expect(actions.onExportMp4).toHaveBeenCalledTimes(1);
  });

  it("calls onNewProject on ⌘N", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    fireEvent.keyDown(window, { key: "n", metaKey: true });
    expect(actions.onNewProject).toHaveBeenCalledTimes(1);
  });

  it("calls onExportWebm on ⌘⇧W", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    fireEvent.keyDown(window, { key: "w", metaKey: true, shiftKey: true });
    expect(actions.onExportWebm).toHaveBeenCalledTimes(1);
  });

  it("calls onExportWebp on ⌘⇧P", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    fireEvent.keyDown(window, { key: "p", metaKey: true, shiftKey: true });
    expect(actions.onExportWebp).toHaveBeenCalledTimes(1);
  });

  it("calls onExportPdf on ⌘⇧F", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    fireEvent.keyDown(window, { key: "f", metaKey: true, shiftKey: true });
    expect(actions.onExportPdf).toHaveBeenCalledTimes(1);
  });

  it("calls onExportWebpAnim on ⌘⇧A", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    fireEvent.keyDown(window, { key: "a", metaKey: true, shiftKey: true });
    expect(actions.onExportWebpAnim).toHaveBeenCalledTimes(1);
  });

  it("calls onExportSvg on ⌘⇧S (not the plain ⌘S save)", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    fireEvent.keyDown(window, { key: "s", metaKey: true, shiftKey: true });
    expect(actions.onExportSvg).toHaveBeenCalledTimes(1);
    expect(actions.saveNow).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "s", metaKey: true });
    expect(actions.saveNow).toHaveBeenCalledTimes(1);
  });

  it("calls onExportHtml on ⌘⇧H", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    fireEvent.keyDown(window, { key: "h", metaKey: true, shiftKey: true });
    expect(actions.onExportHtml).toHaveBeenCalledTimes(1);
  });

  it("calls onExportGif on ⌘⇧G", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    fireEvent.keyDown(window, { key: "g", metaKey: true, shiftKey: true });
    expect(actions.onExportGif).toHaveBeenCalledTimes(1);
  });

  it("calls onCopyPng on ⌘⇧C", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    fireEvent.keyDown(window, { key: "c", metaKey: true, shiftKey: true });
    expect(actions.onCopyPng).toHaveBeenCalledTimes(1);
  });

  it("undoes on ⌘Z and redoes on ⌘⇧Z", () => {
    useEditorStore.getState().setScene({ shadowOpacity: 0.5 });
    expect(useEditorStore.getState().scene.shadowOpacity).toBe(0.5);
    const actions = makeActions();
    render(<Harness actions={actions} />);
    fireEvent.keyDown(window, { key: "z", metaKey: true });
    expect(useEditorStore.getState().scene.shadowOpacity).toBe(0.4);
    fireEvent.keyDown(window, { key: "z", metaKey: true, shiftKey: true });
    expect(useEditorStore.getState().scene.shadowOpacity).toBe(0.5);
  });

  it("duplicates the active layer on ⌘D", () => {
    const demo = makeDemoScene();
    useEditorStore.setState({ scene: demo, activeLayerId: demo.activeLayerId });
    const before = useEditorStore.getState().scene.layers.length;
    const actions = makeActions();
    render(<Harness actions={actions} />);
    fireEvent.keyDown(window, { key: "d", metaKey: true });
    expect(useEditorStore.getState().scene.layers.length).toBe(before + 1);
  });

  it("nudges the selected frame with plain arrow keys", () => {
    useEditorStore.setState({ scene: makeDemoScene() });
    const actions = makeActions();
    render(<Harness actions={actions} />);
    const first = useEditorStore.getState().scene.frameInstances[0]!;
    const x = first.x;
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(useEditorStore.getState().scene.frameInstances[0]!.x).toBeCloseTo(x + 0.01);
  });

  it("calls onReset on R", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    fireEvent.keyDown(window, { key: "r" });
    expect(actions.onReset).toHaveBeenCalledTimes(1);
  });

  it("toggles full-screen preview on F and exits on Escape", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    fireEvent.keyDown(window, { key: "f" });
    expect(actions.onToggleFullscreen).toHaveBeenCalledTimes(1);
    useEditorStore.setState({ fullscreenPreview: true });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useEditorStore.getState().fullscreenPreview).toBe(false);
  });

  it("does not toggle full-screen while typing in an input", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "f" });
    expect(actions.onToggleFullscreen).not.toHaveBeenCalled();
    input.remove();
  });

  it("exports PDF on ⌘⇧F instead of toggling full-screen", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    fireEvent.keyDown(window, { key: "f", metaKey: true, shiftKey: true });
    expect(actions.onExportPdf).toHaveBeenCalledTimes(1);
    expect(actions.onToggleFullscreen).not.toHaveBeenCalled();
  });

  it("removes the keydown listener on unmount", () => {
    const actions = makeActions();
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<Harness actions={actions} />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  });
});
