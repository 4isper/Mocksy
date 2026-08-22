// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplatesPanel } from "@/components/editor/TemplatesPanel";
import { useEditorStore, initialScene } from "@/lib/state/editorStore";
import { sceneStylePresets } from "@/lib/presets/presets";

afterEach(() => {
  cleanup();
  useEditorStore.setState({ scene: { ...initialScene }, past: [], future: [] });
});

describe("TemplatesPanel", () => {
  it("renders all scene style presets", () => {
    render(<TemplatesPanel onShareTemplate={async () => {}} />);
    for (const preset of sceneStylePresets) {
      expect(screen.getByText(`preset.${preset.id}`)).toBeInTheDocument();
    }
  });

  it("applies preset on click", async () => {
    render(<TemplatesPanel onShareTemplate={async () => {}} />);
    const preset = sceneStylePresets[0]!;
    await userEvent.click(screen.getByText(`preset.${preset.id}`));
    const scene = useEditorStore.getState().scene;
    expect(scene.frame).toBe(preset.frame);
    expect(scene.stylePreset).toBe(preset.stylePreset);
  });

  it("each preset card has template-card class", () => {
    render(<TemplatesPanel onShareTemplate={async () => {}} />);
    const cards = document.querySelectorAll(".template-card");
    expect(cards.length).toBe(sceneStylePresets.length);
  });

  it("surprise button applies a valid random style in one undo step", async () => {
    render(<TemplatesPanel onShareTemplate={async () => {}} />);
    await userEvent.click(screen.getByText("templates.surprise"));
    const state = useEditorStore.getState();
    expect(["solid", "gradient", "pattern"]).toContain(state.scene.backgroundMode);
    // Media layers and the device frame survive the randomize.
    expect(state.scene.layers).toEqual(initialScene.layers);
    expect(state.scene.frame).toBe(initialScene.frame);
    // Exactly one history entry for the whole action.
    expect(state.past.length).toBe(1);
  });
});
