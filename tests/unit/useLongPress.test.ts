// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useLongPress } from "@/lib/hooks/useLongPress";

function touchEvent(overrides: Record<string, unknown>) {
  return {
    pointerType: "touch",
    pointerId: 1,
    clientX: 100,
    clientY: 200,
    target: document.createElement("div"),
    ...overrides
  } as unknown as React.PointerEvent;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useLongPress", () => {
  it("fires after the hold duration with the press position and target", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));
    const target = document.createElement("div");
    result.current.onPointerDown(touchEvent({ target, clientX: 42, clientY: 84 }));
    expect(onLongPress).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(onLongPress).toHaveBeenCalledWith(42, 84, target);
  });

  it("ignores mouse pointers", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));
    result.current.onPointerDown(touchEvent({ pointerType: "mouse" }));
    vi.advanceTimersByTime(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("cancels when the finger moves beyond the tolerance", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));
    result.current.onPointerDown(touchEvent({}));
    result.current.onPointerMove(touchEvent({ clientX: 130, clientY: 200 }));
    vi.advanceTimersByTime(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("keeps the timer alive for movement inside the tolerance", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));
    result.current.onPointerDown(touchEvent({}));
    result.current.onPointerMove(touchEvent({ clientX: 105, clientY: 203 }));
    vi.advanceTimersByTime(500);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("cancels when a second finger lands (pinch wins)", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));
    result.current.onPointerDown(touchEvent({ pointerId: 1 }));
    result.current.onPointerDown(touchEvent({ pointerId: 2 }));
    vi.advanceTimersByTime(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("cancels on early release", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));
    result.current.onPointerDown(touchEvent({}));
    vi.advanceTimersByTime(300);
    result.current.onPointerUp(touchEvent({}));
    vi.advanceTimersByTime(500);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("cancels on pointercancel (browser gesture takeover)", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));
    result.current.onPointerDown(touchEvent({}));
    result.current.onPointerCancel(touchEvent({}));
    vi.advanceTimersByTime(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("does not fire after unmount", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result, unmount } = renderHook(() => useLongPress(onLongPress));
    result.current.onPointerDown(touchEvent({}));
    unmount();
    vi.advanceTimersByTime(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
