// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { spliceMove, useTouchReorder } from "@/lib/hooks/useTouchReorder";

function rowEl(id: string, top: number, height: number) {
  const el = document.createElement("div");
  el.dataset.reorderId = id;
  el.getBoundingClientRect = () => ({ top, height, bottom: top + height, left: 0, right: 100, x: 0, y: top, width: 100, toJSON: () => ({}) }) as DOMRect;
  return el;
}

function pointerEvent(overrides: Record<string, unknown>) {
  return {
    pointerType: "touch",
    pointerId: 1,
    clientX: 50,
    clientY: 50,
    preventDefault: vi.fn(),
    currentTarget: { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(), hasPointerCapture: () => true },
    ...overrides
  } as unknown as React.PointerEvent;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("spliceMove", () => {
  it("moves an item below another (downward drag)", () => {
    expect(spliceMove(["a", "b", "c"], "a", "c", "below")).toEqual(["b", "c", "a"]);
  });

  it("moves an item above another (upward drag)", () => {
    expect(spliceMove(["a", "b", "c"], "c", "a", "above")).toEqual(["c", "a", "b"]);
  });

  it("returns the input for unknown ids or a self-drop", () => {
    const ids = ["a", "b"];
    expect(spliceMove(ids, "a", "zz", "above")).toBe(ids);
    expect(spliceMove(ids, "a", "a", "above")).toBe(ids);
  });
});

describe("useTouchReorder", () => {
  function setup(ids = ["a", "b", "c"]) {
    const commit = vi.fn();
    const { result } = renderHook(() => useTouchReorder({ getIds: () => ids, commit }));
    return { result, commit };
  }

  it("ignores mouse pointers (native HTML5 DnD owns that path)", () => {
    const { result } = setup();
    act(() => { result.current.handleGripPointerDown(pointerEvent({ pointerType: "mouse" }), "a") });
    expect(result.current.dragId).toBeNull();
  });

  it("starts a drag on touch pointerdown", () => {
    const { result } = setup();
    act(() => { result.current.handleGripPointerDown(pointerEvent({}), "a") });
    expect(result.current.dragId).toBe("a");
  });

  it("commits a coalesced move when dragging over another row's lower half", () => {
    const { result, commit } = setup();
    const row = rowEl("c", 100, 40);
    vi.spyOn(document, "elementFromPoint").mockReturnValue(row);
    act(() => { result.current.handleGripPointerDown(pointerEvent({}), "a") });
    act(() => { result.current.handleGripPointerMove(pointerEvent({ clientY: 130 })) });
    expect(commit).toHaveBeenCalledWith(["b", "c", "a"]);
    expect(result.current.dropTarget).toEqual({ id: "c", pos: "below" });
  });

  it("picks above/below by the row midpoint", () => {
    const { result, commit } = setup();
    const row = rowEl("c", 100, 40);
    vi.spyOn(document, "elementFromPoint").mockReturnValue(row);
    act(() => { result.current.handleGripPointerDown(pointerEvent({}), "a") });
    act(() => { result.current.handleGripPointerMove(pointerEvent({ clientY: 110 })) });
    expect(commit).toHaveBeenCalledWith(["b", "a", "c"]);
  });

  it("does not commit while hovering the dragged row itself", () => {
    const { result, commit } = setup();
    vi.spyOn(document, "elementFromPoint").mockReturnValue(rowEl("a", 0, 40));
    act(() => { result.current.handleGripPointerDown(pointerEvent({}), "a") });
    act(() => { result.current.handleGripPointerMove(pointerEvent({ clientY: 20 })) });
    expect(commit).not.toHaveBeenCalled();
  });

  it("dedupes repeated moves over the same slot", () => {
    const { result, commit } = setup();
    const row = rowEl("c", 100, 40);
    vi.spyOn(document, "elementFromPoint").mockReturnValue(row);
    act(() => { result.current.handleGripPointerDown(pointerEvent({}), "a") });
    act(() => { result.current.handleGripPointerMove(pointerEvent({ clientY: 130 })) });
    act(() => { result.current.handleGripPointerMove(pointerEvent({ clientY: 131 })) });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("ends the drag on pointerup", () => {
    const { result } = setup();
    act(() => { result.current.handleGripPointerDown(pointerEvent({}), "a") });
    act(() => { result.current.handleGripPointerUp(pointerEvent({})) });
    expect(result.current.dragId).toBeNull();
    expect(result.current.dropTarget).toBeNull();
  });
});
