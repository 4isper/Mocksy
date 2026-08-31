import { beforeEach, describe, expect, it } from "vitest";
import {
  SHORTCUT_DEFS,
  comboFromEvent,
  comboToDisplayTokens,
  eventBracket,
  eventLetter,
  eventMatchesCombo,
  isModifierKey,
  parseCombo
} from "@/lib/shortcuts/shortcutConfig";
import { effectiveCombo, findConflict, useShortcutsStore } from "@/lib/state/shortcutsStore";

function keyEvent(init: Partial<KeyboardEvent> & { key: string }): KeyboardEvent & { code: string } {
  return {
    code: "",
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...init
  } as KeyboardEvent & { code: string };
}

describe("parseCombo", () => {
  it("parses modifier chains into a canonical shape", () => {
    expect(parseCombo("mod+shift+e")).toEqual({ mod: true, shift: true, key: "e" });
    expect(parseCombo("mod+arrowup")).toEqual({ mod: true, shift: false, key: "arrowup" });
    expect(parseCombo("r")).toEqual({ mod: false, shift: false, key: "r" });
    expect(parseCombo("mod+[")).toEqual({ mod: true, shift: false, key: "[" });
  });

  it("returns null for malformed combos", () => {
    expect(parseCombo("")).toBeNull();
    expect(parseCombo("ctrl+e")).toBeNull(); // only "mod" is accepted
    expect(parseCombo("mod+")).toBeNull();
    expect(parseCombo("mod+f5")).toBeNull();
  });
});

describe("eventMatchesCombo", () => {
  it("matches modifiers and shift exactly", () => {
    const e = keyEvent({ key: "e", metaKey: true, shiftKey: true });
    expect(eventMatchesCombo(e, "e", null, "mod+shift+e")).toBe(true);
    expect(eventMatchesCombo(e, "e", null, "mod+e")).toBe(false);
    // Ctrl counts as mod (cross-platform), like the original handler.
    const ctrl = keyEvent({ key: "e", ctrlKey: true, shiftKey: true });
    expect(eventMatchesCombo(ctrl, "e", null, "mod+shift+e")).toBe(true);
  });

  it("matches letters physically so Cyrillic layouts work", () => {
    // Russian layout: physical S produces key "ы", code stays "KeyS".
    const cyrillic = keyEvent({ key: "ы", code: "KeyS", metaKey: true });
    const letter = eventLetter(cyrillic);
    expect(letter).toBe("s");
    expect(eventMatchesCombo(cyrillic, letter, null, "mod+s")).toBe(true);
    expect(eventMatchesCombo(cyrillic, letter, null, "mod+w")).toBe(false);
  });

  it("matches arrows via key and brackets via the physical bracket", () => {
    expect(eventMatchesCombo(keyEvent({ key: "ArrowUp", metaKey: true }), "", null, "mod+arrowup")).toBe(true);
    expect(eventMatchesCombo(keyEvent({ key: "ArrowDown" }), "", null, "mod+arrowdown")).toBe(false);
    const bracket = keyEvent({ key: "[", code: "BracketLeft", metaKey: true });
    expect(eventMatchesCombo(bracket, "[", eventBracket(bracket), "mod+")).toBe(false);
    expect(eventMatchesCombo(bracket, "[", eventBracket(bracket), "mod+[" )).toBe(true);
  });

  it("rejects malformed combos instead of throwing", () => {
    expect(eventMatchesCombo(keyEvent({ key: "e", metaKey: true }), "e", null, "nonsense+combo")).toBe(false);
  });
});

describe("comboFromEvent / display tokens", () => {
  it("serializes an event back into the combo grammar", () => {
    const e = keyEvent({ key: "e", metaKey: true, shiftKey: true });
    expect(comboFromEvent(e, "e", null)).toBe("mod+shift+e");
    expect(comboFromEvent(keyEvent({ key: "ArrowUp", metaKey: true }), "", null)).toBe("mod+arrowup");
    // Lone modifier presses produce nothing to bind.
    expect(comboFromEvent(keyEvent({ key: "Meta", metaKey: true }), "", null)).toBeNull();
  });

  it("renders human-readable kbd tokens", () => {
    expect(comboToDisplayTokens("mod+shift+e")).toEqual(["⇧", "⌘", "E"]);
    expect(comboToDisplayTokens("mod+arrowup")).toEqual(["⌘", "↑"]);
    expect(comboToDisplayTokens("r")).toEqual(["R"]);
    expect(comboToDisplayTokens("bogus+")).toEqual([]);
  });

  it("flags lone modifier keys during capture", () => {
    expect(isModifierKey("Meta")).toBe(true);
    expect(isModifierKey("Shift")).toBe(true);
    expect(isModifierKey("e")).toBe(false);
  });
});

describe("shortcutsStore", () => {
  beforeEach(() => {
    useShortcutsStore.setState({ overrides: {} });
  });

  it("effectiveCombo prefers a valid override and ignores malformed ones", () => {
    const def = { id: "export-png", combo: "mod+e" };
    expect(effectiveCombo(def, {})).toBe("mod+e");
    expect(effectiveCombo(def, { "export-png": "mod+j" })).toBe("mod+j");
    expect(effectiveCombo(def, { "export-png": "not a combo!" })).toBe("mod+e");
  });

  it("set/clear/reset manage overrides", () => {
    const store = useShortcutsStore.getState();
    store.setOverride("export-png", "mod+j");
    expect(useShortcutsStore.getState().overrides).toEqual({ "export-png": "mod+j" });
    useShortcutsStore.getState().clearOverride("export-png");
    expect(useShortcutsStore.getState().overrides).toEqual({});
    useShortcutsStore.getState().setOverride("save-project", "mod+k");
    useShortcutsStore.getState().resetAll();
    expect(useShortcutsStore.getState().overrides).toEqual({});
  });

  it("findConflict detects effective bindings, skipping self", () => {
    // Defaults collide across defs bound to the same letter with different
    // modifiers: rebinding export-mp4 onto ⌘E hits export-png.
    const hit = findConflict("mod+e", "export-mp4", {});
    expect(hit?.otherId).toBe("export-png");

    // Self never conflicts with itself.
    expect(findConflict("mod+e", "export-png", {})).toBeNull();

    // Overrides count: rebinding export-webp to ⌘J makes ⌘J conflict.
    const overrides = { "export-webp": "mod+j" };
    expect(findConflict("mod+j", "export-png", overrides)?.otherId).toBe("export-webp");

    // Fixed rows (⌘K command palette, ⌘V paste) DO conflict: their combos own
    // fixed behaviors, so a rebind onto them would silently break paste or
    // shadow the palette instead of being caught at capture time.
    expect(findConflict("mod+k", "export-png", {})?.otherId).toBe("open-command-palette");
    expect(findConflict("mod+v", "export-png", {})?.otherId).toBe("paste-media");
    expect(findConflict("r", "export-png", {})?.otherId).toBe("reset-scene");
  });

  it("keeps every default combo unique across remappable defs", () => {
    const remappable = SHORTCUT_DEFS.filter((d) => d.remappable);
    const combos = remappable.map((d) => d.combo);
    expect(new Set(combos).size).toBe(combos.length);
  });
});
