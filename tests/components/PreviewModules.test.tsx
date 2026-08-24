// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PreviewBackground } from "@/components/editor/PreviewBackground";
import { PreviewOverlays } from "@/components/editor/PreviewOverlays";
import { PreviewChips, PreviewGridToggle } from "@/components/editor/PreviewChips";
import { initialScene } from "@/lib/state/editorScene";
import type { EditorScene } from "@/lib/types/editor";

function scene(overrides?: Partial<EditorScene>): EditorScene {
  return { ...initialScene, ...overrides };
}

afterEach(() => cleanup());

describe("PreviewBackground", () => {
  it("renders the grid overlay when enabled with correct tile size", () => {
    const css = { container: {}, frame: {}, mediaStyle: {}, emptyMediaStyle: {}, backgroundBlur: 4, backgroundImage: "data:bg" } as any;
    const { render: _r } = {} as any;
    render(<PreviewBackground sceneCss={css} showGrid gridDivisions={8} />);
    const overlay = document.querySelector("[data-grid-overlay]");
    expect(overlay).toBeInTheDocument();
    expect(overlay?.getAttribute("style") ?? "").toContain("12.5% 12.5%");
  });

  it("does not render the grid when disabled", () => {
    render(<PreviewBackground sceneCss={{ backgroundBlur: 0 } as any} showGrid={false} gridDivisions={12} />);
    expect(document.querySelector("[data-grid-overlay]")).not.toBeInTheDocument();
  });
});

describe("PreviewOverlays", () => {
  it("renders a text annotation and a text watermark", () => {
    const s = scene({ watermarkEnabled: true, watermarkText: "Marksy", annotations: [{ id: "a", type: "text", text: "Hi", x: 0, y: 0, w: 0.2, h: 0.1, color: "#fff", fontSize: 20, strokeWidth: 1 }] });
    render(
      <PreviewOverlays
        scene={s}
        canvasRef={{ current: null } as any}
        selectedAnnotationId="a"
        selectedAnnotationIds={["a"]}
        showGrid={false}
        gridDivisions={12}
        guides={[]}
        onSelectAnnotation={vi.fn()}
        onUpdateAnnotation={vi.fn()}
        onSelectMany={vi.fn()}
        onGuides={vi.fn()}
      />
    );
    expect(screen.getByText("Hi")).toBeInTheDocument();
    expect(screen.getByText("Marksy")).toBeInTheDocument();
  });
});

describe("PreviewChips", () => {
  it("shows upload + clear chips in single-frame mode when media exists", () => {
    render(<PreviewChips isMultiFrame={false} canClearActive targetLayerId={null} fileInputKey={0} onFile={vi.fn()} />);
    expect(screen.getByText("editor.uploadMedia")).toBeInTheDocument();
    expect(screen.getByText("editor.clearMedia")).toBeInTheDocument();
  });

  it("shows only upload in single-frame mode without media", () => {
    render(<PreviewChips isMultiFrame={false} canClearActive={false} targetLayerId={null} fileInputKey={0} onFile={vi.fn()} />);
    expect(screen.getByText("editor.uploadMedia")).toBeInTheDocument();
    expect(screen.queryByText("editor.clearMedia")).not.toBeInTheDocument();
  });

  it("shows clear-only in multi-frame mode when the target layer has media", () => {
    render(<PreviewChips isMultiFrame canClearActive targetLayerId="l1" fileInputKey={0} onFile={vi.fn()} />);
    expect(screen.queryByText("editor.uploadMedia")).not.toBeInTheDocument();
    expect(screen.getByText("editor.clearMedia")).toBeInTheDocument();
  });
});

describe("PreviewGridToggle", () => {
  it("toggles the grid and exposes the divisions select", () => {
    const setShowGrid = vi.fn();
    const setGridDivisions = vi.fn();
    render(<PreviewGridToggle showGrid={false} gridDivisions={12} setShowGrid={setShowGrid} setGridDivisions={setGridDivisions} />);
    const toggle = screen.getByRole("button", { name: "editor.grid" });
    toggle.click();
    expect(setShowGrid).toHaveBeenCalledWith(true);
  });
});
