// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closestFrameInstanceId } from "@/lib/hooks/useCanvasDrop";
import { getCopiedObject, setCopiedObject, type CopiedObject } from "@/lib/state/editorClipboard";
import { useEditorStore, initialScene } from "@/lib/state/editorStore";

beforeEach(() => {
  useEditorStore.setState({ scene: initialScene, past: [], future: [], previewZoom: "fit", previewPan: { x: 0, y: 0 } });
});

afterEach(() => {
  setCopiedObject(null);
});

describe("closestFrameInstanceId", () => {
  it("resolves the instance id from the deepest drop target", () => {
    const root = document.createElement("div");
    const frame = document.createElement("div");
    frame.setAttribute("data-frame-instance-id", "fi-2");
    const media = document.createElement("img");
    frame.appendChild(media);
    root.appendChild(frame);
    document.body.appendChild(root);
    expect(closestFrameInstanceId(media)).toBe("fi-2");
    expect(closestFrameInstanceId(frame)).toBe("fi-2");
  });

  it("returns null outside of any frame instance", () => {
    const plain = document.createElement("div");
    document.body.appendChild(plain);
    expect(closestFrameInstanceId(plain)).toBeNull();
    expect(closestFrameInstanceId(null)).toBeNull();
  });
});

describe("preview zoom state", () => {
  it("defaults to fit and switches without touching history", () => {
    expect(useEditorStore.getState().previewZoom).toBe("fit");
    useEditorStore.getState().setPreviewZoom(2);
    expect(useEditorStore.getState().previewZoom).toBe(2);
    expect(useEditorStore.getState().past.length).toBe(0);
    useEditorStore.getState().setPreviewZoom("fit");
    expect(useEditorStore.getState().previewZoom).toBe("fit");
  });

  it("stores a pan offset without touching history", () => {
    useEditorStore.getState().setPreviewPan({ x: 42, y: -7 });
    expect(useEditorStore.getState().previewPan).toEqual({ x: 42, y: -7 });
    expect(useEditorStore.getState().past.length).toBe(0);
  });

  it("resetPreviewView restores fit, centered pan and keeps history clean", () => {
    useEditorStore.getState().setPreviewZoom(1.5);
    useEditorStore.getState().setPreviewPan({ x: 30, y: 10 });
    useEditorStore.getState().resetPreviewView();
    const st = useEditorStore.getState();
    expect(st.previewZoom).toBe("fit");
    expect(st.previewPan).toEqual({ x: 0, y: 0 });
    expect(st.past.length).toBe(0);
  });
});

describe("editor object clipboard", () => {
  it("stores and clears the copied entry", () => {
    expect(getCopiedObject()).toBeNull();
    const entry: CopiedObject = { kind: "annotation", id: "a-1" };
    setCopiedObject(entry);
    expect(getCopiedObject()).toEqual(entry);
    setCopiedObject(null);
    expect(getCopiedObject()).toBeNull();
  });
});
