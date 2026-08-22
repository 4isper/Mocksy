// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistoryPanel } from "@/components/editor/HistoryPanel";
import { useEditorStore } from "@/lib/state/editorStore";
import { initialScene } from "@/lib/state/editorScene";

afterEach(() => {
  cleanup();
  useEditorStore.setState({ scene: initialScene, past: [], future: [] });
});

describe("HistoryPanel", () => {
  it("shows the empty state with only the initial entry", () => {
    render(<HistoryPanel />);
    expect(screen.getByText("history.initial")).toBeInTheDocument();
    expect(screen.getByText("history.empty")).toBeInTheDocument();
  });

  it("labels each step by the change category", async () => {
    useEditorStore.setState({ scene: initialScene, past: [], future: [] });
    useEditorStore.getState().setScene({ backgroundColor: "#123456" });
    useEditorStore.getState().setScene({ frame: "macbook" });
    render(<HistoryPanel />);
    // 3 rows: initial, background change, frame change.
    expect(screen.getByText("history.initial")).toBeInTheDocument();
    expect(screen.getByText("history.change.background")).toBeInTheDocument();
    expect(screen.getByText("history.change.frame")).toBeInTheDocument();
  });

  it("marks the current step and jumps on click", async () => {
    useEditorStore.setState({ scene: initialScene, past: [], future: [] });
    useEditorStore.getState().setScene({ backgroundColor: "#123456" });
    useEditorStore.getState().setScene({ backgroundColor: "#654321" });
    render(<HistoryPanel />);
    const current = screen.getByRole("button", { current: "step" });
    expect(current).toHaveTextContent("history.change.background");
    // Jumping to the initial state restores the default background.
    const initialRow = screen.getByText("history.initial").closest("button")!;
    await userEvent.click(initialRow);
    expect(useEditorStore.getState().scene.backgroundColor).toBe(initialScene.backgroundColor);
    expect(useEditorStore.getState().past.length).toBe(0);
  });
});
