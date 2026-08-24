// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { useEditorShortcuts } from "@/lib/hooks/useEditorShortcuts";
import { useClipboardPaste } from "@/lib/hooks/useClipboardPaste";
import { getCopiedObject, setCopiedObject } from "@/lib/state/editorClipboard";
import { useEditorStore, initialScene } from "@/lib/state/editorStore";
import type { Annotation, FrameInstance } from "@/lib/types/editor";

function Harness() {
  useEditorShortcuts({
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
    isModalOpen: vi.fn(() => false)
  });
  useClipboardPaste();
  return <div />;
}

function annotation(id: string): Annotation {
  return { id, type: "rect", x: 0.1, y: 0.1, w: 0.2, h: 0.2, text: "", color: "#fff", strokeWidth: 2, fontSize: 0 };
}

function frameInstance(id: string): FrameInstance {
  return { id, frame: "iphone", x: 0.5, y: 0.5, scale: 1, layerId: null };
}

afterEach(() => {
  cleanup();
  setCopiedObject(null);
  useEditorStore.setState({ scene: initialScene, past: [], future: [], selectedAnnotationId: null, selectedAnnotationIds: [], activeFrameInstanceId: null });
});

describe("object copy/paste", () => {
  it("⌘C copies the selected annotation; ⌘V duplicates it via the paste event", () => {
    const ann = annotation("a-1");
    useEditorStore.setState({ scene: { ...initialScene, annotations: [ann] }, selectedAnnotationId: "a-1", selectedAnnotationIds: ["a-1"] });
    render(<Harness />);
    fireEvent.keyDown(window, { key: "c", metaKey: true });
    expect(getCopiedObject()).toEqual({ kind: "annotation", id: "a-1" });

    // OS clipboard carries no media → falls through to the object clipboard.
    fireEvent(window, new Event("paste"));
    const annotations = useEditorStore.getState().scene.annotations;
    expect(annotations).toHaveLength(2);
    expect(annotations[1]!.id).not.toBe("a-1");
    expect(useEditorStore.getState().past.length).toBe(1);
  });

  it("⌘C copies the selected frame instance when no annotation is selected", () => {
    useEditorStore.setState({
      scene: { ...initialScene, frameInstances: [frameInstance("fi-1")] },
      activeFrameInstanceId: "fi-1"
    });
    render(<Harness />);
    fireEvent.keyDown(window, { key: "c", ctrlKey: true });
    expect(getCopiedObject()).toEqual({ kind: "frameInstance", id: "fi-1" });

    // Pasting clones the instance with a fresh id; the original stays intact.
    fireEvent(window, new Event("paste"));
    const instances = useEditorStore.getState().scene.frameInstances;
    expect(instances.map((fi) => fi.id)).toEqual(["fi-1", expect.any(String)]);
    expect(getCopiedObject()).toEqual({ kind: "frameInstance", id: "fi-1" });
  });

  it("pasting media wins over the object clipboard", async () => {
    setCopiedObject({ kind: "annotation", id: "a-1" });
    useEditorStore.setState({ scene: { ...initialScene, annotations: [annotation("a-1")] }, selectedAnnotationId: "a-1" });
    render(<Harness />);
    const file = new File(["png"], "shot.png", { type: "image/png" });
    const event = new Event("paste") as Event & { clipboardData: unknown };
    Object.defineProperty(event, "clipboardData", {
      value: { files: [file], getText: () => "" }
    });
    fireEvent(window, event);
    await vi.waitFor(() => {
      // Media replaced the active layer instead of duplicating the annotation.
      expect(useEditorStore.getState().scene.layers[0]!.mediaUrl).toContain("data:image");
      expect(useEditorStore.getState().scene.annotations).toHaveLength(1);
    });
  });

  it("drops a stale copied id after the target was deleted", () => {
    setCopiedObject({ kind: "annotation", id: "gone" });
    render(<Harness />);
    fireEvent(window, new Event("paste"));
    expect(getCopiedObject()).toBeNull();
    expect(useEditorStore.getState().scene.annotations).toHaveLength(0);
  });
});
