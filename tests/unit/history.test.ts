import { describe, expect, it } from "vitest";
import type { EditorScene } from "@/lib/types/editor";
import { initialScene } from "@/lib/state/editorStore";
import { pushHistory } from "@/lib/state/history";

function mutator(overrides: Partial<Parameters<typeof pushHistory>[0]> = {}): Parameters<typeof pushHistory>[0] {
  return {
    past: [],
    future: [],
    scene: { ...initialScene },
    lastHistoryKey: null,
    lastHistoryAt: 0,
    ...overrides
  };
}

const sceneAt = (radius: number): EditorScene => ({ ...initialScene, borderRadius: radius });

describe("pushHistory", () => {
  it("pushes the previous scene onto past and clears the redo stack", () => {
    const s = mutator({ past: [initialScene], future: [sceneAt(2)] });
    const result = pushHistory(s, sceneAt(1.5));
    expect(result.past).toHaveLength(2);
    expect(result.future).toHaveLength(0);
    expect(result.scene.borderRadius).toBe(1.5);
  });

  it("coalesces a same-key repeat inside the window without touching past", () => {
    const base = { ...initialScene };
    const dragged = { ...initialScene, shadowOpacity: 0.9 };
    const s = mutator({ past: [base], scene: sceneAt(1.2), lastHistoryKey: "zoom", lastHistoryAt: Date.now() });
    const result = pushHistory(s, dragged, "zoom");
    expect(result.scene).toBe(dragged);
    expect(result.past).toEqual([base]);
  });

  it("a coalesced edit still drops stale redo entries left by an undo", () => {
    const s = mutator({ past: [], future: [sceneAt(2)], lastHistoryKey: "zoom", lastHistoryAt: Date.now() });
    const result = pushHistory(s, { ...initialScene, borderRadius: 8 }, "zoom");
    // The scene changed even though no past entry was pushed — keeping the
    // undone state on the redo stack would let ⌘⇧Z jump over this edit.
    expect(result.future).toHaveLength(0);
  });
});
