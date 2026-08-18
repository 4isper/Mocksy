// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RightPanel } from "@/components/editor/RightPanel";
import { useEditorStore } from "@/lib/state/editorStore";
import { initialScene } from "@/lib/state/editorStore";

afterEach(() => {
  cleanup();
  useEditorStore.setState({ scene: { ...initialScene } });
});

describe("RightPanel", () => {
  it("renders tabs", () => {
    render(<RightPanel />);
    expect(screen.getByText("templates.title")).toBeInTheDocument();
    expect(screen.getByText("editor.layers")).toBeInTheDocument();
    expect(screen.getByText("editor.annotations")).toBeInTheDocument();
    expect(screen.getByText("projects.title")).toBeInTheDocument();
  });

  it("defaults to layers tab", () => {
    render(<RightPanel />);
    expect(screen.getByRole("tab", { name: /layers/i })).toHaveAttribute("aria-selected", "true");
  });

  it("switches tab on click", async () => {
    render(<RightPanel />);
    await userEvent.click(screen.getByText("templates.title"));
    expect(screen.getByRole("tab", { name: /templates/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /layers/i })).toHaveAttribute("aria-selected", "false");
  });

  it("shows layer count badge", () => {
    useEditorStore.setState({
      scene: {
        ...initialScene,
        layers: [
          { id: "l1" } as any,
          { id: "l2" } as any,
          { id: "l3" } as any
        ]
      }
    });
    render(<RightPanel />);
    const layersTab = screen.getByRole("tab", { name: /layers/i });
    expect(layersTab.querySelector(".tab-badge")).toHaveTextContent("3");
  });

  it("shows annotation count badge", () => {
    useEditorStore.setState({
      scene: {
        ...initialScene,
        annotations: [
          { id: "a1" } as any,
          { id: "a2" } as any
        ]
      }
    });
    render(<RightPanel />);
    const annoTab = screen.getByRole("tab", { name: /annotations/i });
    expect(annoTab.querySelector(".tab-badge")).toHaveTextContent("2");
  });

  it("hides badge when count is 0", () => {
    render(<RightPanel />);
    const annoTab = screen.getByRole("tab", { name: /annotations/i });
    expect(annoTab.querySelector(".tab-badge")).toBeNull();
  });

  it("wires tablist ARIA (controls/labelledby, roving tabindex)", () => {
    render(<RightPanel />);
    const layersTab = screen.getByRole("tab", { name: /layers/i });
    expect(layersTab).toHaveAttribute("aria-controls", "right-panel-content");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "right-tab-layers");
    // Only the active tab is in the tab sequence.
    expect(layersTab).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: /templates/i })).toHaveAttribute("tabindex", "-1");
  });

  it("navigates tabs with arrow keys and moves focus", async () => {
    const user = userEvent.setup();
    render(<RightPanel />);
    const layersTab = screen.getByRole("tab", { name: /layers/i });
    const annotationsTab = screen.getByRole("tab", { name: /annotations/i });
    layersTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(annotationsTab).toHaveAttribute("aria-selected", "true");
    expect(annotationsTab).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(layersTab).toHaveAttribute("aria-selected", "true");
    expect(layersTab).toHaveFocus();
  });

  it("jumps to ends with Home/End", async () => {
    const user = userEvent.setup();
    render(<RightPanel />);
    const templatesTab = screen.getByRole("tab", { name: /templates/i });
    const projectsTab = screen.getByRole("tab", { name: /projects/i });
    const layersTab = screen.getByRole("tab", { name: /layers/i });
    layersTab.focus();
    await user.keyboard("{End}");
    expect(projectsTab).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Home}");
    expect(templatesTab).toHaveAttribute("aria-selected", "true");
  });
});
