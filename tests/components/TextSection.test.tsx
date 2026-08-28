// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TextSection } from "@/components/editor/sections/TextSection";
import { useEditorStore, initialScene } from "@/lib/state/editorStore";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";

function textLayer(locked: boolean): MediaLayer {
  return {
    ...initialScene.layers[0]!,
    id: "text-1",
    kind: "text",
    mediaUrl: null,
    mediaType: "none" as const,
    mediaName: null,
    textContent: "Hello",
    textColor: "#ffcc00",
    textSize: 0.2,
    textAlign: "center" as const,
    fontWeight: "bold" as const,
    locked
  };
}

function renderWithLocked(locked: boolean) {
  const scene: EditorScene = {
    ...initialScene,
    activeLayerId: "text-1",
    layers: [textLayer(locked)]
  };
  useEditorStore.setState({ scene, activeLayerId: "text-1" });
  render(<TextSection />);
}

afterEach(() => {
  cleanup();
  useEditorStore.setState({ scene: { ...initialScene } });
});

describe("TextSection", () => {
  it("disables every control and shows a hint when the active text layer is locked", () => {
    renderWithLocked(true);
    // The hint tells the user why the controls are dead instead of silently
    // swallowing input (updateActiveLayer no-ops on locked layers).
    expect(screen.getByRole("status")).toHaveTextContent("editor.layerLockedHint");
    const textarea = screen.getByLabelText("text.content") as HTMLTextAreaElement;
    expect(textarea).toBeDisabled();
    expect(textarea.value).toBe("Hello");
    expect(screen.getByLabelText("text.color")).toBeDisabled();
    expect(screen.getByLabelText("text.size")).toBeDisabled();
    const segmentedButtons = document.querySelectorAll<HTMLButtonElement>(".segmented button");
    expect(segmentedButtons.length).toBe(5);
    for (const button of segmentedButtons) expect(button).toBeDisabled();
  });

  it("keeps controls editable for an unlocked text layer", () => {
    renderWithLocked(false);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    const textarea = screen.getByLabelText("text.content");
    expect(textarea).not.toBeDisabled();
    fireEvent.change(textarea, { target: { value: "Bye" } });
    const layer = useEditorStore.getState().scene.layers[0]!;
    expect(layer.textContent).toBe("Bye");
  });
});