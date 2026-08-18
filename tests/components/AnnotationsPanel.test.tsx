// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("shows typography controls for text annotations", () => {
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
    expect(screen.getByText("annotation.alignLeft")).toBeInTheDocument();
    expect(screen.getByText("annotation.alignCenter")).toBeInTheDocument();
    expect(screen.getByText("annotation.bold")).toBeInTheDocument();
    expect(screen.getByText("annotation.italic")).toBeInTheDocument();
  });

  it("updates text alignment from the panel", async () => {
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
    await userEvent.click(screen.getByText("annotation.alignCenter"));
    expect(useEditorStore.getState().scene.annotations[0]!.textAlign).toBe("center");
  });

  it("updates font weight from the panel", async () => {
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
    await userEvent.click(screen.getByText("annotation.regular"));
    expect(useEditorStore.getState().scene.annotations[0]!.fontWeight).toBe("normal");
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
    expect(useEditorStore.getState().scene.annotations.length).toBe(2);
    await userEvent.click(screen.getByText("annotation.clearAllConfirm_confirm"));
    expect(useEditorStore.getState().scene.annotations.length).toBe(0);
  });
});

function textAnnotation(overrides: Partial<NonNullable<ReturnType<typeof useEditorStore.getState>["scene"]["annotations"][number]>> = {}) {
  return { id: "a1", type: "text" as const, text: "Hello", x: 0, y: 0, w: 0.2, h: 0.1, color: "#ffffff", fontSize: 24, strokeWidth: 2, ...overrides };
}

describe("AnnotationsPanel remaining controls", () => {
  it("adds a circle annotation", async () => {
    render(<AnnotationsPanel />);
    await userEvent.click(screen.getByText("editor.addCircle"));
    expect(useEditorStore.getState().scene.annotations[0]!.type).toBe("circle");
  });

  it("updates the annotation text", async () => {
    useEditorStore.setState({ selectedAnnotationId: "a1", scene: { ...useEditorStore.getState().scene, annotations: [textAnnotation()] } });
    render(<AnnotationsPanel />);
    await userEvent.clear(screen.getByDisplayValue("Hello"));
    await userEvent.type(screen.getByDisplayValue(""), "New text");
    expect(useEditorStore.getState().scene.annotations[0]!.text).toBe("New text");
  });

  it("updates the annotation color", async () => {
    useEditorStore.setState({ selectedAnnotationId: "a1", scene: { ...useEditorStore.getState().scene, annotations: [textAnnotation()] } });
    render(<AnnotationsPanel />);
    fireEvent.change(screen.getByDisplayValue("#ffffff"), { target: { value: "#ff0000" } });
    expect(useEditorStore.getState().scene.annotations[0]!.color).toBe("#ff0000");
  });

  it("updates the font family", async () => {
    useEditorStore.setState({ selectedAnnotationId: "a1", scene: { ...useEditorStore.getState().scene, annotations: [textAnnotation()] } });
    render(<AnnotationsPanel />);
    fireEvent.change(screen.getByRole("combobox", { name: "annotation.font" }), { target: { value: "Georgia, serif" } });
    expect(useEditorStore.getState().scene.annotations[0]!.fontFamily).toBe("Georgia, serif");
  });

  it("updates the font style to italic", async () => {
    useEditorStore.setState({ selectedAnnotationId: "a1", scene: { ...useEditorStore.getState().scene, annotations: [textAnnotation()] } });
    render(<AnnotationsPanel />);
    await userEvent.click(screen.getByText("annotation.italic"));
    expect(useEditorStore.getState().scene.annotations[0]!.fontStyle).toBe("italic");
  });

  it("sets and clears the background color", async () => {
    useEditorStore.setState({ selectedAnnotationId: "a1", scene: { ...useEditorStore.getState().scene, annotations: [textAnnotation({ bgColor: null })] } });
    render(<AnnotationsPanel />);
    fireEvent.change(screen.getByDisplayValue("#09090b"), { target: { value: "#000000" } });
    expect(useEditorStore.getState().scene.annotations[0]!.bgColor).toBe("#000000");

    fireEvent.click(screen.getByText("annotation.bgClear"));
    expect(useEditorStore.getState().scene.annotations[0]!.bgColor).toBeNull();
  });

  it("updates bg padding and radius", async () => {
    useEditorStore.setState({ selectedAnnotationId: "a1", scene: { ...useEditorStore.getState().scene, annotations: [textAnnotation({ bgColor: "#000000" })] } });
    render(<AnnotationsPanel />);
    fireEvent.change(screen.getByRole("slider", { name: "annotation.bgPadding" }), { target: { value: "12" } });
    expect(useEditorStore.getState().scene.annotations[0]!.bgPadding).toBe(12);
    fireEvent.change(screen.getByRole("slider", { name: "annotation.bgRadius" }), { target: { value: "8" } });
    expect(useEditorStore.getState().scene.annotations[0]!.bgRadius).toBe(8);
  });

  it("updates the font size", async () => {
    useEditorStore.setState({ selectedAnnotationId: "a1", scene: { ...useEditorStore.getState().scene, annotations: [textAnnotation()] } });
    render(<AnnotationsPanel />);
    fireEvent.change(screen.getByRole("slider", { name: "annotation.fontSize" }), { target: { value: "48" } });
    expect(useEditorStore.getState().scene.annotations[0]!.fontSize).toBe(48);
  });

  it("updates the stroke width for non-text annotations", async () => {
    useEditorStore.setState({
      selectedAnnotationId: "a1",
      scene: {
        ...useEditorStore.getState().scene,
        annotations: [{ id: "a1", type: "arrow", text: "", x: 0, y: 0, w: 0.3, h: 0.2, color: "#ff0", fontSize: 16, strokeWidth: 3 }],
      }
    });
    render(<AnnotationsPanel />);
    fireEvent.change(screen.getByRole("slider", { name: "annotation.strokeWidth" }), { target: { value: "6" } });
    expect(useEditorStore.getState().scene.annotations[0]!.strokeWidth).toBe(6);
  });
});
