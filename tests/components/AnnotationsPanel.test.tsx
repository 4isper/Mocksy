// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnnotationsPanel } from "@/components/editor/AnnotationsPanel";
import { useEditorStore } from "@/lib/state/editorStore";

afterEach(() => {
  cleanup();
  useEditorStore.setState({
    scene: {
      ...useEditorStore.getState().scene,
      annotations: [],
    },
    selectedAnnotationId: null,
  });
});

describe("AnnotationsPanel", () => {
  it("renders add annotation buttons", () => {
    render(<AnnotationsPanel />);
    expect(screen.getByText("editor.addText")).toBeInTheDocument();
    expect(screen.getByText("editor.addArrow")).toBeInTheDocument();
    expect(screen.getByText("editor.addBox")).toBeInTheDocument();
  });

  it("shows empty state message", () => {
    render(<AnnotationsPanel />);
    expect(screen.getByText("annotation.addCallouts")).toBeInTheDocument();
  });

  it("adds text annotation", async () => {
    render(<AnnotationsPanel />);
    await userEvent.click(screen.getByText("editor.addText"));
    expect(useEditorStore.getState().scene.annotations.length).toBe(1);
    expect(useEditorStore.getState().scene.annotations[0]!.type).toBe("text");
  });

  it("adds arrow annotation", async () => {
    render(<AnnotationsPanel />);
    await userEvent.click(screen.getByText("editor.addArrow"));
    expect(useEditorStore.getState().scene.annotations.length).toBe(1);
    expect(useEditorStore.getState().scene.annotations[0]!.type).toBe("arrow");
  });

  it("adds rect annotation", async () => {
    render(<AnnotationsPanel />);
    await userEvent.click(screen.getByText("editor.addBox"));
    expect(useEditorStore.getState().scene.annotations.length).toBe(1);
    expect(useEditorStore.getState().scene.annotations[0]!.type).toBe("rect");
  });

  it("lists existing annotations", () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        annotations: [
          { id: "a1", type: "text", text: "Hello", x: 0, y: 0, w: 0.2, h: 0.1, color: "#fff", fontSize: 24, strokeWidth: 2 },
          { id: "a2", type: "arrow", x: 0, y: 0, w: 0.3, h: 0.2, color: "#ff0", fontSize: 16, strokeWidth: 3, text: "" },
        ],
      }
    });
    render(<AnnotationsPanel />);
    expect(screen.getByText(/annotation.text/i)).toBeInTheDocument();
    expect(screen.getByText(/annotation.arrow/i)).toBeInTheDocument();
  });

  it("selects annotation on click", async () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        annotations: [
          { id: "a1", type: "text", text: "Hello", x: 0, y: 0, w: 0.2, h: 0.1, color: "#fff", fontSize: 24, strokeWidth: 2 },
        ],
      }
    });
    render(<AnnotationsPanel />);
    await userEvent.click(screen.getByText(/annotation.text/i));
    expect(useEditorStore.getState().selectedAnnotationId).toBe("a1");
  });

  it("deselects on re-click", async () => {
    useEditorStore.setState({
      selectedAnnotationId: "a1",
      scene: {
        ...useEditorStore.getState().scene,
        annotations: [
          { id: "a1", type: "text", text: "Hello", x: 0, y: 0, w: 0.2, h: 0.1, color: "#fff", fontSize: 24, strokeWidth: 2 },
        ],
      }
    });
    render(<AnnotationsPanel />);
    await userEvent.click(screen.getByRole("button", { name: /annotation.text/i }));
    expect(useEditorStore.getState().selectedAnnotationId).toBeNull();
  });

  it("shows annotation editor when selected", () => {
    useEditorStore.setState({
      selectedAnnotationId: "a1",
      scene: {
        ...useEditorStore.getState().scene,
        annotations: [
          { id: "a1", type: "text", text: "Hello", x: 0, y: 0, w: 0.2, h: 0.1, color: "#fff", fontSize: 24, strokeWidth: 2 },
        ],
      }
    });
    render(<AnnotationsPanel />);
    expect(screen.getByDisplayValue("Hello")).toBeInTheDocument();
    expect(screen.getByText("annotation.delete")).toBeInTheDocument();
  });

  it("shows color picker for selected annotation", () => {
    useEditorStore.setState({
      selectedAnnotationId: "a1",
      scene: {
        ...useEditorStore.getState().scene,
        annotations: [
          { id: "a1", type: "text", text: "Hi", x: 0, y: 0, w: 0.2, h: 0.1, color: "#ff0000", fontSize: 24, strokeWidth: 2 },
        ],
      }
    });
    render(<AnnotationsPanel />);
    const colorInput = screen.getByDisplayValue("#ff0000");
    expect(colorInput).toBeInTheDocument();
  });

  it("deletes selected annotation", async () => {
    useEditorStore.setState({
      selectedAnnotationId: "a1",
      scene: {
        ...useEditorStore.getState().scene,
        annotations: [
          { id: "a1", type: "text", text: "Hi", x: 0, y: 0, w: 0.2, h: 0.1, color: "#fff", fontSize: 24, strokeWidth: 2 },
        ],
      }
    });
    render(<AnnotationsPanel />);
    await userEvent.click(screen.getByText("annotation.delete"));
    expect(useEditorStore.getState().scene.annotations.length).toBe(0);
  });

  it("clears all annotations", async () => {
    useEditorStore.setState({
      scene: {
        ...useEditorStore.getState().scene,
        annotations: [
          { id: "a1", type: "text", text: "A", x: 0, y: 0, w: 0.2, h: 0.1, color: "#fff", fontSize: 24, strokeWidth: 2 },
          { id: "a2", type: "arrow", x: 0, y: 0, w: 0.2, h: 0.1, color: "#fff", fontSize: 16, strokeWidth: 2, text: "" },
        ],
      }
    });
    render(<AnnotationsPanel />);
    await userEvent.click(screen.getByText("annotation.clearAll"));
    expect(useEditorStore.getState().scene.annotations.length).toBe(0);
  });
});
