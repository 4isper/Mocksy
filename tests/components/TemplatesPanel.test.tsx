// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplatesPanel } from "@/components/editor/TemplatesPanel";
import { useEditorStore } from "@/lib/state/editorStore";
import { sceneStylePresets } from "@/lib/presets/presets";

afterEach(() => {
  cleanup();
  useEditorStore.setState({ scene: useEditorStore.getState().scene });
});

describe("TemplatesPanel", () => {
  it("renders all scene style presets", () => {
    render(<TemplatesPanel />);
    for (const preset of sceneStylePresets) {
      expect(screen.getByText(`preset.${preset.id}`)).toBeInTheDocument();
    }
  });

  it("applies preset on click", async () => {
    render(<TemplatesPanel />);
    const preset = sceneStylePresets[0]!;
    await userEvent.click(screen.getByText(`preset.${preset.id}`));
    const scene = useEditorStore.getState().scene;
    expect(scene.frame).toBe(preset.frame);
    expect(scene.stylePreset).toBe(preset.stylePreset);
  });

  it("each preset card has template-card class", () => {
    render(<TemplatesPanel />);
    const cards = document.querySelectorAll(".template-card");
    expect(cards.length).toBe(sceneStylePresets.length);
  });
});
