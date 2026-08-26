// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnnotationEditor } from "@/components/editor/AnnotationEditor";
import { useEditorStore } from "@/lib/state/editorStore";
import type { Annotation } from "@/lib/types/editor";

function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: "a1",
    type: "rect",
    x: 0.2,
    y: 0.4,
    w: 0.3,
    h: 0.2,
    text: "Hello",
    color: "#ff0000",
    strokeWidth: 2,
    fontSize: 24,
    ...overrides,
  };
}

function setAnnotations(annotations: Annotation[]) {
  useEditorStore.setState((s) => ({
    scene: { ...s.scene, annotations },
  }));
}

afterEach(() => {
  cleanup();
  setAnnotations([]);
});

describe("AnnotationEditor", () => {
  describe("text annotation", () => {
    it("renders textarea for text content", () => {
      const ann = makeAnnotation({ type: "text" });
      render(<AnnotationEditor annotation={ann} />);
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("renders font selector", () => {
      const ann = makeAnnotation({ type: "text" });
      render(<AnnotationEditor annotation={ann} />);
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("renders align buttons (left, center, right)", () => {
      const ann = makeAnnotation({ type: "text" });
      render(<AnnotationEditor annotation={ann} />);
      const group = screen.getByRole("group", { name: "annotation.align" });
      expect(group).toBeInTheDocument();
      expect(group.querySelectorAll("button").length).toBe(3);
    });

    it("renders font weight buttons", () => {
      const ann = makeAnnotation({ type: "text" });
      render(<AnnotationEditor annotation={ann} />);
      const group = screen.getByRole("group", { name: "annotation.fontWeight" });
      expect(group).toBeInTheDocument();
      expect(group.querySelectorAll("button").length).toBe(2);
    });

    it("renders font style buttons", () => {
      const ann = makeAnnotation({ type: "text" });
      render(<AnnotationEditor annotation={ann} />);
      const group = screen.getByRole("group", { name: "annotation.fontStyle" });
      expect(group).toBeInTheDocument();
      expect(group.querySelectorAll("button").length).toBe(2);
    });

    it("renders font size slider", () => {
      const ann = makeAnnotation({ type: "text", fontSize: 32 });
      render(<AnnotationEditor annotation={ann} />);
      expect(screen.getByRole("slider", { name: /annotation.fontSize/ })).toBeInTheDocument();
    });

    it("renders color picker", () => {
      const ann = makeAnnotation({ type: "text" });
      render(<AnnotationEditor annotation={ann} />);
      expect(screen.getByDisplayValue("#ff0000")).toBeInTheDocument();
    });

    it("renders animated checkbox", () => {
      const ann = makeAnnotation({ type: "text" });
      render(<AnnotationEditor annotation={ann} />);
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });

    it("checkbox reflects annotation.animated prop", () => {
      const checked = makeAnnotation({ type: "text", animated: true });
      const unchecked = makeAnnotation({ type: "text", animated: false });
      const { unmount } = render(<AnnotationEditor annotation={checked} />);
      expect(screen.getByRole("checkbox")).toBeChecked();
      unmount();

      render(<AnnotationEditor annotation={unchecked} />);
      expect(screen.getByRole("checkbox")).not.toBeChecked();
    });

    it("renders delete button", () => {
      const ann = makeAnnotation({ type: "text" });
      render(<AnnotationEditor annotation={ann} />);
      expect(screen.getByRole("button", { name: "annotation.delete" })).toBeInTheDocument();
    });

    it("shows bgColor controls when bgColor is set", () => {
      const ann = makeAnnotation({ type: "text", bgColor: "#000000", bgPadding: 8, bgRadius: 4 });
      render(<AnnotationEditor annotation={ann} />);
      expect(screen.getByRole("slider", { name: /annotation.bgPadding/ })).toBeInTheDocument();
      expect(screen.getByRole("slider", { name: /annotation.bgRadius/ })).toBeInTheDocument();
    });

    it("hides bgColor sub-controls when bgColor is null", () => {
      const ann = makeAnnotation({ type: "text", bgColor: null });
      render(<AnnotationEditor annotation={ann} />);
      expect(screen.queryByRole("slider", { name: /annotation.bgPadding/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("slider", { name: /annotation.bgRadius/ })).not.toBeInTheDocument();
    });

    it("shows clear button when bgColor is set", () => {
      const ann = makeAnnotation({ type: "text", bgColor: "#000000" });
      render(<AnnotationEditor annotation={ann} />);
      expect(screen.getByText("annotation.bgClear")).toBeInTheDocument();
    });

    it("does not show clear button when bgColor is null", () => {
      const ann = makeAnnotation({ type: "text", bgColor: null });
      render(<AnnotationEditor annotation={ann} />);
      expect(screen.queryByText("annotation.bgClear")).not.toBeInTheDocument();
    });
  });

  describe("blur annotation", () => {
    it("renders blur strength slider", () => {
      const ann = makeAnnotation({ type: "blur", strokeWidth: 10 });
      render(<AnnotationEditor annotation={ann} />);
      expect(screen.getByRole("slider", { name: /annotation.blurStrength/ })).toBeInTheDocument();
    });

    it("does not render textarea for blur", () => {
      const ann = makeAnnotation({ type: "blur" });
      render(<AnnotationEditor annotation={ann} />);
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("does not render font controls for blur", () => {
      const ann = makeAnnotation({ type: "blur" });
      render(<AnnotationEditor annotation={ann} />);
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });

    it("does not render color picker for blur", () => {
      const ann = makeAnnotation({ type: "blur" });
      render(<AnnotationEditor annotation={ann} />);
      expect(screen.queryByDisplayValue("#ff0000")).not.toBeInTheDocument();
    });
  });

  describe("rect/arrow/circle annotations", () => {
    it("renders color picker for rect", () => {
      const ann = makeAnnotation({ type: "rect" });
      render(<AnnotationEditor annotation={ann} />);
      expect(screen.getByDisplayValue("#ff0000")).toBeInTheDocument();
    });

    it("renders color picker for arrow", () => {
      const ann = makeAnnotation({ type: "arrow" });
      render(<AnnotationEditor annotation={ann} />);
      expect(screen.getByDisplayValue("#ff0000")).toBeInTheDocument();
    });

    it("renders color picker for circle", () => {
      const ann = makeAnnotation({ type: "circle" });
      render(<AnnotationEditor annotation={ann} />);
      expect(screen.getByDisplayValue("#ff0000")).toBeInTheDocument();
    });

    it("renders strokeWidth slider for non-text, non-blur", () => {
      const ann = makeAnnotation({ type: "rect", strokeWidth: 3 });
      render(<AnnotationEditor annotation={ann} />);
      expect(screen.getByRole("slider", { name: /annotation.strokeWidth/ })).toBeInTheDocument();
    });

    it("does not render text controls for rect", () => {
      const ann = makeAnnotation({ type: "rect" });
      render(<AnnotationEditor annotation={ann} />);
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });

    it("strokeWidth slider has correct range (1-24)", () => {
      const ann = makeAnnotation({ type: "arrow" });
      render(<AnnotationEditor annotation={ann} />);
      const slider = screen.getByRole("slider", { name: /annotation.strokeWidth/ });
      expect(slider).toHaveAttribute("min", "1");
      expect(slider).toHaveAttribute("max", "24");
    });
  });

  describe("store interactions", () => {
    it("color picker change updates store annotation", () => {
      const ann = makeAnnotation({ type: "rect", color: "#ff0000" });
      setAnnotations([ann]);
      render(<AnnotationEditor annotation={ann} />);

      const colorInput = screen.getByDisplayValue("#ff0000");
      fireEvent.change(colorInput, { target: { value: "#00ff00" } });

      const updated = useEditorStore.getState().scene.annotations.find((a) => a.id === "a1");
      expect(updated?.color).toBe("#00ff00");
    });

    it("textarea change updates store annotation text", () => {
      const ann = makeAnnotation({ type: "text", text: "old" });
      setAnnotations([ann]);
      render(<AnnotationEditor annotation={ann} />);

      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "new" } });

      const updated = useEditorStore.getState().scene.annotations.find((a) => a.id === "a1");
      expect(updated?.text).toBe("new");
    });

    it("font size slider change updates store", () => {
      const ann = makeAnnotation({ type: "text", fontSize: 24 });
      setAnnotations([ann]);
      render(<AnnotationEditor annotation={ann} />);

      const slider = screen.getByRole("slider", { name: /annotation.fontSize/ });
      fireEvent.change(slider, { target: { value: "48" } });

      const updated = useEditorStore.getState().scene.annotations.find((a) => a.id === "a1");
      expect(updated?.fontSize).toBe(48);
    });

    it("blur strength slider change updates store strokeWidth", () => {
      const ann = makeAnnotation({ type: "blur", strokeWidth: 10 });
      setAnnotations([ann]);
      render(<AnnotationEditor annotation={ann} />);

      const slider = screen.getByRole("slider", { name: /annotation.blurStrength/ });
      fireEvent.change(slider, { target: { value: "20" } });

      const updated = useEditorStore.getState().scene.annotations.find((a) => a.id === "a1");
      expect(updated?.strokeWidth).toBe(20);
    });

    it("strokeWidth slider change updates store for rect", () => {
      const ann = makeAnnotation({ type: "rect", strokeWidth: 2 });
      setAnnotations([ann]);
      render(<AnnotationEditor annotation={ann} />);

      const slider = screen.getByRole("slider", { name: /annotation.strokeWidth/ });
      fireEvent.change(slider, { target: { value: "5" } });

      const updated = useEditorStore.getState().scene.annotations.find((a) => a.id === "a1");
      expect(updated?.strokeWidth).toBe(5);
    });

    it("font select change updates store fontFamily", () => {
      const ann = makeAnnotation({ type: "text", fontFamily: "Inter, system-ui, sans-serif" });
      setAnnotations([ann]);
      render(<AnnotationEditor annotation={ann} />);

      const select = screen.getByRole("combobox");
      fireEvent.change(select, { target: { value: "Roboto, sans-serif" } });

      const updated = useEditorStore.getState().scene.annotations.find((a) => a.id === "a1");
      expect(updated?.fontFamily).toBe("Roboto, sans-serif");
    });

    it("align button click updates store textAlign", () => {
      const ann = makeAnnotation({ type: "text", textAlign: "left" });
      setAnnotations([ann]);
      render(<AnnotationEditor annotation={ann} />);

      const group = screen.getByRole("group", { name: "annotation.align" });
      const centerBtn = group.querySelectorAll("button")[1];
      fireEvent.click(centerBtn!);

      const updated = useEditorStore.getState().scene.annotations.find((a) => a.id === "a1");
      expect(updated?.textAlign).toBe("center");
    });

    it("font weight button click updates store fontWeight", () => {
      const ann = makeAnnotation({ type: "text", fontWeight: "bold" });
      setAnnotations([ann]);
      render(<AnnotationEditor annotation={ann} />);

      const group = screen.getByRole("group", { name: "annotation.fontWeight" });
      const normalBtn = group.querySelectorAll("button")[1];
      fireEvent.click(normalBtn!);

      const updated = useEditorStore.getState().scene.annotations.find((a) => a.id === "a1");
      expect(updated?.fontWeight).toBe("normal");
    });

    it("font style button click updates store fontStyle", () => {
      const ann = makeAnnotation({ type: "text", fontStyle: "normal" });
      setAnnotations([ann]);
      render(<AnnotationEditor annotation={ann} />);

      const group = screen.getByRole("group", { name: "annotation.fontStyle" });
      const italicBtn = group.querySelectorAll("button")[1];
      fireEvent.click(italicBtn!);

      const updated = useEditorStore.getState().scene.annotations.find((a) => a.id === "a1");
      expect(updated?.fontStyle).toBe("italic");
    });

    it("checkbox toggle updates store animated", () => {
      const ann = makeAnnotation({ type: "text", animated: false });
      setAnnotations([ann]);
      render(<AnnotationEditor annotation={ann} />);

      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);

      const updated = useEditorStore.getState().scene.annotations.find((a) => a.id === "a1");
      expect(updated?.animated).toBe(true);
    });

    it("delete button removes annotation from store", () => {
      const ann = makeAnnotation({ type: "rect" });
      setAnnotations([ann]);
      render(<AnnotationEditor annotation={ann} />);

      fireEvent.click(screen.getByRole("button", { name: "annotation.delete" }));

      expect(useEditorStore.getState().scene.annotations).toHaveLength(0);
    });

    it("bgColor change updates store", () => {
      const ann = makeAnnotation({ type: "text", bgColor: "#000000" });
      setAnnotations([ann]);
      render(<AnnotationEditor annotation={ann} />);

      const bgColorInput = screen.getAllByDisplayValue("#000000")[0]!;
      fireEvent.change(bgColorInput, { target: { value: "#ffffff" } });

      const updated = useEditorStore.getState().scene.annotations.find((a) => a.id === "a1");
      expect(updated?.bgColor).toBe("#ffffff");
    });

    it("bg clear button sets bgColor to null", () => {
      const ann = makeAnnotation({ type: "text", bgColor: "#000000" });
      setAnnotations([ann]);
      render(<AnnotationEditor annotation={ann} />);

      fireEvent.click(screen.getByText("annotation.bgClear"));

      const updated = useEditorStore.getState().scene.annotations.find((a) => a.id === "a1");
      expect(updated?.bgColor).toBeNull();
    });
  });
});
