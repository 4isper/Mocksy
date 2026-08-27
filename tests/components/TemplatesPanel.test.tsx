// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplatesPanel } from "@/components/editor/TemplatesPanel";
import { useEditorStore, initialScene } from "@/lib/state/editorStore";
import { sceneStylePresets } from "@/lib/presets/presets";
import { sceneTemplates } from "@/lib/presets/sceneTemplates";
import { resetTemplatesStoreForTests, useTemplatesStore } from "@/lib/state/templatesStore";

afterEach(() => {
  cleanup();
  useEditorStore.setState({ scene: { ...initialScene }, past: [], future: [] });
  window.localStorage.clear();
  resetTemplatesStoreForTests();
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
    expect(cards.length).toBe(sceneStylePresets.length + sceneTemplates.length);
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

  it("saves the current scene as a named user template", async () => {
    render(<TemplatesPanel onShareTemplate={async () => {}} />);
    await userEvent.type(screen.getByPlaceholderText("templates.savePlaceholder"), "My look");
    await userEvent.click(screen.getByRole("button", { name: "templates.save" }));
    const templates = useTemplatesStore.getState().templates;
    expect(templates).toHaveLength(1);
    expect(templates[0]!.name).toBe("My look");
    // Saved template strips media from layers
    expect(templates[0]!.scene.layers.every((l) => l.mediaUrl === null)).toBe(true);
    // Input cleared after save
    expect(screen.getByPlaceholderText("templates.savePlaceholder")).toHaveValue("");
    // Card appears under "My templates"
    expect(screen.getByText("My look")).toBeInTheDocument();
  });

  it("applies a saved template to the editor scene", async () => {
    useEditorStore.setState({ scene: { ...initialScene, backgroundMode: "gradient" } });
    render(<TemplatesPanel onShareTemplate={async () => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "templates.save" }));
    // Change the scene afterwards, then re-apply the template.
    useEditorStore.setState({ scene: { ...initialScene, backgroundColor: "#000000" }, past: [], future: [] });
    await userEvent.click(screen.getByText("Untitled"));
    expect(useEditorStore.getState().scene.backgroundColor).toBe(initialScene.backgroundColor);
    expect(useEditorStore.getState().past.length).toBe(1);
  });

  it("deletes a saved template", async () => {
    render(<TemplatesPanel onShareTemplate={async () => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "templates.save" }));
    expect(useTemplatesStore.getState().templates).toHaveLength(1);
    await userEvent.click(
      screen.getByRole("button", { name: "templates.deleteTitle" })
    );
    // Deletion is confirmed first.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "templates.deleteConfirmConfirm" }));
    expect(useTemplatesStore.getState().templates).toHaveLength(0);
    expect(screen.queryByText("Untitled")).not.toBeInTheDocument();
  });
});
